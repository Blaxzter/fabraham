<script setup lang="ts">
import { shallowRef, onBeforeUnmount } from "vue";
import { useLoop } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
} from "three";

/**
 * The finale set-piece: a **sonar of ring pulses** centered on the head.
 *
 *   variant "broadcast" → rings expand outward (the head transmits);
 *   variant "receive"   → rings contract inward (a transmission arriving at the
 *                         head — the visitor reaching out, the head receiving).
 *
 * Built only from line primitives (so it reads through the ASCII post-process)
 * and rendered via the selective set-piece overlay (SceneSetPieces.vue) — an
 * on-top piece (additive, no depth write) so the pulses wash over the head.
 * `reveal` (0..1, scroll-driven) fades and scales it in while the contact beat
 * centers. Deterministic geometry (no RNG); disposes everything on unmount.
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

const RECEIVING = props.variant === "receive";
const COLOR = new Color("#00ff9c");
const BURST_COLOR = new Color("#eafff6"); // brighter — a command's pulse
const BURST_DUR = 0.85; // seconds for a command pulse to converge on the head
const RING_COUNT = 4; // overlapping ambient pulses in flight at once
const RING_SEGMENTS = 96; // smoothness of each ring
const R_MIN = 0.3; // birth radius (just outside the face)
const R_MAX = 2.5; // radius at which a pulse has fully expanded + faded
const PERIOD = 3.6; // seconds for one pulse to travel R_MIN → R_MAX
const TICK_COUNT = 24; // faint radial "transmitter" ticks
const TICK_INNER = 1.15;
const TICK_OUTER = 1.32;

// One shared unit-circle (radius 1, XY plane) — each ring is this scaled to its
// current radius, so the geometry is built once and reused.
const circleGeom = new BufferGeometry();
{
  const pos = new Float32Array(RING_SEGMENTS * 3);
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    pos[i * 3] = Math.cos(a);
    pos[i * 3 + 1] = Math.sin(a);
    pos[i * 3 + 2] = 0;
  }
  circleGeom.setAttribute("position", new BufferAttribute(pos, 3));
}

// Static radial ticks around the head — a steady "antenna" texture under the
// travelling pulses.
const tickGeom = new BufferGeometry();
{
  const pos = new Float32Array(TICK_COUNT * 2 * 3);
  for (let i = 0; i < TICK_COUNT; i++) {
    const a = (i / TICK_COUNT) * Math.PI * 2;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    pos[i * 6] = cx * TICK_INNER;
    pos[i * 6 + 1] = cy * TICK_INNER;
    pos[i * 6 + 2] = 0;
    pos[i * 6 + 3] = cx * TICK_OUTER;
    pos[i * 6 + 4] = cy * TICK_OUTER;
    pos[i * 6 + 5] = 0;
  }
  tickGeom.setAttribute("position", new BufferAttribute(pos, 3));
}

// One material per ring so each pulse fades independently.
const ringMaterials = Array.from(
  { length: RING_COUNT },
  () =>
    new LineBasicMaterial({
      color: COLOR,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
);
const rings = ringMaterials.map((mat) => {
  const loop = new LineLoop(circleGeom, mat);
  loop.frustumCulled = false; // drawn in the overlay pass; don't cull on the main cam
  return loop;
});

const tickMaterial = new LineBasicMaterial({
  color: COLOR,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const ticks = new LineSegments(tickGeom, tickMaterial);
ticks.frustumCulled = false;

// A single bright "command" ring, fired each time the CLI emits a pulse: it
// contracts from R_MAX onto the head (the visitor's signal being received).
const burstMaterial = new LineBasicMaterial({
  color: BURST_COLOR,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const burstRing = new LineLoop(circleGeom, burstMaterial);
burstRing.frustumCulled = false;
burstRing.visible = false;
let lastSeq = store.pulseSeq; // edge-detect new commands (don't fire on mount)
let burstT0 = -Infinity; // elapsed time the current burst started

const groupRef = shallowRef<Group | null>(null);

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;

  // Each ring rides the same pulse cycle, evenly staggered, so there is always a
  // ring in flight. "broadcast" expands R_MIN→R_MAX; "receive" contracts
  // R_MAX→R_MIN (a pulse converging on the head). A bell-shaped opacity (0 at the
  // far end of travel, peak mid-flight) reads as a pulse washing in/out.
  for (let i = 0; i < rings.length; i++) {
    const phase = ((elapsed / PERIOD) + i / RING_COUNT) % 1;
    const travel = RECEIVING ? 1 - phase : phase;
    const radius = R_MIN + (R_MAX - R_MIN) * travel;
    rings[i]!.scale.setScalar(radius);
    ringMaterials[i]!.opacity = reveal * Math.sin(Math.PI * phase) * 0.9;
  }

  // Ticks breathe gently with the pulse.
  tickMaterial.opacity = reveal * (0.18 + 0.12 * (0.5 + 0.5 * Math.sin(elapsed * 2)));
  ticks.rotation.z = elapsed * 0.05; // slow drift

  // Command pulse: edge-detect a new CLI command, then fire one bright ring that
  // converges fast onto the head — the signal being received.
  const seq = store.pulseSeq;
  if (seq !== lastSeq) {
    lastSeq = seq;
    burstT0 = elapsed;
  }
  const bt = (elapsed - burstT0) / BURST_DUR;
  if (bt >= 0 && bt < 1) {
    burstRing.visible = true;
    burstRing.scale.setScalar(R_MIN + (R_MAX - R_MIN) * (1 - bt)); // contract inward
    // Bright as it travels, snuffing out as it lands on the head.
    burstMaterial.opacity = reveal * (1 - bt * bt);
  } else {
    burstRing.visible = false;
  }
});

onBeforeUnmount(() => {
  circleGeom.dispose();
  tickGeom.dispose();
  for (const m of ringMaterials) m.dispose();
  tickMaterial.dispose();
  burstMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive v-for="(ring, i) in rings" :key="i" :object="ring" />
    <primitive :object="ticks" />
    <primitive :object="burstRing" />
  </TresGroup>
</template>
