<script setup lang="ts">
import { shallowRef, onBeforeUnmount } from "vue";
import { useWindowSize } from "@vueuse/core";
import { useLoop } from "@tresjs/core";
import type { Group } from "three";
import {
  approach,
  clamp01,
  createDots,
  createLinkPool,
  createLines,
  drawFraction,
  easeOutCubic,
  mulberry32,
  orderSegments,
  setDotScale,
  smoothstep,
  type SetPieceProps,
} from "./lineArt";

/**
 * The AI through-line's recurring motif: a LATENT SPACE you can watch being
 * queried. The same piece escalates across three chapters via `variant` —
 * GANs (Maastricht) → embeddings (Tatort) → retrieval (Experte).
 *
 * What this replaces, and why
 * ---------------------------
 * The first version was points scattered uniformly on a sphere, wired to
 * whatever happened to fall within a fixed radius, spinning at a constant rate.
 * Three things made it read as filler rather than as a picture of the work:
 *
 *   - **Uniform noise has no silhouette.** Every direction looked like every
 *     other, so the eye had nothing to hold. Real embedding spaces are lumpy —
 *     that lumpiness IS the information — so the nodes are drawn in CLUSTERS
 *     here, with negative space between them.
 *   - **Proximity wiring makes a hairball.** Connecting everything inside a
 *     radius produces a dense mat in the middle and strays at the edges. Each
 *     node instead wires to its k NEAREST neighbours, which is both what a
 *     k-NN index actually does and what draws filaments you can follow.
 *   - **A turntable is not an animation.** Nothing happened; the piece only
 *     rotated. Now a QUERY moves through the space, and on arrival its nearest
 *     neighbours light and wire back to it — a lookup, in the open. The `rag`
 *     variant adds the second half: the matches send citations back to the
 *     answer they are supporting.
 *
 * Assembly is driven by `cardProgress`, so the space builds itself cluster by
 * cluster as the card scrolls in and un-builds when you scroll back up; the
 * query runs on its own clock on top. See ./lineArt.ts for the shared moves.
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

/**
 * Per-variant character. Density and radius escalate along the story, but the
 * structural numbers matter more: `clusters` is how many distinct regions the
 * space has, and `topK` how many neighbours a query pulls back.
 *
 * The radii envelop the 2x head (the piece is centred on it), and the set-piece
 * overlay runs a head depth pre-pass, so the face sits INSIDE the cloud rather
 * than behind a flat veil.
 */
const VARIANTS = {
  // Two lobes, not clusters: a generator and a discriminator, and a query that
  // ping-pongs between them — the adversarial loop, which is the one thing a
  // GAN diagram has to show.
  gan: {
    nodes: 46, clusters: 2, radius: 1.35, k: 2, topK: 4,
    color: "#c4a0ff", hot: "#ffffff", period: 4.4, cite: false, lobes: true,
  },
  embeddings: {
    nodes: 76, clusters: 5, radius: 1.55, k: 3, topK: 5,
    color: "#7fe7ff", hot: "#ffffff", period: 3.4, cite: false, lobes: false,
  },
  rag: {
    nodes: 94, clusters: 7, radius: 1.75, k: 3, topK: 4,
    color: "#bfe9ff", hot: "#ffffff", period: 3.0, cite: true, lobes: false,
  },
  default: {
    nodes: 58, clusters: 4, radius: 1.45, k: 3, topK: 4,
    color: "#9ad1ff", hot: "#ffffff", period: 3.6, cite: false, lobes: false,
  },
} as const;

const cfg = VARIANTS[props.variant as keyof typeof VARIANTS] ?? VARIANTS.default;

// --- Assembly schedule, in card-local progress -------------------------------
// Finished by ~0.7: `reveal` starts fading the piece out at 0.75, and a cluster
// still arriving while it dims reads as a glitch.
const BUILD_START = 0.04;
const CLUSTER_STAGGER = 0.06; // one cluster's head start over the next
const NODE_WINDOW = 0.2; // how long one node takes to travel out to its place
const EDGE_START = 0.16;
const EDGE_WINDOW = 0.5;

// --- Query behaviour ---------------------------------------------------------
const ARRIVE_AT = 0.6; // fraction of a period spent travelling; the rest dwells
const FLARE_IN = 0.56;
const FLARE_HOLD = 0.72;
const FLARE_OUT = 0.98;
const GLOW_DECAY = 0.86; // per-frame afterglow falloff (at 60fps)
const CURSOR_YAW = 0.38;
const CURSOR_PITCH = 0.22;

// ---------------------------------------------------------------------------
// Build: clusters → nodes → k-NN edges
// ---------------------------------------------------------------------------
const rand = mulberry32(cfg.nodes * 9973 + props.variant.length * 131 + 7);

/** Cluster centres. Evenly spread (a Fibonacci sphere) rather than random, so
 *  no two regions overlap into one blob; the `gan` variant swaps in two lobes. */
const clusterCentres = (() => {
  const out: number[] = [];
  const n = cfg.clusters;
  if (cfg.lobes) {
    const d = cfg.radius * 0.72;
    out.push(-d, 0.04, 0, d, -0.04, 0);
    return out;
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const r = cfg.radius * 0.58;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out.push(Math.cos(theta) * ring * r, y * r * 0.82, Math.sin(theta) * ring * r);
  }
  return out;
})();

/** Roughly normal, from three uniforms: tight cores with a few strays, which is
 *  what a projected embedding cluster looks like. */
const gauss = () => (rand() + rand() + rand() - 1.5) * 0.9;

const N = cfg.nodes;
const home = new Float32Array(N * 3); // where a node ends up
const seat = new Float32Array(N * 3); // its cluster centre: where it starts
const nodeCluster = new Int32Array(N);
const nodeSize = new Float32Array(N);
const nodeBirth = new Float32Array(N);

{
  const spread = cfg.radius * 0.42;
  for (let i = 0; i < N; i++) {
    const c = i % cfg.clusters; // round-robin: every cluster stays populated
    const cx = clusterCentres[c * 3]!;
    const cy = clusterCentres[c * 3 + 1]!;
    const cz = clusterCentres[c * 3 + 2]!;
    home[i * 3] = cx + gauss() * spread;
    home[i * 3 + 1] = cy + gauss() * spread * 0.9;
    home[i * 3 + 2] = cz + gauss() * spread;
    seat[i * 3] = cx;
    seat[i * 3 + 1] = cy;
    seat[i * 3 + 2] = cz;
    nodeCluster[i] = c;
    // A handful of hubs per cluster. Hierarchy is most of what separates a graph
    // from a scatter, and it costs one attribute.
    const hub = i < cfg.clusters;
    nodeSize[i] = hub ? 0.16 : 0.055 + rand() * 0.045;
    nodeBirth[i] =
      BUILD_START + c * CLUSTER_STAGGER + (i / N) * 0.06 + rand() * 0.02;
  }
}

/**
 * Nearest neighbours per node, in order. The first `k` of them are the WIRING
 * (the filaments you can see); the first `topK` are the MATCH SET a query pulls
 * back. Those are different numbers on purpose — a lookup should return more
 * than the graph happens to have drawn, or every retrieval just re-lights the
 * lines already there.
 */
const NB = Math.max(cfg.k, cfg.topK);
const neighbours = new Int32Array(N * NB).fill(-1);
{
  const cand: { j: number; d: number }[] = [];
  for (let i = 0; i < N; i++) {
    cand.length = 0;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = home[i * 3]! - home[j * 3]!;
      const dy = home[i * 3 + 1]! - home[j * 3 + 1]!;
      const dz = home[i * 3 + 2]! - home[j * 3 + 2]!;
      cand.push({ j, d: dx * dx + dy * dy + dz * dz });
    }
    cand.sort((a, b) => a.d - b.d);
    for (let k = 0; k < NB; k++) neighbours[i * NB + k] = cand[k]?.j ?? -1;
  }
}

/** The static net: every k-NN pair once, plus one bridge per cluster pair so the
 *  regions read as one space instead of as separate islands. */
const netPositions = (() => {
  const seen = new Set<number>();
  const segs: number[] = [];
  const push = (a: number, b: number) => {
    const key = a < b ? a * N + b : b * N + a;
    if (seen.has(key)) return;
    seen.add(key);
    segs.push(
      home[a * 3]!, home[a * 3 + 1]!, home[a * 3 + 2]!,
      home[b * 3]!, home[b * 3 + 1]!, home[b * 3 + 2]!
    );
  };
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < cfg.k; k++) push(i, neighbours[i * NB + k]!);
  }
  // Bridges: hub of cluster c to hub of cluster c+1 (hubs are nodes 0..clusters-1).
  for (let c = 0; c < cfg.clusters; c++) push(c, (c + 1) % cfg.clusters);
  // Drawn in cluster order, so the net threads itself the same way the nodes
  // arrive rather than sparkling on at random.
  return orderSegments(new Float32Array(segs), (mx, my, mz) => {
    let best = Infinity;
    for (let c = 0; c < cfg.clusters; c++) {
      const dx = mx - clusterCentres[c * 3]!;
      const dy = my - clusterCentres[c * 3 + 1]!;
      const dz = mz - clusterCentres[c * 3 + 2]!;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) best = d + c * 100; // cluster index dominates, distance breaks ties
    }
    return best;
  });
})();

/** The query's itinerary: hubs and leaves in a fixed order. `gan` alternates
 *  lobes on purpose — the ping-pong IS the adversarial loop. */
const itinerary = (() => {
  const idx = Array.from({ length: N }, (_, i) => i);
  if (cfg.lobes) {
    const a = idx.filter((i) => nodeCluster[i] === 0);
    const b = idx.filter((i) => nodeCluster[i] === 1);
    const out: number[] = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) out.push(a[i]!, b[i]!);
    return out;
  }
  // Deterministic shuffle, then keep every third: consecutive stops land in
  // different clusters, so the query visibly crosses the space.
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.filter((_, i) => i % 3 === 0);
})();

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------
const net = createLines(netPositions, { color: cfg.color });
const nodes = createDots(N, { color: cfg.color, hot: cfg.hot });
const query = createDots(2, { color: cfg.hot, hot: cfg.hot }); // [query, answer]
/** Live wires: query→match, plus citations back to the answer in `rag`. */
const links = createLinkPool(cfg.topK * 2 + 2, { color: cfg.hot });

nodes.size.set(nodeSize);
nodes.flush({ size: true });

// The answer anchor the `rag` citations converge on: below and in front of the
// head, where it is clear of the face the cloud is wrapped around.
const ANSWER_Y = -cfg.radius * 0.86;
const ANSWER_Z = cfg.radius * 0.34;
// Small and hot beats big and blown out: additive blending already gives the
// query a halo, so a large point turns into a featureless white ball.
query.size[0] = 0.12;
query.size[1] = cfg.cite ? 0.15 : 0;
query.position[3] = 0;
query.position[4] = ANSWER_Y;
query.position[5] = ANSWER_Z;
query.flush({ size: true });

const groupRef = shallowRef<Group | null>(null);
// Component-scoped loop state: written every frame, never allocated (issue #4).
let spin = 0;
let curX = 0;
let curY = 0;

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;

  const still = reducedMotion.value;
  const drive = props.cardProgress ?? reveal;
  setDotScale(nodes, height.value);
  setDotScale(query, height.value);

  // --- Orientation ----------------------------------------------------------
  // Ambient drift plus a cursor response. The drift is slow and the cursor's
  // range is wide, so the cloud answers the pointer instead of just revolving.
  const ease = approach(0.07, delta);
  curX += ((still ? 0 : pointer.value.x) - curX) * ease;
  curY += ((still ? 0 : pointer.value.y) - curY) * ease;
  if (!still) spin += delta * 0.055;
  group.rotation.y = spin + curX * CURSOR_YAW;
  group.rotation.x = -curY * CURSOR_PITCH;
  group.scale.setScalar(0.9 + 0.1 * reveal);

  // --- Nodes travel out of their cluster centre to their place --------------
  const pos = nodes.position;
  const glow = nodes.glow;
  const decay = Math.pow(GLOW_DECAY, delta * 60);
  for (let i = 0; i < N; i++) {
    const t = easeOutCubic(
      clamp01((drive - nodeBirth[i]!) / NODE_WINDOW)
    );
    const o = i * 3;
    pos[o] = seat[o]! + (home[o]! - seat[o]!) * t;
    pos[o + 1] = seat[o + 1]! + (home[o + 1]! - seat[o + 1]!) * t;
    pos[o + 2] = seat[o + 2]! + (home[o + 2]! - seat[o + 2]!) * t;
    // Afterglow: a node the query touched stays warm for a moment, so the
    // space carries a trace of where the last few lookups went.
    glow[i] = glow[i]! * decay;
  }

  // --- The query ------------------------------------------------------------
  links.begin();
  let answerGlow = 0;
  if (still) {
    // Reduced motion: the query parks on one stop with its matches lit, so the
    // piece still SAYS "nearest neighbours" without anything moving.
    const target = itinerary[0] ?? 0;
    query.position[0] = pos[target * 3]!;
    query.position[1] = pos[target * 3 + 1]!;
    query.position[2] = pos[target * 3 + 2]!;
    query.glow[0] = 1;
    for (let k = 0; k < cfg.topK; k++) {
      const m = neighbours[target * NB + k]!;
      if (m < 0) continue;
      glow[m] = 1;
      links.push(
        query.position[0]!, query.position[1]!, query.position[2]!,
        pos[m * 3]!, pos[m * 3 + 1]!, pos[m * 3 + 2]!
      );
    }
    answerGlow = cfg.cite ? 0.8 : 0;
  } else if (itinerary.length > 1) {
    const stops = itinerary.length;
    const phase = elapsed / cfg.period;
    const leg = Math.floor(phase) % stops;
    const u = phase - Math.floor(phase);
    const from = itinerary[leg]!;
    const to = itinerary[(leg + 1) % stops]!;
    // Arrive early, then dwell: the pause is where the lookup reads.
    const travel = smoothstep(0, ARRIVE_AT, u);
    const fo = from * 3;
    const to3 = to * 3;
    // A bowed path — a straight line between two dots reads as a slider.
    const bow = Math.sin(travel * Math.PI) * cfg.radius * 0.22;
    query.position[0] = pos[fo]! + (pos[to3]! - pos[fo]!) * travel;
    query.position[1] = pos[fo + 1]! + (pos[to3 + 1]! - pos[fo + 1]!) * travel + bow;
    query.position[2] = pos[fo + 2]! + (pos[to3 + 2]! - pos[fo + 2]!) * travel;

    const flare =
      smoothstep(FLARE_IN, FLARE_HOLD, u) * (1 - smoothstep(FLARE_HOLD, FLARE_OUT, u));
    query.glow[0] = 0.55 + 0.45 * flare;

    if (flare > 0.01) {
      // The match set: the destination's own k nearest. Lighting the neighbours
      // of the node the query landed on is exactly the operation being drawn.
      for (let k = 0; k < cfg.topK; k++) {
        const m = neighbours[to * NB + k]!;
        if (m < 0) continue;
        glow[m] = Math.max(glow[m]!, flare);
        const mo = m * 3;
        links.push(
          query.position[0]!, query.position[1]!, query.position[2]!,
          pos[mo]!, pos[mo + 1]!, pos[mo + 2]!
        );
        if (cfg.cite) {
          // …and each match cites back to the answer being composed. The beam
          // GROWS from the match rather than appearing whole, so the answer
          // arrives after its evidence does.
          const g = smoothstep(0.62, 0.9, u);
          links.push(
            pos[mo]!, pos[mo + 1]!, pos[mo + 2]!,
            pos[mo]! + (0 - pos[mo]!) * g,
            pos[mo + 1]! + (ANSWER_Y - pos[mo + 1]!) * g,
            pos[mo + 2]! + (ANSWER_Z - pos[mo + 2]!) * g
          );
        }
      }
      glow[to] = Math.max(glow[to]!, flare);
      answerGlow = cfg.cite ? smoothstep(0.74, 0.92, u) * flare : 0;
    }
  }
  links.end();
  query.glow[1] = answerGlow;
  query.flush();
  nodes.flush();

  // --- Ink ------------------------------------------------------------------
  // The net threads itself in over the card's travel; the nodes carry the piece
  // before it, so the frame is never empty while the wiring catches up.
  drawFraction(
    net.geometry,
    net.vertexCount,
    smoothstep(EDGE_START, EDGE_START + EDGE_WINDOW, drive)
  );
  net.material.opacity = 0.42 * reveal;
  nodes.material.uniforms.uOpacity!.value = 0.95 * reveal;
  query.material.uniforms.uOpacity!.value = reveal;
  links.material.opacity = 0.9 * reveal;
});

onBeforeUnmount(() => {
  net.dispose();
  nodes.dispose();
  query.dispose();
  links.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive :object="net.lines" />
    <primitive :object="links.lines" />
    <primitive :object="nodes.points" />
    <primitive :object="query.points" />
  </TresGroup>
</template>
