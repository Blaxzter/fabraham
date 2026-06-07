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
 * It is **permanently animated**: the full drawing stays visible (dim) while a
 * brighter highlight band sweeps left→right across it forever — the segments are
 * sorted by x so the sweep reads as a light "building" the city across the
 * skyline. (Per-element motion — e.g. the plane flying, clouds drifting —
 * would need those elements tagged as groups in the SVG; this whole-drawing
 * sweep needs no markup.)
 *
 * Only lines (no fills) so it reads through the ASCII post-process; rendered via
 * the selective set-piece overlay (see SceneSetPieces.vue), additive + no depth
 * write. `reveal` (0..1, scroll-driven) fades and scales it in while its beat centers.
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
const SWEEP_SECONDS = 5.5; // time for the highlight to cross the whole drawing
const SWEEP_FRACTION = 0.16; // width of the moving highlight band (fraction of segments)

const baseMaterial = new LineBasicMaterial({
  color: new Color("#7ec7e6"),
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const scanMaterial = new LineBasicMaterial({
  color: new Color("#ffffff"),
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});

const groupRef = shallowRef<Group | null>(null);
const baseLine = shallowRef<LineSegments | null>(null);
const scanLine = shallowRef<LineSegments | null>(null);
let segCount = 0;
let disposed = false;

// Flatten every sub-path of the parsed SVG into world-space line segments,
// sorted left→right, centered + Y-flipped + scaled to TARGET_SIZE.
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
  segs.sort((a, b) => a.key - b.key); // left→right, so the sweep moves across

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
  segCount = segs.length;

  // Base: the whole drawing, dim. Scan: the same geometry, bright, with a
  // moving draw-range window (animated in onBeforeRender).
  const geomBase = new BufferGeometry();
  geomBase.setAttribute("position", new BufferAttribute(pos, 3));
  const base = new LineSegments(geomBase, baseMaterial);
  base.frustumCulled = false; // drawn in the overlay pass; don't cull on the main cam
  baseLine.value = base;

  const geomScan = new BufferGeometry();
  geomScan.setAttribute("position", new BufferAttribute(pos.slice(), 3));
  geomScan.setDrawRange(0, 0);
  const scan = new LineSegments(geomScan, scanMaterial);
  scan.frustumCulled = false;
  scanLine.value = scan;
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

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001 && !!baseLine.value;
  if (!group.visible) return;

  group.scale.setScalar(0.6 + 0.4 * reveal);
  // Mostly architectural/static: only a very subtle sway.
  group.rotation.z = Math.sin(elapsed * 0.4) * 0.01;
  baseMaterial.opacity = 0.55 * reveal;
  scanMaterial.opacity = 0.7 * reveal;

  // Sweep the bright highlight band left→right across the segments, forever.
  const scan = scanLine.value;
  if (scan && segCount > 0) {
    const win = Math.max(1, Math.floor(segCount * SWEEP_FRACTION));
    const span = segCount + win;
    const head = Math.floor(((elapsed % SWEEP_SECONDS) / SWEEP_SECONDS) * span) - win;
    const start = Math.max(0, head);
    const stop = Math.min(segCount, head + win);
    scan.geometry.setDrawRange(start * 2, Math.max(0, stop - start) * 2);
  }
});

onBeforeUnmount(() => {
  disposed = true;
  baseLine.value?.geometry.dispose();
  scanLine.value?.geometry.dispose();
  baseMaterial.dispose();
  scanMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive v-if="baseLine" :object="baseLine" />
    <primitive v-if="scanLine" :object="scanLine" />
  </TresGroup>
</template>
