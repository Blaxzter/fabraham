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
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * Berlin skyline as **SVG line-art**, rendered into the 3D scene as lines.
 *
 * The art is authored as a normal SVG (a continuous single-line drawing reads
 * best) and dropped into `public/setpieces/berlin-skyline.svg`. We load it with
 * three's `SVGLoader`, sample every sub-path into a polyline, then normalise the
 * whole drawing: centre it on the origin, flip Y (SVG is y-down), and scale the
 * largest dimension to `TARGET_SIZE` world units so it fits the camera frame.
 * Swap the SVG file and the skyline updates — no code change.
 *
 * Only lines (no fills) so it reads through the ASCII post-process; rendered via
 * the selective set-piece overlay (see SceneSetPieces.vue), additive + no depth
 * write, like every other set-piece.
 *
 * `reveal` (0..1, scroll-driven) fades and scales it in while its beat centers.
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

// Source art + the world size the normalised drawing is scaled to fit.
const SVG_URL = "/setpieces/berlin-skyline.svg";
const TARGET_SIZE = 1.15;
const CURVE_DIVISIONS = 24; // samples per curve when flattening paths to lines
const DRAW_DURATION = 1.4; // seconds for the line-art to sweep on (left→right)

const color = new Color("#9ad1ff");
const lineMaterial = new LineBasicMaterial({
  color,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});

const groupRef = shallowRef<Group | null>(null);
const lines = shallowRef<LineSegments | null>(null);
let disposed = false;

// Flatten every sub-path of the parsed SVG into world-space line segments,
// centered + Y-flipped + scaled to TARGET_SIZE.
const buildFromSvg = (paths: ReturnType<SVGLoader["parse"]>["paths"]) => {
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
  if (!polylines.length) return;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = TARGET_SIZE / (Math.max(maxX - minX, maxY - minY) || 1);

  // Build line segments, then sort them left→right so the draw-on animation
  // sweeps across the drawing instead of popping in SVG authoring order.
  type Seg = { ax: number; ay: number; bx: number; by: number; key: number };
  const segs: Seg[] = [];
  for (const flat of polylines) {
    const count = flat.length / 2;
    for (let i = 0; i < count - 1; i++) {
      // flip Y: SVG is y-down, three is y-up.
      const ax = (flat[i * 2]! - cx) * scale;
      const ay = -(flat[i * 2 + 1]! - cy) * scale;
      const bx = (flat[(i + 1) * 2]! - cx) * scale;
      const by = -(flat[(i + 1) * 2 + 1]! - cy) * scale;
      segs.push({ ax, ay, bx, by, key: Math.min(ax, bx) });
    }
  }
  segs.sort((a, b) => a.key - b.key);

  const pos = new Float32Array(segs.length * 6);
  let o = 0;
  for (const s of segs) {
    pos[o++] = s.ax;
    pos[o++] = s.ay;
    pos[o++] = 0;
    pos[o++] = s.bx;
    pos[o++] = s.by;
    pos[o++] = 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setDrawRange(0, 0); // start hidden; onBeforeRender sweeps it on
  const ls = new LineSegments(geometry, lineMaterial);
  ls.frustumCulled = false; // drawn in the overlay pass; don't cull on the main cam
  lines.value = ls;
};

onMounted(() => {
  const loader = new SVGLoader();
  loader.load(
    SVG_URL,
    (data) => {
      if (!disposed) buildFromSvg(data.paths);
    },
    undefined,
    (err) => console.warn(`[BerlinSkyline] could not load ${SVG_URL}`, err)
  );
});

// When the skyline becomes visible, sweep the lines on left→right (via the
// geometry draw range), then hold; reset when it leaves so it redraws next time.
let drawStart = -1;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  const ls = lines.value;
  group.visible = reveal > 0.001 && !!ls;
  if (!group.visible) {
    drawStart = -1;
    return;
  }
  if (drawStart < 0) drawStart = elapsed;

  if (ls) {
    const verts = ls.geometry.getAttribute("position").count;
    const p = smoothstep(Math.min(1, (elapsed - drawStart) / DRAW_DURATION));
    // draw range counts vertices; keep it on segment (pair) boundaries.
    ls.geometry.setDrawRange(0, Math.floor((verts / 2) * p) * 2);
  }

  group.scale.setScalar(0.6 + 0.4 * reveal);
  // Mostly architectural/static: only a very subtle sway.
  group.rotation.z = Math.sin(elapsed * 0.4) * 0.01;
  lineMaterial.opacity = 0.85 * reveal;
});

onBeforeUnmount(() => {
  disposed = true;
  lines.value?.geometry.dispose();
  lineMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive v-if="lines" :object="lines" />
  </TresGroup>
</template>
