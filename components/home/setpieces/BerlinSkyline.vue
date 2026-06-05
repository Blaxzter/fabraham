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
 * A clean LINE SILHOUETTE of a stylized Berlin skyline for the "TU Berlin / B.Sc."
 * chapter. The Fernsehturm (mast + wireframe sphere rings + antenna spike) anchors
 * the scene, flanked by simple rectangular building outlines along a ground line.
 * Only lines read through the ASCII post-process, so this is pure wireframe.
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

// Deterministic PRNG so the skyline layout is stable across reloads.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rand = mulberry32(0xb3211); // "Berlin" seed → fixed building heights

// Helper: push the four edges of an axis-aligned rectangle outline (in XY).
const pushRect = (out: number[], x0: number, x1: number, y0: number, y1: number) => {
  out.push(x0, y0, 0, x1, y0, 0); // bottom
  out.push(x1, y0, 0, x1, y1, 0); // right
  out.push(x1, y1, 0, x0, y1, 0); // top
  out.push(x0, y1, 0, x0, y0, 0); // left
};

const buildSkyline = () => {
  const seg: number[] = [];
  const groundY = -0.8;
  const halfSpan = 1.3; // overall span ~2.6 wide

  // Horizontal ground line the silhouette stands on.
  seg.push(-halfSpan, groundY, 0, halfSpan, groundY, 0);

  // Fernsehturm at the centre: tall vertical mast.
  const mastTop = 0.55;
  seg.push(0, groundY, 0, 0, mastTop, 0);

  // Thin antenna spike above the sphere.
  const sphereCy = mastTop + 0.12;
  const sphereR = 0.12;
  seg.push(0, sphereCy + sphereR, 0, 0, 0.8, 0);

  // 4-6 rectangular building outlines flanking the tower, varying heights.
  const slots = [-1.15, -0.85, -0.55, 0.55, 0.85, 1.15];
  for (let i = 0; i < slots.length; i++) {
    const cx = slots[i]!;
    const w = 0.18 + rand() * 0.1;
    const h = 0.28 + rand() * 0.55;
    pushRect(seg, cx - w / 2, cx + w / 2, groundY, groundY + h);
  }

  return { seg: new Float32Array(seg), sphereCy, sphereR };
};

// Build the Fernsehturm sphere as a few wireframe lat/long rings (line loops).
const buildSphereRings = (cy: number, r: number) => {
  const ring: number[] = [];
  const steps = 28;
  // Two latitude rings (horizontal circles in the XZ-ish plane, drawn in XY for silhouette).
  for (const lat of [-0.4, 0.0, 0.4]) {
    const rr = r * Math.cos(lat);
    const yy = cy + r * Math.sin(lat);
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      ring.push(Math.cos(a) * rr, yy, Math.sin(a) * rr);
    }
  }
  // One vertical longitude ring (the outline circle in XY) for the silhouette.
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    ring.push(Math.cos(a) * r, cy + Math.sin(a) * r, 0);
  }
  return new Float32Array(ring);
};

const { seg, sphereCy, sphereR } = buildSkyline();
const color = new Color("#9ad1ff");

const lineGeometry = new BufferGeometry();
lineGeometry.setAttribute("position", new BufferAttribute(seg, 3));
const lineMaterial = new LineBasicMaterial({
  color,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const skyline = new LineSegments(lineGeometry, lineMaterial);

const ringGeometry = new BufferGeometry();
ringGeometry.setAttribute("position", new BufferAttribute(buildSphereRings(sphereCy, sphereR), 3));
const ringMaterial = new LineBasicMaterial({
  color,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const sphere = new Line(ringGeometry, ringMaterial);

const groupRef = shallowRef<Group | null>(null);

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;
  group.scale.setScalar(0.6 + 0.4 * reveal);
  // Mostly architectural/static: only a very subtle sway.
  group.rotation.z = Math.sin(elapsed * 0.4) * 0.01;
  lineMaterial.opacity = 0.6 * reveal;
  ringMaterial.opacity = 0.6 * reveal;
});

onBeforeUnmount(() => {
  lineGeometry.dispose();
  lineMaterial.dispose();
  ringGeometry.dispose();
  ringMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive :object="skyline" />
    <primitive :object="sphere" />
  </TresGroup>
</template>
