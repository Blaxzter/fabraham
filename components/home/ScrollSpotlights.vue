<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  ConeGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  SpotLight,
  Vector3,
} from "three";
import type { Matrix4 } from "three";
import type { SpotEffect, SpotKeyframe } from "~/types/spotlights";

/**
 * The scroll-driven spotlight rig — the lighting analogue of the camera spine.
 *
 * Each track in the spotlights store (seeded from components/home/sections/
 * spotlights.ts, live-editable in the dev panel) is a timeline of keyframes
 * pinned to scroll progress. Here we keep one real THREE.SpotLight per track and,
 * every frame, interpolate its keyframes by the single scroll signal
 * (sectionsStore.progress), resolve its head-anchored aim against the head's live
 * world matrix, layer on its active keyframe's time-based effect, and write the
 * result straight onto the light — imperatively, allocating nothing per frame and
 * patching no reactive props (issue #4), exactly like the camera, the head gaze,
 * and SignalField.
 *
 * The lights (and the optional volumetric beam cones) live on the default layer
 * (0), so they go through the ASCII composer with the head/backdrop — a brighter
 * face resolves more characters out of the dark, and a beam reads as a coherent
 * shaft of brighter characters. Spots stay dark through the hero and snap on at
 * the interlude (the "tada"). The dev panel edits the store; we rebuild our
 * runtime cache (pre-parsed Vector3/Color, no per-frame allocation) on change.
 */
const store = useSpotlightsStore();
const sectionsStore = useSectionsStore();
const { scene } = useTresContext();
const { reducedMotion } = usePreferences();
const isDev = import.meta.dev;

// Defaults for omitted keyframe fields.
const DEF_ANGLE = Math.PI / 7;
const DEF_PENUMBRA = 0.4;
const DEF_DISTANCE = 8;
const DECAY = 1; // match the scene's existing point/spot lights

// @types/three ships two structurally-divergent Object3D declarations (a deep
// src path and the TresJS-augmented build path); pin everything to the instance
// type of the class we actually construct so the two never get compared.
type O3D = InstanceType<typeof Object3D>;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t); // ease the travel between keyframes

// ── Shared geometry ───────────────────────────────────────────────────────────
// Volumetric beam: a cone with its apex at the origin pointing down +Z, vertex-
// coloured bright→dark along its length so additive blending fades it to nothing
// at the far end — a glowing shaft. Scaled/oriented per light each frame.
const beamGeom = (() => {
  const g = new ConeGeometry(1, 1, 28, 16, true);
  g.translate(0, -0.5, 0); // apex at origin, base at -Y
  g.rotateX(-Math.PI / 2); // base swings to +Z → axis is +Z, length 1
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const z = Math.min(Math.max(pos.getZ(i), 0), 1); // 0 apex → 1 base
    const b = Math.pow(1 - z, 1.6); // brightest at the source, fades out
    colors[i * 3] = b;
    colors[i * 3 + 1] = b;
    colors[i * 3 + 2] = b;
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  return g;
})();
// Dev-only position-marker geometry (no helper scaffolding ships to prod).
const markerGeom = isDev ? new SphereGeometry(0.035, 10, 10) : null;

// ── Light units (pooled by track index; never recreated on a value edit) ───────
interface Unit {
  light: SpotLight;
  target: O3D;
  cone: Mesh;
  coneMat: MeshBasicMaterial;
  marker?: Mesh;
  markerMat?: MeshBasicMaterial;
}
const pool: Unit[] = [];

const createUnit = (): Unit => {
  const light = new SpotLight(0xffffff, 0, DEF_DISTANCE, DEF_ANGLE, DEF_PENUMBRA, DECAY);
  light.castShadow = false; // ASCII hides shadow detail; keep the rig cheap
  light.visible = false;
  const target = new Object3D();
  light.target = target;

  const coneMat = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false, // beams blend with each other; head still occludes them
    side: DoubleSide,
    opacity: 0,
  });
  const cone = new Mesh(beamGeom, coneMat);
  cone.frustumCulled = false;
  cone.visible = false;

  let marker: Mesh | undefined;
  let markerMat: MeshBasicMaterial | undefined;
  if (markerGeom) {
    markerMat = new MeshBasicMaterial({ depthTest: false });
    marker = new Mesh(markerGeom, markerMat);
    marker.visible = false;
  }
  return { light, target, cone, coneMat, marker, markerMat };
};

// The pool only grows (removed tracks' units detach + are disposed at unmount),
// so a SpotLight is never recreated mid-session — only its keyframe data changes.
const ensurePool = (n: number) => {
  while (pool.length < n) pool.push(createUnit());
};

// ── Runtime tracks: keyframes with pre-parsed Color/Vector3, rebuilt only when
// the store changes (dev edits) so the per-frame loop allocates nothing. ────────
interface RtKeyframe {
  at: number;
  pos: Vector3;
  tgt: Vector3;
  tgtHead: boolean;
  intensity: number;
  color: Color;
  angle: number;
  penumbra: number;
  distance: number;
  effect: SpotEffect | null;
}
interface RtTrack {
  id: string;
  kfs: RtKeyframe[];
  unit: Unit;
}
const rtTracks = shallowRef<RtTrack[]>([]);

const parseKfs = (kfs: SpotKeyframe[]): RtKeyframe[] =>
  kfs
    .map((k) => ({
      at: sectionsStore.resolveAt(k), // section/milestone anchor → absolute scroll
      pos: new Vector3(k.position.x, k.position.y, k.position.z),
      tgt: new Vector3(k.target.x, k.target.y, k.target.z),
      tgtHead: (k.targetAnchor ?? "head") === "head",
      intensity: k.intensity,
      color: new Color(k.color),
      angle: k.angle ?? DEF_ANGLE,
      penumbra: k.penumbra ?? DEF_PENUMBRA,
      distance: k.distance ?? DEF_DISTANCE,
      effect: k.effect && k.effect.type !== "none" ? k.effect : null,
    }))
    .sort((a, b) => a.at - b.at);

const rebuild = () => {
  ensurePool(store.tracks.length);
  rtTracks.value = store.tracks.map((t, i) => ({
    id: t.id,
    kfs: parseKfs(t.keyframes),
    unit: pool[i]!,
  }));
};
rebuild();
// Re-cache (coalesced via a dirty flag, applied once per frame in the loop) on:
//  - dev edits to the tracks (deep watch; fires on every slider tick), and
//  - section-layout / biography-card changes, which re-resolve every keyframe's
//    anchored scroll position (this is what makes the rig content-resilient).
let dirty = false;
if (isDev) watch(() => store.tracks, () => { dirty = true; }, { deep: true });
watch(
  () => `${sectionsStore.boundaries.join(",")}|${sectionsStore.milestoneCount}`,
  () => { dirty = true; }
);

// Reused scratch — no per-frame allocation (issue #4).
const tA = new Vector3();
const tB = new Vector3();
const dir = new Vector3();
const quat = new Quaternion();
const AXIS_Z = new Vector3(0, 0, 1);
const hsl = { h: 0, s: 0, l: 0 };
let headGroup: O3D | null = null;

// Resolve a keyframe's aim into a WORLD point: head-anchored offsets ride the
// head's live matrix (so the cone tracks the floating/turning head), world
// targets pass through unchanged. Writes into `out`.
const resolveTarget = (kf: RtKeyframe, headMat: Matrix4 | null, out: Vector3) => {
  out.copy(kf.tgt);
  if (kf.tgtHead && headMat) out.applyMatrix4(headMat);
};

// Layer a time-based effect over the (already interpolated) light. Mutates the
// light + its aim in place; skipped entirely under reduced-motion.
const applyEffect = (eff: SpotEffect, elapsed: number, light: SpotLight, aim: Vector3) => {
  const amount = eff.amount ?? 0.3;
  const speed = eff.speed ?? 1;
  switch (eff.type) {
    case "flicker": {
      const f =
        Math.sin(elapsed * speed) * 0.5 +
        Math.sin(elapsed * speed * 3.1 + 1.7) * 0.3 +
        Math.sin(elapsed * speed * 7.3 + 0.6) * 0.2;
      light.intensity *= 1 - amount * (0.5 - 0.5 * f); // dips toward (1 - amount)
      break;
    }
    case "pulse":
    case "breathe":
      light.intensity *= 1 + amount * 0.5 * Math.sin(elapsed * speed);
      break;
    case "strobe":
      if (Math.sin(elapsed * speed) <= 0) light.intensity *= 1 - amount;
      break;
    case "sweep": {
      const o = amount * Math.sin(elapsed * speed);
      light.position.x += o;
      aim.x += o * 0.6; // the cone scans, not just the source
      break;
    }
    case "orbit": {
      const ang = elapsed * speed;
      const dx = light.position.x - aim.x;
      const dz = light.position.z - aim.z;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      light.position.x = aim.x + dx * c - dz * s;
      light.position.z = aim.z + dx * s + dz * c;
      light.position.y += amount * 0.2 * Math.sin(elapsed * speed * 0.5);
      break;
    }
    case "colorCycle":
      light.color.getHSL(hsl);
      hsl.h = (hsl.h + amount * Math.sin(elapsed * speed) + 1) % 1;
      light.color.setHSL(hsl.h, hsl.s, hsl.l);
      break;
    case "none":
    default:
      break;
  }
};

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  if (dirty) {
    dirty = false;
    rebuild();
  }
  const on = store.enabled;
  const m = store.master;
  const help = store.showHelpers && isDev;
  const cones = store.showCones;
  const coneOp = store.coneOpacity;
  const p = sectionsStore.progress;

  // The head's world matrix for head-anchored aims. The Levioso float is fresh
  // (it also writes in onBeforeRender); the addressing yaw/pitch is one frame
  // late (Scene3D writes it in the after-render @loop) — but the head is *drawn*
  // with that same value, so the cone and the face stay in step. Matches
  // SignalField. Re-resolve if the cached node was detached (HMR head swap).
  if (headGroup && !headGroup.parent) headGroup = null;
  if (!headGroup) headGroup = (scene.value?.getObjectByName("headGroup") as O3D | undefined) ?? null;
  let headMat: Matrix4 | null = null;
  if (headGroup) {
    headGroup.updateWorldMatrix(true, false);
    headMat = headGroup.matrixWorld;
  }

  for (const tr of rtTracks.value) {
    const { kfs, unit } = tr;
    const { light, target, cone, coneMat } = unit;
    const n = kfs.length;
    if (!n) {
      light.visible = false;
      cone.visible = false;
      if (unit.marker) unit.marker.visible = false;
      continue;
    }

    // Bracket the keyframes around p (clamped at the ends), eased between them.
    let a: RtKeyframe;
    let b: RtKeyframe;
    let raw: number;
    if (p <= kfs[0]!.at) {
      a = b = kfs[0]!;
      raw = 0;
    } else if (p >= kfs[n - 1]!.at) {
      a = b = kfs[n - 1]!;
      raw = 1;
    } else {
      let i = 0;
      while (i < n - 1 && !(p >= kfs[i]!.at && p <= kfs[i + 1]!.at)) i++;
      a = kfs[i]!;
      b = kfs[i + 1]!;
      raw = (p - a.at) / (b.at - a.at || 1);
    }
    const t = smooth(raw);

    // Interpolate the static pose straight onto the light.
    light.position.copy(a.pos).lerp(b.pos, t);
    resolveTarget(a, headMat, tA);
    resolveTarget(b, headMat, tB);
    target.position.copy(tA).lerp(tB, t);
    light.intensity = lerp(a.intensity, b.intensity, t);
    light.angle = lerp(a.angle, b.angle, t);
    light.penumbra = lerp(a.penumbra, b.penumbra, t);
    light.distance = lerp(a.distance, b.distance, t);
    light.color.copy(a.color).lerp(b.color, t);

    // The nearer keyframe's effect is the active one (so beats carry their own
    // motion); drop all effect motion under reduced-motion.
    const eff = raw < 0.5 ? a.effect : b.effect;
    if (!reducedMotion.value && eff && eff.type !== "none") {
      applyEffect(eff, elapsed, light, target.position);
    }

    light.intensity *= m;
    const lit = on && light.intensity > 0.001;
    light.visible = lit;

    // Volumetric beam: a cone from the source to the aim point, sized by the
    // real cone angle, fading along its length; brightness tracks the light.
    if (cones && lit) {
      dir.subVectors(target.position, light.position);
      const len = dir.length();
      if (len > 1e-4) {
        cone.position.copy(light.position);
        dir.multiplyScalar(1 / len);
        quat.setFromUnitVectors(AXIS_Z, dir);
        cone.quaternion.copy(quat);
        // Same half-angle as the light (capped just under PI/2 so tan stays finite).
        const baseR = Math.max(0.01, len * Math.tan(Math.min(light.angle, 1.5)));
        cone.scale.set(baseR, baseR, len);
        coneMat.color.copy(light.color);
        coneMat.opacity = coneOp * (0.35 + 0.65 * Math.min(1, light.intensity / 10));
        cone.visible = true;
      } else {
        cone.visible = false; // degenerate beam (source ≈ aim) — just hide it
      }
    } else {
      cone.visible = false;
    }

    // Dev marker (dev-only): a bright dot at the light source, tinted to it.
    if (unit.marker && unit.markerMat) {
      unit.marker.visible = help && lit;
      if (unit.marker.visible) {
        unit.marker.position.copy(light.position);
        unit.markerMat.color.copy(light.color);
      }
    }
  }
});

onBeforeUnmount(() => {
  beamGeom.dispose();
  markerGeom?.dispose();
  for (const u of pool) {
    u.coneMat.dispose();
    u.markerMat?.dispose();
    u.light.dispose();
  }
});
</script>

<template>
  <TresGroup name="spotlightRig">
    <template v-for="(tr, i) in rtTracks" :key="i">
      <primitive :object="tr.unit.light" />
      <primitive :object="tr.unit.target" />
      <primitive :object="tr.unit.cone" />
      <primitive v-if="tr.unit.marker" :object="tr.unit.marker" />
    </template>
  </TresGroup>
</template>
