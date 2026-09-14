"""Generate public/setpieces/germany.svg from Natural Earth (public domain).

    python scripts/make-germany-svg.py

Downloads the source on first run and caches it next to this script. The output
is committed, so this only needs running to re-cut the map (a different
resolution, more neighbours, a different window).

The SVG's coordinate system IS the projection, so a city can be placed from its
lat/lon with two multiplications and nothing else has to agree about anything:

    x =  lon * LON_SCALE      (equirectangular, standard parallel 51 N)
    y = -lat * LAT_SCALE      (SVG y runs down, latitude runs up)

Keep those two constants in sync with RouteArc.vue if the art is ever re-cut —
they are the whole reason real coordinates land on the real coastline.
"""
import io, json, math, os, urllib.request

LAT_SCALE = 100.0
STD_PARALLEL = 51.0
LON_SCALE = LAT_SCALE * math.cos(math.radians(STD_PARALLEL))

# Natural Earth 1:50m admin-0. Public domain: "no permission needed".
SRC_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/"
    "geojson/ne_50m_admin_0_countries.geojson"
)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, ".cache-ne_50m_admin_0_countries.geojson")
OUT = os.path.join(ROOT, "public", "setpieces", "germany.svg")

if not os.path.exists(SRC):
    print("downloading", SRC_URL)
    urllib.request.urlretrieve(SRC_URL, SRC)


def project(lon, lat):
    return (lon * LON_SCALE, -lat * LAT_SCALE)


def rings_of(geom):
    if geom["type"] == "Polygon":
        return list(geom["coordinates"])
    return [r for poly in geom["coordinates"] for r in poly]


def perp(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify(pts, eps):
    """Douglas-Peucker, iterative so a 500-point coastline cannot blow the stack."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        lo, hi = stack.pop()
        if hi <= lo + 1:
            continue
        ax, ay = pts[lo]
        bx, by = pts[hi]
        worst, at = -1.0, -1
        for i in range(lo + 1, hi):
            d = perp(pts[i][0], pts[i][1], ax, ay, bx, by)
            if d > worst:
                worst, at = d, i
        if worst > eps:
            keep[at] = True
            stack.append((lo, at))
            stack.append((at, hi))
    return [p for p, k in zip(pts, keep) if k]


def extent(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return max(xs) - min(xs), max(ys) - min(ys)


def path_d(pts):
    head = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    rest = "".join(f"L{x:.1f},{y:.1f}" for x, y in pts[1:])
    return head + rest + "Z"


def country(data, iso):
    for f in data["features"]:
        pr = f["properties"]
        if pr.get("ISO_A3") == iso or pr.get("ADM0_A3") == iso:
            return f["geometry"]
    raise SystemExit(f"{iso} not found")


# Natural Earth files the Caribbean municipalities (Bonaire, Saba, Sint
# Eustatius) under NLD, which would drag the map 60 degrees west. Keep only
# rings that actually sit in the window this piece is about.
WINDOW = (2.0, 16.5, 46.0, 56.0)  # lon min/max, lat min/max


def in_window(ring):
    lon = sum(p[0] for p in ring) / len(ring)
    lat = sum(p[1] for p in ring) / len(ring)
    return WINDOW[0] <= lon <= WINDOW[1] and WINDOW[2] <= lat <= WINDOW[3]


def parts(geom, eps, min_extent, prefix):
    out = []
    for ring in rings_of(geom):
        if not in_window(ring):
            continue
        pts = simplify([project(lon, lat) for lon, lat in ring], eps)
        w, h = extent(pts)
        # Drop islets too small to read as anything but noise at this size.
        if len(pts) < 5 or max(w, h) < min_extent:
            continue
        out.append(pts)
    out.sort(key=lambda p: -max(extent(p)))
    return [(f"{prefix}{'' if i == 0 else i}", p) for i, p in enumerate(out)]


data = json.load(io.open(SRC, encoding="utf-8"))
# Germany reads as the subject; the Netherlands is there so Maastricht lands in a
# country rather than in the void west of the border.
de = parts(country(data, "DEU"), 0.9, 6.0, "de")
nl = parts(country(data, "NLD"), 1.2, 8.0, "nl")

allpts = [p for _, ring in de + nl for p in ring]
minx = min(p[0] for p in allpts)
maxx = max(p[0] for p in allpts)
miny = min(p[1] for p in allpts)
maxy = max(p[1] for p in allpts)

# Graticule: whole degrees, padded out past the coastlines so it frames the map.
pad = 30.0
gx0, gx1, gy0, gy1 = minx - pad, maxx + pad, miny - pad, maxy + pad
grat = []
lon = math.ceil(gx0 / LON_SCALE / 2) * 2
while lon * LON_SCALE <= gx1:
    x = lon * LON_SCALE
    grat.append(f"M{x:.1f},{gy0:.1f}L{x:.1f},{gy1:.1f}")
    lon += 2
lat = math.ceil(-gy1 / LAT_SCALE / 2) * 2
while -lat * LAT_SCALE >= gy0:
    y = -lat * LAT_SCALE
    grat.append(f"M{gx0:.1f},{y:.1f}L{gx1:.1f},{y:.1f}")
    lat += 2

w = gx1 - gx0
h = gy1 - gy0
lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!-- Germany + the Netherlands, line art for the 'The move' set-piece.",
    "     Source: Natural Earth 1:50m admin-0 (public domain, naturalearthdata.com).",
    f"     Projection: equirectangular, standard parallel {STD_PARALLEL} N.",
    f"       x =  lon * {LON_SCALE:.4f}",
    f"       y = -lat * {LAT_SCALE:.4f}",
    "     RouteArc.vue re-derives city positions with those two constants, so they",
    "     must stay in step with this file. Generated, not hand-drawn. -->",
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{gx0:.1f} {gy0:.1f} {w:.1f} {h:.1f}"',
    '     fill="none" stroke="#fff" stroke-width="1">',
    f'  <path id="graticule" d="{"".join(grat)}"/>',
]
for name, ring in nl:
    lines.append(f'  <path id="{name}" d="{path_d(ring)}"/>')
for name, ring in de:
    lines.append(f'  <path id="{name}" d="{path_d(ring)}"/>')
lines.append("</svg>")

io.open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
print("wrote", OUT, os.path.getsize(OUT), "bytes")
print("de parts:", [(n, len(p)) for n, p in de])
print("nl parts:", [(n, len(p)) for n, p in nl])
print(f"viewBox: {gx0:.1f} {gy0:.1f} {w:.1f} {h:.1f}")
for city, (la, lo) in {"Berlin": (52.520, 13.405), "Maastricht": (50.851, 5.691)}.items():
    x, y = project(lo, la)
    print(f"  {city}: x={x:.1f} y={y:.1f}  (u={(x-gx0)/w:.3f}, v={(y-gy0)/h:.3f})")
