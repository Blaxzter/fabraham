<script setup lang="ts">
import { shallowRef, onMounted, onBeforeUnmount } from "vue";
import { useLoop } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  clusterLogos,
  SKILL_CLUSTERS,
  SKILL_TRAVEL_EDGE,
  skillTravel,
  skillX,
} from "../sections/skills";

/**
 * The "skills" chapter's backdrop: the real brand marks of the stack, drawn as
 * LINE ART behind the head, over a conveyor that reads in two directions at once.
 *
 * The marks are official SVGs vendored into `public/setpieces/logos/` (see the
 * README there for provenance and trademark note). We load them with three's
 * `SVGLoader` and stroke each glyph's OUTLINE as LineSegments — the same
 * SVG→3D-lines approach BerlinSkyline uses, and required here for the same
 * reason: the ASCII post-process only resolves lines, so a filled logo would
 * turn to mush (see docs/scroll-3d-architecture.md → set-piece contract).
 *
 * Everything is scroll-driven off ONE source — `sections/skills.ts`, the same
 * module the DOM cards and the head's gaze read. Two axes carry two meanings:
 *
 *   HORIZONTAL — the stack conveyor. A cluster's logos ride in while its card is
 *   on stage, each DRAWING ITSELF IN segment by segment (`setDrawRange`, the 3D
 *   equivalent of animating `stroke-dashoffset`), staggered so they assemble one
 *   after another. Dots stream along the rails, mostly scroll-driven with a
 *   little autonomous drift so a parked belt still breathes. Gates flare as the
 *   on-stage card passes over them.
 *
 *   VERTICAL — page descent. A ladder of faint rungs streams UPWARD and wraps as
 *   you scroll down, and each cluster's logos rise as their card crosses. Without
 *   this the whole chapter moved sideways only, and nothing said "you are still
 *   going down the page".
 *
 * Listed in OCCLUDED_PIECES, so the head stamps itself into the depth buffer
 * first and the logos pass visibly BEHIND it.
 */
interface Props {
  reveal?: number;
  variant?: string;
  position?: [number, number, number];
}
const props = withDefaults(defineProps<Props>(), {
  reveal: 0,
  variant: "",
  position: () => [0, 0, 0],
});

const store = useSectionsStore();

const AMBER = new Color("#ffb454");
const HOT = new Color("#fff3d6"); // what a mark tints toward at full attention

// ---- conveyor ---------------------------------------------------------------
// Three lanes, deeper ones wider. Logos sit ON these lanes, round-robin.
const RAILS = [
  { y: 0.44, z: -0.5, halfW: 2.2, dots: 14, speed: 0.55 },
  { y: -0.02, z: -0.95, halfW: 2.8, dots: 18, speed: 0.38 },
  { y: -0.46, z: -1.4, halfW: 3.4, dots: 22, speed: 0.26 },
];
/** Roughly where the camera sits during this chapter (skillsCameraKeyframes).
 *  Only used to even out the lanes: a mark on a deeper lane needs proportionally
 *  MORE world x to land at the same place on screen, so without this the row
 *  fans out — near marks shoot off the edge while far ones bunch up centre. */
const CAM_REF_Z = 1.66;
const laneSpread = (z: number) => (CAM_REF_Z - z) / (CAM_REF_Z - RAILS[0]!.z);

const TICKS_PER_RAIL = 5;
const TICK_HEIGHT = 0.07;
const FLARE = 3.4;
const FLARE_WIDTH = 0.34;

/** World units the dot belt travels over one pass of the section's scroll. */
const SCROLL_TRAVEL = 16;
/** Autonomous drift (units/s) layered on top, so the belt is alive when parked. */
const DRIFT = 0.12;

// ---- the descent gauge ------------------------------------------------------
// Two vertical guides near the frame edges with depth markers streaming up them,
// like passing floor markers in a shaft. Scattered rungs just read as more stray
// lines among the rails; a pair of columns reads unmistakably as "descending".
const RUNG_PER_SIDE = 7;
const RUNG_COUNT = RUNG_PER_SIDE * 2;
const RUNG_HALF = 0.14; // half-length of a marker
const RUNG_X = 1.62; // near the frame edge, clear of the head and the logos
const RUNG_Z = -1;
/** Vertical span the gauge cycles through before wrapping. */
const RUNG_SPAN = 3.4;
/** World units the gauge rises over one pass of the section's scroll. */
const RUNG_RISE = 7.5;
const RUNG_DRIFT = 0.03;

// ---- logos ------------------------------------------------------------------
const LOGO_URL = (name: string) => `/setpieces/logos/${name}.svg`;
/** World size the longest edge of a mark is scaled to. */
const LOGO_SIZE = 0.3;
/** Horizontal gap between marks in a cluster's row. */
const LOGO_GAP = 0.45;
/** Half-width of the screen column the head occupies, in lane-0 world units.
 *  The row is laid out with a GAP here rather than evenly: the centre column is
 *  unusable (the head fills it, and above it is where the cards fly), so a mark
 *  placed at x=0 would be hidden at exactly the moment its card is centred. */
const HEAD_CLEAR = 0.5;
/** Curve sampling. Low on purpose: these are small on screen and quantized by
 *  the ASCII pass, so more points buy nothing but buffer. */
const CURVE_DIVISIONS = 8;
/** Share of a card's run each mark takes to draw itself in, and the delay
 *  between consecutive marks starting. Deliberately generous — a short window
 *  makes a logo appear fully formed between two notches of a mouse wheel. */
const DRAW_WINDOW = 0.46;
const DRAW_STAGGER = 0.04;
const DRAW_START = 0.05;
/** How far the logo row drifts across, in world units — a fraction of the card's
 *  own sweep, so the backdrop parallaxes gently instead of tracking the card off
 *  the edge of the frame with it. */
const PARALLAX = 0.8;
/** How far a cluster's marks rise as their card crosses (world units). */
const LOGO_RISE = 0.3;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

interface Logo {
  group: Group;
  line: LineSegments;
  geometry: BufferGeometry;
  material: LineBasicMaterial;
  /** Total vertices, so drawRange can reveal a fraction of the outline. */
  vertexCount: number;
  /** Index within its cluster — drives the assembly stagger and the row slot. */
  slot: number;
  cluster: number;
  homeX: number;
  homeY: number;
  /** Perspective compensation for this mark's lane depth. */
  spread: number;
}

const logos = shallowRef<Logo[]>([]);
const groupRef = shallowRef<Group | null>(null);
let disposed = false;

// Deterministic PRNG so layout is stable across reloads.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(RAILS.length * 7919 + props.variant.length * 101 + 29);

// ---- static conveyor geometry ----
const railPositions: number[] = [];
for (const r of RAILS) railPositions.push(-r.halfW, r.y, r.z, r.halfW, r.y, r.z);
// The two vertical guides of the descent gauge — static; the markers move.
for (const side of [-1, 1]) {
  railPositions.push(side * RUNG_X, -RUNG_SPAN / 2, RUNG_Z, side * RUNG_X, RUNG_SPAN / 2, RUNG_Z);
}

const railGeometry = new BufferGeometry();
railGeometry.setAttribute(
  "position",
  new BufferAttribute(new Float32Array(railPositions), 3)
);
const railMaterial = new LineBasicMaterial({
  color: AMBER,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const rails = new LineSegments(railGeometry, railMaterial);
rails.frustumCulled = false;

const tickPositions: number[] = [];
const tickX: number[] = [];
const tickHalfW: number[] = [];
for (const r of RAILS) {
  for (let i = 0; i < TICKS_PER_RAIL; i++) {
    const x = -r.halfW + ((i + 0.5) / TICKS_PER_RAIL) * (r.halfW * 2);
    tickPositions.push(x, r.y - TICK_HEIGHT, r.z, x, r.y + TICK_HEIGHT, r.z);
    tickX.push(x);
    tickHalfW.push(r.halfW);
  }
}
const tickCount = tickX.length;
const tickGeometry = new BufferGeometry();
tickGeometry.setAttribute(
  "position",
  new BufferAttribute(new Float32Array(tickPositions), 3)
);
const tickColorArray = new Float32Array(tickCount * 2 * 3).fill(1);
const tickColorAttribute = new BufferAttribute(tickColorArray, 3);
tickGeometry.setAttribute("color", tickColorAttribute);
const tickMaterial = new LineBasicMaterial({
  // Multiplied by the per-vertex brightness below, so the gates stay amber and
  // just get hotter (values above 1 blow out to white, which is the point).
  color: AMBER,
  vertexColors: true,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const ticks = new LineSegments(tickGeometry, tickMaterial);
ticks.frustumCulled = false;

// ---- descent ladder: rungs that stream upward and wrap ----
const rungArray = new Float32Array(RUNG_COUNT * 2 * 3);
const rungColorArray = new Float32Array(RUNG_COUNT * 2 * 3);
const rungBaseY = new Float32Array(RUNG_COUNT);
for (let i = 0; i < RUNG_COUNT; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const step = Math.floor(i / 2);
  const x = side * RUNG_X;
  // Markers point inward from their guide, alternating length a little so the
  // column has some rhythm instead of reading as a ruler.
  const half = RUNG_HALF * (step % 2 === 0 ? 1 : 0.6);
  const o = i * 6;
  rungArray[o] = x;
  rungArray[o + 2] = RUNG_Z;
  rungArray[o + 3] = x - side * half * 2;
  rungArray[o + 5] = RUNG_Z;
  // Evenly spaced up the column, the two sides offset by half a step so they
  // alternate rather than marching in lockstep.
  rungBaseY[i] =
    ((step + (side > 0 ? 0.5 : 0)) / RUNG_PER_SIDE) * RUNG_SPAN;
}
const rungGeometry = new BufferGeometry();
const rungAttribute = new BufferAttribute(rungArray, 3);
rungGeometry.setAttribute("position", rungAttribute);
const rungColorAttribute = new BufferAttribute(rungColorArray, 3);
rungGeometry.setAttribute("color", rungColorAttribute);
const rungMaterial = new LineBasicMaterial({
  color: AMBER,
  vertexColors: true,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const rungs = new LineSegments(rungGeometry, rungMaterial);
rungs.frustumCulled = false;

// ---- the dot belt ----
const dotCount = RAILS.reduce((a, r) => a + r.dots, 0);
const dotArray = new Float32Array(dotCount * 3);
const dotHalfW = new Float32Array(dotCount);
const dotSpeed = new Float32Array(dotCount);
const dotOffset = new Float32Array(dotCount);
{
  let k = 0;
  for (const r of RAILS) {
    for (let i = 0; i < r.dots; i++) {
      dotArray[k * 3 + 0] = r.halfW;
      dotArray[k * 3 + 1] = r.y;
      dotArray[k * 3 + 2] = r.z;
      dotHalfW[k] = r.halfW;
      // A little jitter per dot so the belt isn't a metronome.
      dotSpeed[k] = r.speed * (0.85 + rand() * 0.3);
      dotOffset[k] = rand() * r.halfW * 2;
      k++;
    }
  }
}
const dotGeometry = new BufferGeometry();
const dotAttribute = new BufferAttribute(dotArray, 3);
dotGeometry.setAttribute("position", dotAttribute);
const dotMaterial = new PointsMaterial({
  color: AMBER,
  size: 0.055,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const dots = new Points(dotGeometry, dotMaterial);
dots.frustumCulled = false;

// ---- SVG → outline segments -------------------------------------------------
/**
 * Flatten every sub-path of a parsed mark into centred, uniformly scaled line
 * segments. Simple Icons ship one filled glyph path per file, so stroking the
 * outline is exactly the line art we want.
 */
const buildLogo = (
  paths: ReturnType<SVGLoader["parse"]>["paths"]
): { positions: Float32Array } | null => {
  const polylines: number[][] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const path of paths) {
    for (const sub of path.subPaths) {
      const pts = sub.getPoints(CURVE_DIVISIONS);
      if (pts.length < 2) continue;
      const flat: number[] = [];
      for (const p of pts) {
        flat.push(p.x, p.y);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      polylines.push(flat);
    }
  }
  if (!polylines.length || !Number.isFinite(minX)) return null;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = LOGO_SIZE / (Math.max(maxX - minX, maxY - minY) || 1);

  const segs: number[] = [];
  for (const flat of polylines) {
    const count = flat.length / 2;
    for (let i = 0; i < count - 1; i++) {
      segs.push(
        (flat[i * 2]! - cx) * scale,
        // flip Y: SVG is y-down, three is y-up.
        -(flat[i * 2 + 1]! - cy) * scale,
        0,
        (flat[(i + 1) * 2]! - cx) * scale,
        -(flat[(i + 1) * 2 + 1]! - cy) * scale,
        0
      );
    }
  }
  if (!segs.length) return null;
  return { positions: new Float32Array(segs) };
};

onMounted(async () => {
  const loader = new SVGLoader();
  const built: Logo[] = [];

  await Promise.all(
    SKILL_CLUSTERS.flatMap((cluster, ci) => {
      const names = clusterLogos(cluster);
      return names.map(async (name, slot) => {
        try {
          const data = await loader.loadAsync(LOGO_URL(name));
          if (disposed) return;
          const shape = buildLogo(data.paths);
          if (!shape) return;

          const geometry = new BufferGeometry();
          geometry.setAttribute("position", new BufferAttribute(shape.positions, 3));
          const vertexCount = shape.positions.length / 3;
          geometry.setDrawRange(0, 0);

          const material = new LineBasicMaterial({
            color: AMBER.clone(), // per-logo clone: each tints on its own
            transparent: true,
            opacity: 0,
            blending: AdditiveBlending,
            depthWrite: false,
          });
          const line = new LineSegments(geometry, material);
          line.frustumCulled = false;

          const lane = RAILS[slot % RAILS.length]!;
          const n = names.length;
          const spread = laneSpread(lane.z);
          const g = new Group();
          // Flank the head rather than crossing it: marks step outward from the
          // clear zone on whichever side they fall.
          const t = slot - (n - 1) / 2;
          const homeX =
            Math.sign(t || 1) * (HEAD_CLEAR + Math.abs(t) * LOGO_GAP) * spread;
          const homeY = lane.y;
          // Deeper lanes read smaller under perspective; scale them up so every
          // mark is about the same size on screen.
          g.scale.setScalar(spread);
          g.position.set(homeX, homeY, lane.z);
          g.add(line);

          built.push({
            group: g,
            line,
            geometry,
            material,
            vertexCount,
            slot,
            cluster: ci,
            homeX,
            homeY,
            spread,
          });
        } catch (err) {
          console.warn(`[StackLogos] could not load ${LOGO_URL(name)}`, err);
        }
      });
    })
  );

  if (!disposed) logos.value = built;
});

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;
  group.scale.setScalar(0.85 + 0.15 * reveal);
  railMaterial.opacity = 0.3 * reveal;
  tickMaterial.opacity = 0.46 * reveal;
  rungMaterial.opacity = 0.4 * reveal;
  dotMaterial.opacity = 0.95 * reveal;

  // The one scroll signal this whole chapter runs on.
  const flow = store.localFracAt("skills", store.progress);
  const n = SKILL_CLUSTERS.length;

  // --- horizontal: the dot belt (mostly scroll, a little of its own) ---
  const travel = flow * SCROLL_TRAVEL + elapsed * DRIFT;
  for (let i = 0; i < dotCount; i++) {
    const span = dotHalfW[i]! * 2;
    // Travel from +halfW to -halfW, then wrap — right to left, like the cards.
    const d = (travel * dotSpeed[i]! + dotOffset[i]!) % span;
    dotArray[i * 3] = dotHalfW[i]! - d;
  }
  dotAttribute.needsUpdate = true;

  // --- vertical: the descent ladder ---
  // Rungs rise as `flow` grows, so scrolling DOWN sends them up past you. Each
  // fades at the top and bottom of its cycle so the wrap never pops.
  const lift = flow * RUNG_RISE + elapsed * RUNG_DRIFT;
  for (let i = 0; i < RUNG_COUNT; i++) {
    const cycle = (rungBaseY[i]! + lift) % RUNG_SPAN;
    const y = cycle - RUNG_SPAN / 2;
    const o = i * 6;
    rungArray[o + 1] = y;
    rungArray[o + 4] = y;
    const edge =
      smoothstep(0, 0.18, cycle / RUNG_SPAN) *
      (1 - smoothstep(0.82, 1, cycle / RUNG_SPAN));
    rungColorArray[o] = rungColorArray[o + 3] = edge;
    rungColorArray[o + 1] = rungColorArray[o + 4] = edge;
    rungColorArray[o + 2] = rungColorArray[o + 5] = edge;
  }
  rungAttribute.needsUpdate = true;
  rungColorAttribute.needsUpdate = true;

  // Which card is on stage, and where has it got to?
  let bestLit = 0;
  let bestX = 0;
  for (let i = 0; i < n; i++) {
    const u = skillTravel(i, n, flow);
    const lit = 1 - Math.abs(2 * u - 1);
    if (lit > bestLit) {
      bestLit = lit;
      bestX = skillX(u) / SKILL_TRAVEL_EDGE; // -1..1 across the stage
    }
  }

  // Gates flare under the card that is passing over them.
  for (let i = 0; i < tickCount; i++) {
    const d = (tickX[i]! - bestX * tickHalfW[i]!) / FLARE_WIDTH;
    const b = 1 + FLARE * bestLit * Math.exp(-d * d);
    const o = i * 6;
    tickColorArray[o] = tickColorArray[o + 3] = b;
    tickColorArray[o + 1] = tickColorArray[o + 4] = b;
    tickColorArray[o + 2] = tickColorArray[o + 5] = b;
  }
  tickColorAttribute.needsUpdate = true;

  for (const l of logos.value) {
    const u = skillTravel(l.cluster, n, flow);
    // Off stage entirely — skip the work and hide it.
    if (u <= 0.001 || u >= 0.999) {
      l.line.visible = false;
      continue;
    }
    l.line.visible = true;

    // Assemble one after another: each mark starts drawing a beat after the one
    // before it, over a generous share of the card's run.
    const start = DRAW_START + l.slot * DRAW_STAGGER;
    const draw = smoothstep(start, start + DRAW_WINDOW, u);
    l.geometry.setDrawRange(0, Math.floor((l.vertexCount / 2) * draw) * 2);

    // Brightest as the card centres; retract on the way out. The fade starts
    // late enough that the last mark has finished drawing before anything dims.
    const lit = smoothstep(0, 1, 1 - Math.abs(2 * u - 1));
    const out = 1 - smoothstep(0.86, 0.99, u);
    l.material.opacity = (0.3 + 0.6 * lit) * out * reveal;
    l.material.color.copy(AMBER).lerp(HOT, lit * 0.5);

    // Drift right→left with the card, but slower — parallax, not a second copy.
    // And RISE as it crosses, so the row agrees with the descent ladder.
    l.group.position.x = l.homeX + (0.5 - u) * 2 * PARALLAX * l.spread;
    l.group.position.y =
      l.homeY +
      (u - 0.5) * LOGO_RISE +
      Math.sin(elapsed * 0.5 + l.slot * 1.7) * 0.02;
  }
});

onBeforeUnmount(() => {
  disposed = true;
  railGeometry.dispose();
  railMaterial.dispose();
  tickGeometry.dispose();
  tickMaterial.dispose();
  rungGeometry.dispose();
  rungMaterial.dispose();
  dotGeometry.dispose();
  dotMaterial.dispose();
  for (const l of logos.value) {
    l.geometry.dispose();
    l.material.dispose();
  }
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive :object="rungs" />
    <primitive :object="rails" />
    <primitive :object="ticks" />
    <primitive :object="dots" />
    <primitive v-for="(l, i) in logos" :key="i" :object="l.group" />
  </TresGroup>
</template>
