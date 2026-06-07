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
  LineSegments,
  Points,
  PointsMaterial,
} from "three";

/**
 * A musical staff evoking the church Gesangbuch (hymnal) PWA for the
 * "community" chapter: five long horizontal lines, a handful of note-heads
 * that gently bob like a slow melody, and a couple of vertical bar lines.
 * Only lines/points read through the ASCII post-process, so this is a pure
 * wireframe — no solid note-heads, just Points.
 *
 * `reveal` (0..1, scroll-driven) fades and scales it in while centered.
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

const WARM = "#ffd479";
const HALF_WIDTH = 1.3; // staff spans ~2.6 wide, centered
const SPACING = 0.12; // gap between the five staff lines
const NOTE_COUNT = 6;

// Deterministic PRNG so the note layout is stable across reloads.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(staffSeed());
function staffSeed() {
  return NOTE_COUNT * 7919 + props.variant.length * 101 + 13;
}

// Five horizontal staff lines centered vertically around y = 0.
const staffPositions: number[] = [];
for (let i = 0; i < 5; i++) {
  const y = (i - 2) * SPACING;
  staffPositions.push(-HALF_WIDTH, y, 0, HALF_WIDTH, y, 0);
}

// One or two short vertical bar lines spanning the full staff height.
const barTop = 2 * SPACING;
const barBottom = -2 * SPACING;
for (const x of [-HALF_WIDTH, HALF_WIDTH * 0.35]) {
  staffPositions.push(x, barBottom, 0, x, barTop, 0);
}

// Note-heads sit on/between the lines, spread across the staff width.
// `noteBase` holds each rest position; `notePhase` offsets the melodic bob.
const noteBase: number[] = [];
const notePhase: number[] = [];
for (let i = 0; i < NOTE_COUNT; i++) {
  const x = -HALF_WIDTH * 0.8 + (i / (NOTE_COUNT - 1)) * HALF_WIDTH * 1.6;
  // Snap roughly to a line/space position (-2..2 steps of half-SPACING).
  const step = Math.round(rand() * 8 - 4);
  const y = step * (SPACING * 0.5);
  noteBase.push(x, y, 0);
  notePhase.push(rand() * Math.PI * 2);
}

const color = new Color(WARM);

// Staff + bar lines as a single LineSegments.
const lineGeometry = new BufferGeometry();
lineGeometry.setAttribute(
  "position",
  new BufferAttribute(new Float32Array(staffPositions), 3),
);
const lineMaterial = new LineBasicMaterial({
  color,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const lines = new LineSegments(lineGeometry, lineMaterial);

// Note-heads as Points; positions are mutated each frame for the bob.
const noteArray = new Float32Array(noteBase);
const noteGeometry = new BufferGeometry();
const noteAttribute = new BufferAttribute(noteArray, 3);
noteGeometry.setAttribute("position", noteAttribute);
const noteMaterial = new PointsMaterial({
  color,
  size: 0.07,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const notes = new Points(noteGeometry, noteMaterial);

const groupRef = shallowRef<Group | null>(null);

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;
  group.scale.setScalar(0.6 + 0.4 * reveal);
  lineMaterial.opacity = 0.55 * reveal;
  noteMaterial.opacity = 0.95 * reveal;

  // Each note bobs vertically like a slow melody.
  for (let i = 0; i < NOTE_COUNT; i++) {
    const baseY = noteBase[i * 3 + 1]!;
    noteArray[i * 3 + 1] = baseY + Math.sin(elapsed + notePhase[i]!) * 0.03;
  }
  noteAttribute.needsUpdate = true;
});

onBeforeUnmount(() => {
  lineGeometry.dispose();
  lineMaterial.dispose();
  noteGeometry.dispose();
  noteMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive :object="lines" />
    <primitive :object="notes" />
  </TresGroup>
</template>
