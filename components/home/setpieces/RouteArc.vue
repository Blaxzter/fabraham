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
  Points,
  PointsMaterial,
  Vector3,
} from "three";

/**
 * The "Berlin → Maastricht" journey set-piece. Two endpoint node Points are
 * joined by a quadratic Bezier arc that bows upward, with a small travelling
 * dot tracing the route over time. Only lines/points read through the ASCII
 * post-process, so this is deliberately a thin curve + nodes, not solid geometry.
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

// Deterministic PRNG so the (subtle) layout jitter is stable across reloads.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const COLOR = "#ffd479";
const SEGMENTS = 48; // arc resolution
const color = new Color(COLOR);

// Endpoints ~1.6 apart on X; the control point bows the arc up ~0.6 on Y.
const rand = mulberry32(0x1357 + props.variant.length * 131);
const jitter = (rand() - 0.5) * 0.08; // tiny deterministic asymmetry
const start = new Vector3(-0.8, 0, 0);
const end = new Vector3(0.8, jitter, 0);
const control = new Vector3(0, 0.6 + jitter, 0);

/** Quadratic Bezier sample at parameter t (0..1) into `out`. */
const bezier = (t: number, out: Vector3) => {
  const u = 1 - t;
  out.set(0, 0, 0);
  out.addScaledVector(start, u * u);
  out.addScaledVector(control, 2 * u * t);
  out.addScaledVector(end, t * t);
  return out;
};

// Build the arc geometry by sampling the curve into SEGMENTS + 1 vertices.
const arcPositions = new Float32Array((SEGMENTS + 1) * 3);
const tmp = new Vector3();
for (let i = 0; i <= SEGMENTS; i++) {
  bezier(i / SEGMENTS, tmp);
  arcPositions[i * 3] = tmp.x;
  arcPositions[i * 3 + 1] = tmp.y;
  arcPositions[i * 3 + 2] = tmp.z;
}
const arcGeometry = new BufferGeometry();
arcGeometry.setAttribute("position", new BufferAttribute(arcPositions, 3));
const arcMaterial = new LineBasicMaterial({
  color,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const arc = new Line(arcGeometry, arcMaterial);

// The two endpoint nodes.
const nodePositions = new Float32Array([
  start.x, start.y, start.z,
  end.x, end.y, end.z,
]);
const nodeGeometry = new BufferGeometry();
nodeGeometry.setAttribute("position", new BufferAttribute(nodePositions, 3));
const nodeMaterial = new PointsMaterial({
  color,
  size: 0.09,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const nodes = new Points(nodeGeometry, nodeMaterial);

// The single travelling dot that rides along the arc.
const travellerPosition = new Float32Array([start.x, start.y, start.z]);
const travellerGeometry = new BufferGeometry();
travellerGeometry.setAttribute("position", new BufferAttribute(travellerPosition, 3));
const travellerMaterial = new PointsMaterial({
  color,
  size: 0.14,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const traveller = new Points(travellerGeometry, travellerMaterial);

const groupRef = shallowRef<Group | null>(null);
const travel = new Vector3();

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;
  group.scale.setScalar(0.6 + 0.4 * reveal);

  // Move the dot along the arc, looping once every 4s.
  const t = (elapsed * 0.25) % 1;
  bezier(t, travel);
  const attr = travellerGeometry.getAttribute("position") as BufferAttribute;
  attr.setXYZ(0, travel.x, travel.y, travel.z);
  attr.needsUpdate = true;

  arcMaterial.opacity = 0.6 * reveal;
  nodeMaterial.opacity = 0.95 * reveal;
  travellerMaterial.opacity = reveal;
});

onBeforeUnmount(() => {
  arcGeometry.dispose();
  arcMaterial.dispose();
  nodeGeometry.dispose();
  nodeMaterial.dispose();
  travellerGeometry.dispose();
  travellerMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive :object="arc" />
    <primitive :object="nodes" />
    <primitive :object="traveller" />
  </TresGroup>
</template>
