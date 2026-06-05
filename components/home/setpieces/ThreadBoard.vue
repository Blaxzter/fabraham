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
 * The detective "thread-board" set-piece — it reads as a network/traffic
 * topology to evoke the Tatort SCALE motif: a game contracted for ~100k
 * concurrent that launched at ~18k. Pinned nodes (Points) are scattered across
 * a slightly tilted plane and wired together with "red string" (LineSegments)
 * between nearby nodes; a handful of hub nodes fan out to many others to read
 * as traffic concentration. Only lines/points read through the ASCII
 * post-process, so this is a wireframe graph, not solid geometry.
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

const NODE_COUNT = 24;
const HUB_COUNT = 3; // 2-3 hubs that concentrate connections
const SPAN_X = 2.4;
const SPAN_Y = 1.8;
const STRING = new Color("#ff6b6b"); // "red string"
const PIN = new Color("#ff9a9a"); // nodes a touch brighter

// Deterministic PRNG so the board layout is stable across reloads.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const buildBoard = () => {
  const rand = mulberry32(NODE_COUNT * 7919 + props.variant.length * 137 + 13);
  const pts: number[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    // Scatter across a tilted plane: span in x/y, small z jitter for depth.
    const x = (rand() - 0.5) * SPAN_X;
    const y = (rand() - 0.5) * SPAN_Y;
    const z = (rand() - 0.5) * 0.18;
    pts.push(x, y, z);
  }

  // Pick the first few nodes as hubs (deterministic) so they fan out widely.
  const hubs = Array.from({ length: HUB_COUNT }, (_, i) => i);
  const nearThreshold = 0.85; // proximity wiring for non-hub strings

  const edges: number[] = [];
  const pushEdge = (a: number, b: number) => {
    edges.push(pts[a * 3]!, pts[a * 3 + 1]!, pts[a * 3 + 2]!);
    edges.push(pts[b * 3]!, pts[b * 3 + 1]!, pts[b * 3 + 2]!);
  };

  // Proximity strings between nearby nodes.
  for (let i = 0; i < NODE_COUNT; i++) {
    const ax = pts[i * 3]!;
    const ay = pts[i * 3 + 1]!;
    const az = pts[i * 3 + 2]!;
    for (let j = i + 1; j < NODE_COUNT; j++) {
      const d = Math.hypot(ax - pts[j * 3]!, ay - pts[j * 3 + 1]!, az - pts[j * 3 + 2]!);
      if (d < nearThreshold) pushEdge(i, j);
    }
  }

  // Hub strings: each hub fans out to many others → traffic concentration.
  for (const hub of hubs) {
    for (let j = 0; j < NODE_COUNT; j++) {
      if (j === hub) continue;
      if (rand() < 0.5) pushEdge(hub, j);
    }
  }

  return { pts: new Float32Array(pts), edges: new Float32Array(edges) };
};

const { pts, edges } = buildBoard();

const lineGeometry = new BufferGeometry();
lineGeometry.setAttribute("position", new BufferAttribute(edges, 3));
const lineMaterial = new LineBasicMaterial({
  color: STRING,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const lines = new LineSegments(lineGeometry, lineMaterial);

const pointGeometry = new BufferGeometry();
pointGeometry.setAttribute("position", new BufferAttribute(pts, 3));
const pointMaterial = new PointsMaterial({
  color: PIN,
  size: 0.06,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const points = new Points(pointGeometry, pointMaterial);

const groupRef = shallowRef<Group | null>(null);

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;
  group.scale.setScalar(0.6 + 0.4 * reveal);
  // Slight tilt so the board reads as pinned to a leaning surface.
  group.rotation.x = -0.12;
  group.rotation.z = 0.05;
  lineMaterial.opacity = 0.55 * reveal;
  // Ambient pulse: nodes breathe in size/opacity like blinking traffic.
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.5);
  pointMaterial.size = 0.055 + 0.025 * pulse;
  pointMaterial.opacity = (0.7 + 0.3 * pulse) * reveal;
});

onBeforeUnmount(() => {
  lineGeometry.dispose();
  lineMaterial.dispose();
  pointGeometry.dispose();
  pointMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive :object="lines" />
    <primitive :object="points" />
  </TresGroup>
</template>
