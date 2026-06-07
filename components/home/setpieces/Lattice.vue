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
 * The recurring line "lattice/graph" motif. The same set-piece escalates across
 * the AI through-line via `variant`: GANs (Maastricht) → embeddings (Tatort) →
 * RAG (Experte). Only lines/points read through the ASCII post-process, so this
 * is deliberately a wireframe graph, not solid geometry.
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

// Escalating density / colour as the AI story deepens. The radii envelop the
// 2× head (centred on the origin = the head's centre), and the set-piece overlay
// runs a head depth pre-pass so the head actually occludes the *back* of the
// graph — the face sits inside the node cloud rather than behind a flat veil.
const VARIANTS = {
  gan: { nodes: 30, radius: 1.35, connect: 0.52, color: "#c4a0ff" },
  embeddings: { nodes: 58, radius: 1.55, connect: 0.46, color: "#7fe7ff" },
  rag: { nodes: 86, radius: 1.75, connect: 0.4, color: "#ffffff" },
  default: { nodes: 38, radius: 1.45, connect: 0.48, color: "#9ad1ff" },
} as const;

const cfg = VARIANTS[props.variant as keyof typeof VARIANTS] ?? VARIANTS.default;

// Deterministic PRNG so the graph is stable across reloads.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const buildGraph = () => {
  const rand = mulberry32(cfg.nodes * 9973 + props.variant.length * 131 + 7);
  const pts: number[] = [];
  for (let i = 0; i < cfg.nodes; i++) {
    // Points on a rough spherical shell → a graph-cloud silhouette.
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = cfg.radius * (0.7 + rand() * 0.3);
    const s = Math.sqrt(1 - u * u);
    pts.push(Math.cos(theta) * s * r, u * r, Math.sin(theta) * s * r);
  }

  const edges: number[] = [];
  const threshold = cfg.connect * cfg.radius * 2;
  for (let i = 0; i < cfg.nodes; i++) {
    const ax = pts[i * 3]!;
    const ay = pts[i * 3 + 1]!;
    const az = pts[i * 3 + 2]!;
    for (let j = i + 1; j < cfg.nodes; j++) {
      const bx = pts[j * 3]!;
      const by = pts[j * 3 + 1]!;
      const bz = pts[j * 3 + 2]!;
      const d = Math.hypot(ax - bx, ay - by, az - bz);
      if (d < threshold) edges.push(ax, ay, az, bx, by, bz);
    }
  }
  return { pts: new Float32Array(pts), edges: new Float32Array(edges) };
};

const { pts, edges } = buildGraph();
const color = new Color(cfg.color);

const lineGeometry = new BufferGeometry();
lineGeometry.setAttribute("position", new BufferAttribute(edges, 3));
const lineMaterial = new LineBasicMaterial({
  color,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const lines = new LineSegments(lineGeometry, lineMaterial);

const pointGeometry = new BufferGeometry();
pointGeometry.setAttribute("position", new BufferAttribute(pts, 3));
const pointMaterial = new PointsMaterial({
  color,
  size: 0.07,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const points = new Points(pointGeometry, pointMaterial);

const groupRef = shallowRef<Group | null>(null);

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;
  group.rotation.y += delta * 0.15; // slow ambient spin
  group.scale.setScalar(0.6 + 0.4 * reveal);
  lineMaterial.opacity = 0.55 * reveal;
  pointMaterial.opacity = 0.9 * reveal;
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
