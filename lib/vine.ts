/**
 * The vine's drawing vocabulary: the handful of curve generators the projects
 * timeline is built from.
 *
 * Kept here, next to `frame.ts` and `glow.ts`, because it is pure geometry —
 * no Vue, no DOM — and because the stem, the hanging growth under the chart
 * and every tendril have to agree on what a curl looks like or the page stops
 * reading as one plant.
 */

export interface Pt {
  x: number;
  y: number;
}

/**
 * Catmull-Rom spline through every point, emitted as cubic beziers.
 *
 * The same construction `BiographySection.vue` uses for its connector: the
 * curve passes THROUGH each node rather than near it, which is the whole point
 * when the nodes are cards the line is supposed to link.
 */
export function splineThrough(pts: Pt[]): string {
  if (pts.length < 2) return "";
  const f = (n: number) => n.toFixed(2);
  let d = `M ${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d +=
      ` C ${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)}` +
      ` ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)}` +
      ` ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/**
 * A shrinking spiral, appended to a path that ARRIVES at (px, py) travelling at
 * `tangentDeg`. This is the Schnörkel — the thing that makes the line read as a
 * vine rather than a wire.
 *
 * Emitted as line segments rather than arcs: a spiral is not an arc, and at ~28
 * samples per turn the difference is invisible while the maths stays honest.
 */
export function curl(
  px: number,
  py: number,
  tangentDeg: number,
  r: number,
  turns: number,
  dir: 1 | -1
): string {
  const th = (tangentDeg * Math.PI) / 180;
  // The centre sits one radius off the tangent, so the spiral leaves the path
  // smoothly instead of kinking at the join.
  const cx = px + Math.cos(th + (dir * Math.PI) / 2) * r;
  const cy = py + Math.sin(th + (dir * Math.PI) / 2) * r;
  const a0 = Math.atan2(py - cy, px - cx);
  const steps = Math.max(10, Math.round(turns * 28));
  let d = "";
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + dir * t * turns * Math.PI * 2;
    const rr = r * (1 - 0.62 * t);
    d += ` L ${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }
  return d;
}

/**
 * A side-shoot: splays off the stem at `side * 66°`, bows, and finishes in a
 * corkscrew. Returns a complete path, ready to hand to a <path d>.
 */
export function sideShoot(
  p: Pt,
  tangentDeg: number,
  side: 1 | -1,
  len: number,
  r: number,
  turns: number
): string {
  const th = ((tangentDeg + side * 66) * Math.PI) / 180;
  const ex = p.x + Math.cos(th) * len;
  const ey = p.y + Math.sin(th) * len;
  const bow = side * len * 0.3;
  const kx = p.x + Math.cos(th) * len * 0.55 - Math.sin(th) * bow;
  const ky = p.y + Math.sin(th) * len * 0.55 + Math.cos(th) * bow;
  const tang = (Math.atan2(ey - ky, ex - kx) * 180) / Math.PI;
  return (
    `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` +
    ` Q ${kx.toFixed(2)} ${ky.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}` +
    curl(ex, ey, tang, r, turns, side > 0 ? 1 : -1)
  );
}

/** One leaf, drawn from its own base at the origin so a transform can place it. */
export const LEAF_PATH = "M0,0 C6,-7.5 18,-8.5 25,0 C18,8.5 6,7.5 0,0 Z";

/**
 * A y → arc-length lookup, sampled off a real path element. Lets the growth
 * land its tip EXACTLY on a given y rather than approximating from the node
 * positions. Requires the path to be monotonic in y, which the stem is.
 */
export function lengthAtY(lut: { l: number; y: number }[], total: number, y: number): number {
  if (!lut.length) return 0;
  if (y <= lut[0]!.y) return 0;
  if (y >= lut[lut.length - 1]!.y) return total;
  let lo = 0;
  let hi = lut.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lut[mid]!.y < y) lo = mid;
    else hi = mid;
  }
  const a = lut[lo]!;
  const b = lut[hi]!;
  return a.l + (b.l - a.l) * (b.y === a.y ? 0 : (y - a.y) / (b.y - a.y));
}

export function sampleLut(path: SVGPathElement, total: number, n = 480) {
  const lut: { l: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const l = (total * i) / n;
    lut.push({ l, y: path.getPointAtLength(l).y });
  }
  return lut;
}

/** A small deterministic PRNG, so the growth is the same growth on every rebuild. */
export function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}
