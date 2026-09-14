<script setup lang="ts">
import { shallowRef, onMounted, onBeforeUnmount } from "vue";
import { useWindowSize } from "@vueuse/core";
import { useLoop } from "@tresjs/core";
import type { Group } from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  approach,
  clamp01,
  createDots,
  createLinkPool,
  createLines,
  drawFraction,
  setDotScale,
  smoothstep,
  type LineField,
  type SetPieceProps,
} from "./lineArt";

/**
 * "The move" — Berlin to Maastricht, flown across a real map.
 *
 * What this replaces, and why
 * ---------------------------
 * Two versions ago this was a bezier with two square dots on it. The version
 * after that gave it a horizon, altitude lines and map markers, which fixed the
 * grammar but not the subject: an arc between two anonymous points is a diagram
 * of *a* journey, not of *this* one. So now the journey happens over the country
 * it actually crossed.
 *
 * The map is `public/setpieces/germany.svg` — Germany and the Netherlands, cut
 * from Natural Earth 1:50m (public domain) by `scripts/make-germany-svg.py`, in
 * a projection chosen so that placing a city needs no lookup table and no
 * fudging:
 *
 *     x =  lon * LON_SCALE        (equirectangular, standard parallel 51 N)
 *     y = -lat * LAT_SCALE
 *
 * The SVG's coordinate system IS that projection, so `project(lat, lon)` below
 * runs a city's real coordinates through the same normalisation the artwork
 * gets, and lands it exactly where it belongs. Berlin and Maastricht are placed
 * by their actual coordinates, the border crossing is found by intersecting the
 * route with the real German outline, and re-cutting the map at a different
 * resolution changes none of it.
 *
 * Three things hold this together:
 *
 * **1. The scroll flies it.** The route draws itself from Berlin across the
 * card's whole window, and the traveller rides the drawing head with a comet
 * tail behind it — so the one moving thing in the piece is the thing you are
 * moving. Scrolling back up flies it home. Only once it has landed does the
 * route start running a loop of its own.
 *
 * **2. He leaves the country.** Maastricht is the far side of a border, which is
 * the actual content of this card, so the crossing is a beat: the exact point
 * where the flight path cuts the German outline is solved at load time, and a
 * gate flares there as the traveller passes through it. The Netherlands is drawn
 * (faintly) for the same reason — otherwise the destination is a dot in a void.
 *
 * **3. It is a map on a table, not wallpaper.** The whole thing is tipped back
 * and the arc rises OUT of the map plane, so the flight has altitude over its
 * own ground track rather than being a curve drawn on flat paper. Placement is
 * tunable (dev panel → the milestone), because where it sits relative to the
 * head is art direction, and the head swerves across this chapter.
 */
const props = withDefaults(defineProps<SetPieceProps>(), {
  reveal: 0,
  variant: "",
  position: () => [0, 0, 0],
  cardProgress: undefined,
});

const { pointer } = usePointer();
const { reducedMotion } = usePreferences();
const { height } = useWindowSize();

const WARM = "#ffd479";
const HOT = "#fff4d6";

// --- The map ------------------------------------------------------------------
const SVG_URL = "/setpieces/germany.svg";
/** World size the normalised drawing's LONGEST side is scaled to. */
const TARGET_SIZE = 1.0;
/** Must match the generator script's projection, or the cities drift off the
 *  coastline. Both numbers are repeated in a comment at the top of the SVG. */
const LON_SCALE = 62.932;
const LAT_SCALE = 100;

const BERLIN = { lat: 52.52, lon: 13.405 };
const MAASTRICHT = { lat: 50.851, lon: 5.691 };

// --- The flight ---------------------------------------------------------------
/** How far the arc bows out of the map plane, as a share of the route's length.
 *  Baked into the geometry, so a constant rather than a tunable. */
const ARC_BOW = 0.34;
const ARC_SEGMENTS = 64;
const DROP_EVERY = 8; // one altitude line down to the ground track every N
const TAIL = 6;
const RING_SEGMENTS = 18;
const RING_R = 0.03;

// Assembly, in card-local progress. Finished by ~0.72: `reveal` starts fading
// the piece out at 0.75, and a part still drawing while it dims reads as a glitch.
const GRID_START = 0.02;
const GRID_WINDOW = 0.12;
const NEIGHBOUR_START = 0.06;
const NEIGHBOUR_WINDOW = 0.2;
const COUNTRY_START = 0.08;
const COUNTRY_WINDOW = 0.26;
const MARKER_START = 0.24;
const MARKER_WINDOW = 0.08;
const FLY_START = 0.3;
const FLY_WINDOW = 0.42;

/** How wide (in route parameter) the gate flares around the crossing. */
const GATE_SIGMA = 0.05;
const GATE_SIZE = 0.05;

// Placement is art direction — and unlike the other pieces this one has to sit
// somewhere sensible relative to a head that SWERVES across this chapter, so it
// gets the same live-tunable treatment as the Berlin skyline.
const tune = useTuning("routeArc", "The move — map");
// Default: low and pushed back, so the map lies out UNDER the head rather than
// across its face. This piece draws on top of the ASCII pass (it is not in
// `OCCLUDED_PIECES`), so where it sits is the only thing keeping a whole country
// outline off the face — hence the gizmo.
const anchor = tune.vec3(
  "anchor",
  { x: 0, y: -0.34, z: -0.5 },
  { min: -2, max: 2, step: 0.01, label: "Map centre (world)", gizmo: true }
);
const mapScale = tune.num("scale", 0.85, { min: 0.3, max: 2.5, step: 0.05, label: "Scale" });
const tilt = tune.num("tilt", 0.6, { min: 0, max: 1.4, step: 0.01, label: "Table tilt (radians)" });
const yawAmount = tune.num("parallax", 0.22, { min: 0, max: 1, step: 0.01, label: "Cursor yaw (radians)" });

// ---------------------------------------------------------------------------
// Build (once the SVG lands)
// ---------------------------------------------------------------------------
type Role = "graticule" | "neighbour" | "country";

const roleOf = (id: string): Role => {
  const s = id.toLowerCase();
  if (s.startsWith("grat")) return "graticule";
  if (s.startsWith("nl")) return "neighbour";
  return "country";
};

/** Nearest ancestor id, so a path inside a `<g id>` still finds its label. */
const groupIdOf = (node: Element | null | undefined): string | null => {
  let n: Node | null | undefined = node;
  while (n && n.nodeType === 1) {
    const id = (n as Element).getAttribute?.("id");
    if (id) return id;
    n = n.parentNode;
  }
  return null;
};

interface MapLayer {
  field: LineField;
  drawAt: number;
  drawWindow: number;
  base: number;
}

const layers = shallowRef<MapLayer[]>([]);
const route = shallowRef<LineField | null>(null);
const track = shallowRef<LineField | null>(null);
const markers = shallowRef<LineField | null>(null);
/** Berlin, Maastricht, the traveller, and its tail. */
const dots = createDots(2 + 1 + TAIL, { color: WARM, hot: HOT });
const TRAVELLER = 2;
/** The border gate, flashed as the traveller crosses out of Germany. */
const gate = createLinkPool(2, { color: HOT });

const groupRef = shallowRef<Group | null>(null);
const stageRef = shallowRef<Group | null>(null);
let disposed = false;

// Route endpoints and control point, in normalised map space. Written at build
// time, read every frame — never reallocated (issue #4).
const A = [0, 0, 0];
const B = [0, 0, 0];
const C = [0, 0, 0];
/** Route parameter at which the flight path crosses the German border. */
let gateT = 0.82;
const gateAt = [0, 0];
const gateDir = [0, 0];

/** Quadratic bezier: the flight, bowing out of the map plane on z. */
const routeAt = (t: number, out: number[]) => {
  const u = 1 - t;
  out[0] = u * u * A[0]! + 2 * u * t * C[0]! + t * t * B[0]!;
  out[1] = u * u * A[1]! + 2 * u * t * C[1]! + t * t * B[1]!;
  out[2] = u * u * A[2]! + 2 * u * t * C[2]! + t * t * B[2]!;
};
/** The same flight flattened onto the map — its ground track. */
const trackAt = (t: number, out: number[]) => {
  out[0] = A[0]! + (B[0]! - A[0]!) * t;
  out[1] = A[1]! + (B[1]! - A[1]!) * t;
  out[2] = 0;
};

const p0: number[] = [0, 0, 0];
const p1: number[] = [0, 0, 0];

const buildFromSvg = (paths: ReturnType<SVGLoader["parse"]>["paths"]) => {
  // 1) Flatten every sub-path to a polyline, bucketed by role, tracking the
  //    drawing's bounds — the cities get normalised through the same numbers.
  const buckets: Record<Role, number[][]> = {
    graticule: [],
    neighbour: [],
    country: [],
  };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const path of paths) {
    const node = (path.userData as { node?: Element } | undefined)?.node;
    const role = roleOf(groupIdOf(node) ?? "country");
    for (const sub of path.subPaths) {
      // The art is straight-line segments, so one sample per vertex is exact.
      const pts = sub.getPoints(1);
      if (pts.length < 2) continue;
      const flat: number[] = [];
      for (const p of pts) {
        flat.push(p.x, p.y);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      buckets[role].push(flat);
    }
  }
  if (!Number.isFinite(minX)) return;

  // 2) The normalisation — and the ONLY bridge between the artwork and real
  //    coordinates. Y flips because SVG runs y down and three runs it up.
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const s = TARGET_SIZE / (Math.max(maxX - minX, maxY - minY) || 1);
  const tx = (x: number) => (x - cx) * s;
  const ty = (y: number) => -(y - cy) * s;
  /** A real place, on the map, from its real coordinates. */
  const project = (lat: number, lon: number, out: number[]) => {
    out[0] = tx(lon * LON_SCALE);
    out[1] = ty(-lat * LAT_SCALE);
    out[2] = 0;
  };

  // 3) One buffer per role. Polylines are emitted in the order the generator
  //    wrote them, which for a coastline is the order a pen would trace it — so
  //    the draw-on walks the border rather than sparkling it on.
  const SCHEDULE: Record<Role, { drawAt: number; drawWindow: number; base: number }> = {
    graticule: { drawAt: GRID_START, drawWindow: GRID_WINDOW, base: 0.16 },
    neighbour: { drawAt: NEIGHBOUR_START, drawWindow: NEIGHBOUR_WINDOW, base: 0.3 },
    country: { drawAt: COUNTRY_START, drawWindow: COUNTRY_WINDOW, base: 0.72 },
  };
  const built: MapLayer[] = [];
  for (const role of ["graticule", "neighbour", "country"] as Role[]) {
    const segs: number[] = [];
    for (const flat of buckets[role]) {
      for (let i = 0; i < flat.length / 2 - 1; i++) {
        segs.push(
          tx(flat[i * 2]!), ty(flat[i * 2 + 1]!), 0,
          tx(flat[(i + 1) * 2]!), ty(flat[(i + 1) * 2 + 1]!), 0
        );
      }
    }
    if (!segs.length) continue;
    built.push({
      field: createLines(new Float32Array(segs), { color: WARM }),
      ...SCHEDULE[role],
    });
  }
  layers.value = built;

  // 4) The flight. Endpoints are the two cities; the control point lifts the
  //    midpoint out of the map plane, so the arc has altitude over its own
  //    ground track instead of being a curve drawn on the paper.
  project(BERLIN.lat, BERLIN.lon, A);
  project(MAASTRICHT.lat, MAASTRICHT.lon, B);
  const span = Math.hypot(B[0]! - A[0]!, B[1]! - A[1]!);
  C[0] = (A[0]! + B[0]!) / 2;
  C[1] = (A[1]! + B[1]!) / 2;
  C[2] = span * ARC_BOW * 2; // *2: a quadratic bezier only reaches half its control

  // 5) Where the flight actually leaves Germany. Solved against the REAL
  //    outline — the same points just drawn — rather than guessed at, so the
  //    gate sits on the border however the coastline is re-cut. The LAST
  //    crossing is the one that matters: that is the one he did not come back
  //    through.
  {
    const ax = A[0]!;
    const ay = A[1]!;
    const bx = B[0]! - ax;
    const by = B[1]! - ay;
    let best = -1;
    for (const flat of buckets.country) {
      for (let i = 0; i < flat.length / 2 - 1; i++) {
        const px = tx(flat[i * 2]!);
        const py = ty(flat[i * 2 + 1]!);
        const qx = tx(flat[(i + 1) * 2]!) - px;
        const qy = ty(flat[(i + 1) * 2 + 1]!) - py;
        const den = bx * qy - by * qx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((px - ax) * qy - (py - ay) * qx) / den;
        const u = ((px - ax) * by - (py - ay) * bx) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        if (t > best) {
          best = t;
          gateAt[0] = ax + bx * t;
          gateAt[1] = ay + by * t;
          // The gate's bar stands ACROSS the border it sits on.
          const len = Math.hypot(qx, qy) || 1;
          gateDir[0] = qx / len;
          gateDir[1] = qy / len;
        }
      }
    }
    if (best >= 0) gateT = best;
  }

  // 6) Route and ground track, both written in flight order so one draw
  //    fraction flies them together.
  const arc: number[] = [];
  const ground: number[] = [];
  for (let i = 0; i < ARC_SEGMENTS; i++) {
    routeAt(i / ARC_SEGMENTS, p0);
    routeAt((i + 1) / ARC_SEGMENTS, p1);
    arc.push(p0[0]!, p0[1]!, p0[2]!, p1[0]!, p1[1]!, p1[2]!);
    trackAt(i / ARC_SEGMENTS, p0);
    trackAt((i + 1) / ARC_SEGMENTS, p1);
    ground.push(p0[0]!, p0[1]!, 0, p1[0]!, p1[1]!, 0);
    if (i % DROP_EVERY === DROP_EVERY - 1) {
      routeAt((i + 1) / ARC_SEGMENTS, p0);
      ground.push(p0[0]!, p0[1]!, p0[2]!, p0[0]!, p0[1]!, 0);
    }
  }
  route.value = createLines(new Float32Array(arc), { color: WARM });
  track.value = createLines(new Float32Array(ground), { color: WARM });

  // 7) City markers: a ring with a crosshair through it, lying on the map.
  {
    const segs: number[] = [];
    for (const city of [BERLIN, MAASTRICHT]) {
      project(city.lat, city.lon, p0);
      const mx = p0[0]!;
      const my = p0[1]!;
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const a0 = (i / RING_SEGMENTS) * Math.PI * 2;
        const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
        segs.push(
          mx + Math.cos(a0) * RING_R, my + Math.sin(a0) * RING_R, 0.002,
          mx + Math.cos(a1) * RING_R, my + Math.sin(a1) * RING_R, 0.002
        );
      }
      segs.push(mx - RING_R * 1.9, my, 0.002, mx - RING_R * 0.7, my, 0.002);
      segs.push(mx + RING_R * 0.7, my, 0.002, mx + RING_R * 1.9, my, 0.002);
      segs.push(mx, my + RING_R * 0.7, 0.002, mx, my + RING_R * 1.9, 0.002);
      segs.push(mx, my - RING_R * 1.9, 0.002, mx, my - RING_R * 0.7, 0.002);
    }
    markers.value = createLines(new Float32Array(segs), { color: WARM });
  }

  // The city dots sit on the cities themselves.
  project(BERLIN.lat, BERLIN.lon, p0);
  dots.position[0] = p0[0]!;
  dots.position[1] = p0[1]!;
  dots.position[2] = 0.004;
  project(MAASTRICHT.lat, MAASTRICHT.lon, p0);
  dots.position[3] = p0[0]!;
  dots.position[4] = p0[1]!;
  dots.position[5] = 0.004;
  dots.size[0] = 0.085;
  dots.size[1] = 0.085;
  dots.size[TRAVELLER] = 0.11;
  for (let i = 0; i < TAIL; i++) dots.size[TRAVELLER + 1 + i] = 0.08 * (1 - i / TAIL);
  dots.flush({ size: true });
};

onMounted(() => {
  const loader = new SVGLoader();
  loader.load(
    SVG_URL,
    (data) => {
      if (!disposed) buildFromSvg(data.paths);
    },
    undefined,
    (err) => console.warn(`[RouteArc] could not load ${SVG_URL}`, err)
  );
});

// Component-scoped loop state: written every frame, never allocated (issue #4).
let curX = 0;
let curY = 0;

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const group = groupRef.value;
  const stage = stageRef.value;
  const arc = route.value;
  const ground = track.value;
  const rings = markers.value;
  if (!group || !stage) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001 && layers.value.length > 0;
  if (!group.visible || !arc || !ground || !rings) return;

  const still = reducedMotion.value;
  const drive = props.cardProgress ?? reveal;
  setDotScale(dots, height.value);

  // Placement, written imperatively from the tunables (reading a reactive number
  // per frame is fine; patching a reactive prop is not).
  const ease = approach(0.07, delta);
  curX += ((still ? 0 : pointer.value.x) - curX) * ease;
  curY += ((still ? 0 : pointer.value.y) - curY) * ease;
  stage.position.set(anchor.x, anchor.y, anchor.z);
  stage.scale.setScalar(mapScale.value * (0.96 + 0.04 * reveal));
  // Tipped back like a map on a table, and turned toward the pointer — which is
  // what gives the arc's altitude something to read against.
  stage.rotation.set(-tilt.value + curY * 0.12, curX * yawAmount.value, 0);

  // --- The flight -----------------------------------------------------------
  // `flown` is how much of the route the SCROLL has drawn; the traveller sits on
  // the drawing head, so the dot and the line are the same event.
  const flown = smoothstep(FLY_START, FLY_START + FLY_WINDOW, drive);
  const landed = smoothstep(0.97, 1, flown);
  const loop = still ? 0.55 : (elapsed * 0.2) % 1;
  const head = flown < 1 ? flown : landed * loop + (1 - landed) * flown;

  routeAt(head, p0);
  dots.position[TRAVELLER * 3] = p0[0]!;
  dots.position[TRAVELLER * 3 + 1] = p0[1]!;
  dots.position[TRAVELLER * 3 + 2] = p0[2]!;
  dots.glow[TRAVELLER] = 1;
  for (let i = 0; i < TAIL; i++) {
    // The tail hangs back ALONG the route: a comet following a curve is the
    // cheapest way to show that the curve is a path.
    const t = clamp01(head - (i + 1) * 0.02);
    routeAt(t, p1);
    const o = (TRAVELLER + 1 + i) * 3;
    dots.position[o] = p1[0]!;
    dots.position[o + 1] = p1[1]!;
    dots.position[o + 2] = p1[2]!;
    dots.glow[TRAVELLER + 1 + i] = (1 - i / TAIL) * 0.7 * (t > 0.001 ? 1 : 0);
  }

  const marked = smoothstep(MARKER_START, MARKER_START + MARKER_WINDOW, drive);
  dots.glow[0] = (0.75 - 0.35 * flown) * marked; // Berlin dims as he leaves
  dots.glow[1] = (0.35 + 0.65 * landed) * marked; // Maastricht lights as he lands
  dots.flush();

  // --- The border -----------------------------------------------------------
  // A gate on the border exactly where the route cuts it, flaring as the
  // traveller goes through. This is the card's whole subject: the move was OUT
  // of the country, not across it.
  const d = (head - gateT) / GATE_SIGMA;
  const crossing = head > 0.02 ? Math.exp(-0.5 * d * d) : 0;
  gate.begin();
  if (crossing > 0.01) {
    const gx = gateDir[0]! * GATE_SIZE;
    const gy = gateDir[1]! * GATE_SIZE;
    gate.push(
      gateAt[0]! + gx, gateAt[1]! + gy, 0.004,
      gateAt[0]! - gx, gateAt[1]! - gy, 0.004
    );
    // A post standing up off the map, so the gate reads at the arc's altitude
    // and not only on the ground.
    gate.push(gateAt[0]!, gateAt[1]!, 0.004, gateAt[0]!, gateAt[1]!, C[2]! * 0.45);
  }
  gate.end();

  // --- Ink ------------------------------------------------------------------
  for (const layer of layers.value) {
    const t = smoothstep(layer.drawAt, layer.drawAt + layer.drawWindow, drive);
    drawFraction(layer.field.geometry, layer.field.vertexCount, t);
    layer.field.material.opacity = layer.base * reveal;
  }
  drawFraction(rings.geometry, rings.vertexCount, marked);
  drawFraction(arc.geometry, arc.vertexCount, flown);
  drawFraction(ground.geometry, ground.vertexCount, flown);
  rings.material.opacity = 0.8 * reveal;
  arc.material.opacity = 0.9 * reveal;
  ground.material.opacity = 0.3 * reveal;
  gate.material.opacity = 0.9 * crossing * reveal;
  dots.material.uniforms.uOpacity!.value = reveal;
});

onBeforeUnmount(() => {
  disposed = true;
  for (const layer of layers.value) layer.field.dispose();
  route.value?.dispose();
  track.value?.dispose();
  markers.value?.dispose();
  dots.dispose();
  gate.dispose();
});
</script>

<template>
  <!-- Outer group: the slot position SceneSetPieces assigns. Inner "stage":
       the map's placement, scale and tilt, written imperatively in the loop. -->
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <TresGroup ref="stageRef">
      <primitive
        v-for="(layer, i) in layers"
        :key="`layer-${i}`"
        :object="layer.field.lines"
      />
      <primitive v-if="track" :object="track.lines" />
      <primitive v-if="markers" :object="markers.lines" />
      <primitive v-if="route" :object="route.lines" />
      <primitive :object="gate.lines" />
      <primitive :object="dots.points" />
    </TresGroup>
  </TresGroup>
</template>
