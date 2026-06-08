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
 * Berlin skyline as **SVG line-art**, rendered into the 3D scene as lines — but
 * now driven **per labelled group**. The art is authored in
 * `public/setpieces/berlin-skyline.svg` where every landmark is a `<g id="…">`
 * (buildings) and the moving extras are top-level `<path id="…">` (`airplane`,
 * `Balloon1/2`, `Cloud1/2`, `bottomline*`). We load it with three's `SVGLoader`,
 * walk each parsed path back up to its nearest id'd ancestor, and build **one
 * LineSegments per group** (centred on its own origin, Y-flipped, scaled to fit).
 * That lets every element move independently instead of one whole-drawing sweep.
 *
 * Roles (matched loosely on the id, so SVG typos/casing don't matter):
 *  - building → stagger-rises + fades in left→right as `reveal` climbs, then a
 *    perpetual warm "dawn light" sweep brightens each building as it passes;
 *  - beacon (Fernsehturm) → the dawn sweep + a blinking landmark beacon;
 *  - plane → flies across the sky on a loop (nose-left, so right→left), edge-fades;
 *  - balloon → gentle bob + sway (independent phases);
 *  - cloud → slow drift;
 *  - ground → settles first, with a faint water-reflection shimmer.
 *
 * Swap the SVG (keep the ids) and the skyline updates — no code change.
 *
 * Only lines (no fills) so it reads through the ASCII post-process; rendered via
 * the selective set-piece overlay (see SceneSetPieces.vue), additive + no depth
 * write. `reveal` (0..1, scroll-driven) fades + scales it in while its beat centers.
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

// Palette: cool base line, warm "dawn light" the sweep tints buildings toward.
const BASE_COLOR = new Color("#7ec7e6");
const GLOW_COLOR = new Color("#ffe0a8");

// Ambient motion tuning.
const SWEEP_SECONDS = 7.5; // dawn light crossing the whole skyline once
const SWEEP_SIGMA = 0.12; // width of the moving light band (in normalised x)
const PLANE_SECONDS = 18; // time for the plane to cross + loop
const CLOUD_SECONDS = 26; // cloud drift cycle

type Role = "building" | "beacon" | "plane" | "balloon" | "cloud" | "ground";

interface Part {
  id: string;
  role: Role;
  group: Group;
  geometry: BufferGeometry;
  material: LineBasicMaterial;
  home: { x: number; y: number }; // group's resting world position
  sweepKey: number; // normalised x [0..1] for the dawn sweep
  appearAt: number; // reveal threshold where this part starts fading in
  window: number; // reveal span over which it finishes
  base: number; // resting opacity
  rise: number; // how far it lifts into place on entrance
  seed: number; // deterministic per-part 0..1 (phase / jitter)
}

const groupRef = shallowRef<Group | null>(null);
const parts = shallowRef<Part[]>([]);
let worldWidth = TARGET_SIZE;
let worldHeight = TARGET_SIZE;
let disposed = false;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};
// Shortest distance on a wrapped [0,1] axis, so the dawn sweep loops seamlessly.
const wrapDist = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return d < 0.5 ? d : 1 - d;
};
// Stable per-id hash → 0..1, so phases/jitter are deterministic across reloads.
const hash01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

// Nearest ancestor id: a path may carry the id itself (Cloud1, airplane, …) or
// sit inside a `<g id="…">` (the buildings). The outer wrapper `<g>` has no id,
// so we stop at the first id we meet climbing up.
const groupIdOf = (node: Element | null | undefined): string | null => {
  let n: Node | null | undefined = node;
  while (n && n.nodeType === 1) {
    const id = (n as Element).getAttribute?.("id");
    if (id) return id;
    n = n.parentNode;
  }
  return null;
};

const roleOf = (id: string): Role => {
  const s = id.toLowerCase();
  if (s.includes("airplane") || s.includes("plane")) return "plane";
  if (s.includes("balloon")) return "balloon";
  if (s.includes("cloud")) return "cloud";
  if (s.includes("bottomline") || s.includes("ground")) return "ground";
  if (s.includes("fernseh")) return "beacon"; // the TV tower
  return "building";
};

// Flatten every sub-path of the parsed SVG into world-space line segments, but
// keep them grouped by their labelled ancestor so each element animates on its own.
const buildFromSvg = (paths: ReturnType<SVGLoader["parse"]>["paths"]) => {
  // 1) Gather raw polylines per group id, tracking the drawing's global bounds.
  const byId = new Map<string, number[][]>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const path of paths) {
    const node = (path.userData as { node?: Element } | undefined)?.node;
    const id = groupIdOf(node) ?? "_misc";
    let bucket = byId.get(id);
    if (!bucket) byId.set(id, (bucket = []));
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
      bucket.push(flat);
    }
  }
  if (!byId.size) return;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = TARGET_SIZE / (Math.max(maxX - minX, maxY - minY) || 1);
  worldWidth = (maxX - minX) * scale || TARGET_SIZE;
  worldHeight = (maxY - minY) * scale || TARGET_SIZE;
  const halfW = worldWidth / 2;

  // 2) Per group: world-space segments → recentre on the group's own bbox centre
  //    (so it can translate/scale about itself), build a LineSegments for it.
  const built: Part[] = [];
  for (const [id, polylines] of byId) {
    const segs: number[] = []; // ax,ay,bx,by (world)
    let gMinX = Infinity;
    let gMinY = Infinity;
    let gMaxX = -Infinity;
    let gMaxY = -Infinity;
    for (const flat of polylines) {
      const count = flat.length / 2;
      for (let i = 0; i < count - 1; i++) {
        // flip Y: SVG is y-down, three is y-up.
        const ax = (flat[i * 2]! - cx) * scale;
        const ay = -(flat[i * 2 + 1]! - cy) * scale;
        const bx = (flat[(i + 1) * 2]! - cx) * scale;
        const by = -(flat[(i + 1) * 2 + 1]! - cy) * scale;
        segs.push(ax, ay, bx, by);
        if (ax < gMinX) gMinX = ax;
        if (ax > gMaxX) gMaxX = ax;
        if (bx < gMinX) gMinX = bx;
        if (bx > gMaxX) gMaxX = bx;
        if (ay < gMinY) gMinY = ay;
        if (ay > gMaxY) gMaxY = ay;
        if (by < gMinY) gMinY = by;
        if (by > gMaxY) gMaxY = by;
      }
    }
    if (!segs.length) continue;

    const gx = (gMinX + gMaxX) / 2;
    const gy = (gMinY + gMaxY) / 2;
    const pos = new Float32Array((segs.length / 4) * 6);
    let o = 0;
    for (let i = 0; i < segs.length; i += 4) {
      pos[o++] = segs[i]! - gx;
      pos[o++] = segs[i + 1]! - gy;
      pos[o++] = 0;
      pos[o++] = segs[i + 2]! - gx;
      pos[o++] = segs[i + 3]! - gy;
      pos[o++] = 0;
    }

    const role = roleOf(id);
    const seed = hash01(id);
    const sweepKey = clamp01((gx + halfW) / worldWidth);

    // Entrance choreography per role (left→right stagger for buildings).
    let appearAt = 0;
    let win = 0.4;
    let base = 0.55;
    let rise = 0;
    if (role === "ground") {
      appearAt = 0;
      win = 0.28;
      base = 0.42;
    } else if (role === "building" || role === "beacon") {
      appearAt = 0.04 + sweepKey * 0.5;
      win = 0.4;
      base = 0.55;
      rise = worldHeight * (0.05 + seed * 0.045);
    } else {
      // sky extras arrive last, once the city is mostly up
      appearAt = role === "plane" ? 0.55 : 0.48;
      win = 0.36;
      base = 0.62;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(pos, 3));
    const material = new LineBasicMaterial({
      color: BASE_COLOR.clone(), // per-part clone: the dawn sweep tints buildings individually
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const line = new LineSegments(geometry, material);
    line.frustumCulled = false; // drawn in the overlay pass; don't cull on the main cam

    const g = new Group();
    g.position.set(gx, gy, 0);
    g.add(line);

    built.push({
      id,
      role,
      group: g,
      geometry,
      material,
      home: { x: gx, y: gy },
      sweepKey,
      appearAt,
      window: win,
      base,
      rise,
      seed,
    });
  }

  parts.value = built;
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
  group.visible = reveal > 0.001 && parts.value.length > 0;
  if (!group.visible) return;

  // Whole-drawing reveal: scale in + a barely-there sway, as the other set-pieces.
  group.scale.setScalar(0.6 + 0.4 * reveal);
  group.rotation.z = Math.sin(elapsed * 0.25) * 0.006;

  const amb = smoothstep(0.1, 0.7, reveal); // ambient motion ramps in with reveal
  const sweep = (elapsed % SWEEP_SECONDS) / SWEEP_SECONDS; // dawn light position 0..1

  const TAU = Math.PI * 2;
  for (const p of parts.value) {
    const lr = smoothstep(p.appearAt, p.appearAt + p.window, reveal); // local reveal
    const phase = p.seed * TAU;
    const g = p.group;

    switch (p.role) {
      case "building":
      case "beacon": {
        // Dawn light: a soft band sweeping the skyline brightens + warms each
        // building as it passes (additive, so higher opacity reads as brighter).
        const glow = Math.exp(
          -(wrapDist(p.sweepKey, sweep) ** 2) / (2 * SWEEP_SIGMA * SWEEP_SIGMA)
        );
        p.material.color.copy(BASE_COLOR).lerp(GLOW_COLOR, glow * 0.55 * amb);
        let op = (p.base + 0.5 * glow * amb) * lr;

        if (p.role === "beacon") {
          // Blinking landmark beacon on the TV tower, plus a faint breath.
          const blink = Math.pow(0.5 + 0.5 * Math.sin(elapsed * 1.8), 6);
          op += 0.4 * blink * amb * lr;
          g.scale.setScalar(1 + 0.018 * blink * amb);
        }

        p.material.opacity = Math.min(1, op);
        g.position.set(p.home.x, p.home.y - p.rise * (1 - lr), 0);
        break;
      }

      case "ground": {
        // Settles flat first; faint shimmer like light on water.
        p.material.opacity =
          p.base * lr * (0.82 + 0.18 * Math.sin(elapsed * 0.6 + phase) * amb);
        g.position.set(p.home.x, p.home.y, 0);
        break;
      }

      case "plane": {
        // Nose points left, so fly right→left and loop. Travel centred on the
        // drawing so it crosses the whole sky; fade at both ends to hide the wrap.
        const u = (elapsed / PLANE_SECONDS + p.seed) % 1;
        const x = (0.5 - u) * worldWidth * 1.3;
        const y = p.home.y + Math.sin(elapsed * 1.1 + phase) * worldHeight * 0.02 * amb;
        const edge = smoothstep(0, 0.06, u) * (1 - smoothstep(0.94, 1, u));
        g.position.set(x, y, 0);
        p.material.opacity = p.base * lr * edge;
        break;
      }

      case "balloon": {
        const y = p.home.y + Math.sin(elapsed * 0.5 + phase) * worldHeight * 0.045 * amb;
        const x = p.home.x + Math.sin(elapsed * 0.27 + phase) * worldWidth * 0.012 * amb;
        g.position.set(x, y, 0);
        p.material.opacity = p.base * lr;
        break;
      }

      case "cloud": {
        // Slow drift back and forth near where it was authored (no pop).
        const u = (elapsed / CLOUD_SECONDS + p.seed) % 1;
        const x = p.home.x + Math.sin(u * TAU) * worldWidth * 0.05;
        const y = p.home.y + Math.sin(elapsed * 0.12 + phase) * worldHeight * 0.012 * amb;
        g.position.set(x, y, 0);
        p.material.opacity = p.base * lr;
        break;
      }
    }
  }
});

onBeforeUnmount(() => {
  disposed = true;
  for (const p of parts.value) {
    p.geometry.dispose();
    p.material.dispose();
  }
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive v-for="p in parts" :key="p.id" :object="p.group" />
  </TresGroup>
</template>
