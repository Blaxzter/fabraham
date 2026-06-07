<script setup lang="ts">
import { shallowRef, onBeforeUnmount } from "vue";
import { useLoop } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
} from "three";

/**
 * "RAG made visible" set-piece for the Experte chapter. A loose 3x3 grid of
 * small document rectangle outlines drifts inward toward a cluster, and one
 * bright "answer" beam shoots from that cluster across to the opposite side —
 * documents retrieved, an answer cited. Only line primitives are used because
 * the ASCII post-process quantizes the scene; solid meshes turn to mush.
 *
 * `reveal` (0..1, scroll-driven) fades and scales it in while its chapter is centered.
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

const DOC_COLOR = "#7fe7ff";
const BEAM_COLOR = "#ffffff";
const DOC_W = 0.26; // single document outline width
const DOC_H = 0.34; // single document outline height
const SPAN_X = 2.2; // total horizontal spread of the grid
const SPAN_Y = 1.6; // total vertical spread of the grid

// Deterministic PRNG so the layout/jitter is stable across reloads.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// One document = 4 edges = 8 vertices (LineSegments pairs). We keep each doc's
// base anchor on the left/grid side plus a small phase so they breathe out of sync.
interface Doc {
  base: [number, number, number];
  phase: number;
}

const buildDocs = () => {
  const rand = mulberry32(9311 + props.variant.length * 137 + 3);
  const docs: Doc[] = [];
  const verts: number[] = [];
  // 3x3 grid biased to the left half of the span (the "document side").
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      const jitterX = (rand() - 0.5) * 0.12;
      const jitterY = (rand() - 0.5) * 0.12;
      const cx = -SPAN_X * 0.42 + (gx / 2) * (SPAN_X * 0.32) + jitterX;
      const cy = (gy - 1) * (SPAN_Y / 2.4) + jitterY;
      const cz = (rand() - 0.5) * 0.3;
      docs.push({ base: [cx, cy, cz], phase: rand() * Math.PI * 2 });
      // Rectangle outline as four edges (8 endpoints); the inward drift is
      // applied to these positions per frame in onBeforeRender.
      const hw = DOC_W / 2;
      const hh = DOC_H / 2;
      const corners: [number, number][] = [
        [cx - hw, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh],
        [cx - hw, cy + hh],
      ];
      for (let e = 0; e < 4; e++) {
        const a = corners[e]!;
        const b = corners[(e + 1) % 4]!;
        verts.push(a[0], a[1], cz, b[0], b[1], cz);
      }
    }
  }
  return { docs, verts: new Float32Array(verts) };
};

const { docs, verts } = buildDocs();
const docColor = new Color(DOC_COLOR);
const beamColor = new Color(BEAM_COLOR);

// Document outlines: one LineSegments holding all 9 rectangles.
const docGeometry = new BufferGeometry();
docGeometry.setAttribute("position", new BufferAttribute(verts, 3));
const basePositions = verts.slice(); // immutable copy to drift from each frame
const docMaterial = new LineBasicMaterial({
  color: docColor,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const docLines = new LineSegments(docGeometry, docMaterial);

// Answer beam: a single bright Line from the cluster to the opposite side.
const beamGeometry = new BufferGeometry();
beamGeometry.setAttribute(
  "position",
  new BufferAttribute(new Float32Array([-SPAN_X * 0.3, 0, 0, SPAN_X * 0.55, 0, 0]), 3),
);
const beamMaterial = new LineBasicMaterial({
  color: beamColor,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const beam = new Line(beamGeometry, beamMaterial);

const groupRef = shallowRef<Group | null>(null);

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;
  group.scale.setScalar(0.6 + 0.4 * reveal);

  // Drift every document slowly toward the centre with a gentle looping motion.
  const attr = docGeometry.getAttribute("position") as BufferAttribute;
  for (let d = 0; d < docs.length; d++) {
    const doc = docs[d]!;
    const pull = 0.18 + 0.06 * Math.sin(elapsed * 0.6 + doc.phase); // inward breathing
    const sway = 0.03 * Math.sin(elapsed * 0.9 + doc.phase);
    const dx = -doc.base[0] * pull;
    const dy = -doc.base[1] * pull + sway;
    for (let v = 0; v < 8; v++) {
      const i = (d * 8 + v) * 3;
      attr.array[i] = basePositions[i]! + dx;
      attr.array[i + 1] = basePositions[i + 1]! + dy;
    }
  }
  attr.needsUpdate = true;

  docMaterial.opacity = 0.6 * reveal;
  // Beam pulses brighter to read as the emitted, cited answer.
  beamMaterial.opacity = (0.6 + 0.4 * Math.sin(elapsed * 2.0)) * reveal;
});

onBeforeUnmount(() => {
  docGeometry.dispose();
  docMaterial.dispose();
  beamGeometry.dispose();
  beamMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive :object="docLines" />
    <primitive :object="beam" />
  </TresGroup>
</template>
