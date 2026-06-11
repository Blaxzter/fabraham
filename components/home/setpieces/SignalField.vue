<script setup lang="ts">
import { shallowRef, onBeforeUnmount } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import type { Object3D } from "three";

/**
 * The finale set-piece: a **transmission** from the terminal into the head.
 *
 * Both ends are anchored to real things, not fixed world coords:
 *  - the FOREHEAD is a head-local offset transformed by the head's live world
 *    matrix each frame, so it rotates + floats *with* the head;
 *  - the EMITTER is the contact card's on-screen position (published by
 *    ContactSection via useElementBounding) projected into 3D through the camera,
 *    so it tracks the card across viewport/scroll.
 *
 * Ripples are born at the emitter and stream up the link line, shrinking, until
 * they converge into the forehead. A small ring marks the source; each typed
 * command (store.pulseSeq) fires a bright, fast ripple along the same path.
 *
 * Line primitives only (reads through the ASCII post-process), drawn via the
 * selective overlay (SceneSetPieces). `reveal` (scroll-driven) fades it in while
 * the contact beat centres. Disposes everything on unmount.
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

const store = useSectionsStore();
const { scene, camera } = useTresContext();

const COLOR = new Color("#00ff9c");
const BURST_COLOR = new Color("#eafff6"); // brighter — a command's pulse

// Live-tunable in dev (dev panel); these defaults are baked into the build.
// The group id matches the "signalField" set-piece name, so the dev panel's
// scenes tab shows these controls under every scene that renders it (the finale).
const tune = useTuning("signalField", "Signal Field");
// Head-LOCAL offset of the forehead (rotates/floats with the head).
const forehead = tune.vec3(
  "forehead",
  { x: 0.0, y: 0.33, z: 0.22 },
  { min: -1, max: 1, step: 0.01, anchor: "head", label: "Forehead (head-local)" }
);
// The CLI emitter is projected from the card; these only fine-tune that result.
const emitterPlaneZ = tune.num("emitterPlaneZ", 0.0, { min: -1, max: 1, step: 0.02, label: "Emitter plane z" });
const emitterNudge = tune.vec3(
  "emitterNudge",
  { x: 0, y: 0, z: 0 },
  { min: -1, max: 1, step: 0.01, label: "Emitter nudge (world)" }
);
const rStart = tune.num("rStart", 0.42, { min: 0, max: 1.5, step: 0.01, label: "Ring radius @ emitter" });
const rEnd = tune.num("rEnd", 0.04, { min: 0, max: 0.6, step: 0.01, label: "Ring radius @ forehead" });
const period = tune.num("period", 2.6, { min: 0.5, max: 8, step: 0.1, label: "Stream period (s)" });

const EMITTER_R = 0.11; // little ring marking the source at the terminal
const R_START_BURST = 0.58; // a command ripple starts a little wider
const BURST_DUR = 0.72; // seconds for a command ripple to stream in
const RING_COUNT = 5; // ambient ripples in flight at once
const RING_SEGMENTS = 96; // smoothness of each ring
const EMITTER_FALLBACK = new Vector3(0.85, 0, 0); // if the card anchor isn't ready

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (t: number) => t * t * (3 - 2 * t); // ease the travel
// Fade in at the emitter, stay bright across the gap, snap out as it lands.
const arrival = (t: number) =>
  Math.min(clamp01(t / 0.18), clamp01((1 - t) / 0.06));

// One shared unit-circle (radius 1, XY plane) — every ring is this scaled +
// translated, so the geometry is built once and reused.
const circleGeom = new BufferGeometry();
{
  const pos = new Float32Array(RING_SEGMENTS * 3);
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    pos[i * 3] = Math.cos(a);
    pos[i * 3 + 1] = Math.sin(a);
    pos[i * 3 + 2] = 0;
  }
  circleGeom.setAttribute("position", new BufferAttribute(pos, 3));
}

// The faint link line (emitter → forehead) — endpoints updated each frame.
const linkGeom = new BufferGeometry();
linkGeom.setAttribute(
  "position",
  new BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3)
);

const ringMaterials = Array.from(
  { length: RING_COUNT },
  () =>
    new LineBasicMaterial({
      color: COLOR,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
);
const rings = ringMaterials.map((mat) => {
  const loop = new LineLoop(circleGeom, mat);
  loop.frustumCulled = false; // drawn in the overlay pass; don't cull on the main cam
  return loop;
});

const linkMaterial = new LineBasicMaterial({
  color: COLOR,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const link = new LineSegments(linkGeom, linkMaterial);
link.frustumCulled = false;

// Small ring marking the source at the terminal — pulses + flares on a command.
const emitterMaterial = new LineBasicMaterial({
  color: COLOR,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const emitterRing = new LineLoop(circleGeom, emitterMaterial);
emitterRing.frustumCulled = false;

const burstMaterial = new LineBasicMaterial({
  color: BURST_COLOR,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
});
const burstRing = new LineLoop(circleGeom, burstMaterial);
burstRing.frustumCulled = false;
burstRing.visible = false;
let lastSeq = store.pulseSeq; // edge-detect new commands (don't fire on mount)
let burstT0 = -Infinity; // elapsed time the current burst started

// Reused scratch — no per-frame allocation (issue #4).
const foreheadWorld = new Vector3();
const emitterWorld = new Vector3();
const ndc = new Vector2();
const ray = new Raycaster();
const plane = new Plane(new Vector3(0, 0, 1), 0);
let headGroup: Object3D | null = null;

const groupRef = shallowRef<Group | null>(null);

// Place a ring at progress p along emitter → forehead (world), shrinking as it
// goes. The piece's group sits at the origin, so world == local here.
const placeAt = (obj: LineLoop, p: number, r0: number) => {
  const e = smooth(p);
  obj.position.set(
    emitterWorld.x + (foreheadWorld.x - emitterWorld.x) * e,
    emitterWorld.y + (foreheadWorld.y - emitterWorld.y) * e,
    emitterWorld.z + (foreheadWorld.z - emitterWorld.z) * e
  );
  obj.scale.setScalar(r0 + (rEnd.value - r0) * p);
};

const { onBeforeRender } = useLoop();
onBeforeRender(({ elapsed }) => {
  const group = groupRef.value;
  if (!group) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;

  // Forehead: head-local offset → world, following the head's live rotation/float.
  if (!headGroup) headGroup = scene.value?.getObjectByName("headGroup") ?? null;
  if (headGroup) {
    headGroup.updateWorldMatrix(true, false);
    foreheadWorld
      .set(forehead.x, forehead.y, forehead.z)
      .applyMatrix4(headGroup.matrixWorld);
  } else {
    foreheadWorld.set(forehead.x, forehead.y, forehead.z);
  }

  // Emitter: project the contact card's screen anchor onto the z=plane so it
  // tracks the card across viewport/scroll; fall back to a fixed point.
  const cam = camera.activeCamera.value;
  const anchor = store.contactAnchor;
  let placed = false;
  if (cam && anchor) {
    cam.updateMatrixWorld();
    ndc.set(anchor.x, anchor.y);
    ray.setFromCamera(ndc, cam);
    plane.constant = -emitterPlaneZ.value;
    placed = !!ray.ray.intersectPlane(plane, emitterWorld);
  }
  if (!placed) emitterWorld.copy(EMITTER_FALLBACK);
  emitterWorld.x += emitterNudge.x;
  emitterWorld.y += emitterNudge.y;
  emitterWorld.z += emitterNudge.z;

  // Refresh the link line + source ring from the live anchors.
  const lp = linkGeom.getAttribute("position") as BufferAttribute;
  lp.setXYZ(0, emitterWorld.x, emitterWorld.y, emitterWorld.z);
  lp.setXYZ(1, foreheadWorld.x, foreheadWorld.y, foreheadWorld.z);
  lp.needsUpdate = true;
  emitterRing.position.copy(emitterWorld);

  // Ambient transmission: a stream of ripples that shrink as they converge in.
  for (let i = 0; i < rings.length; i++) {
    const t = ((elapsed / period.value) + i / RING_COUNT) % 1;
    placeAt(rings[i]!, t, rStart.value);
    ringMaterials[i]!.opacity = reveal * arrival(t) * 0.6;
  }

  // The channel, gently alive.
  linkMaterial.opacity = reveal * (0.07 + 0.05 * (0.5 + 0.5 * Math.sin(elapsed * 1.5)));

  // Command pulse: a bright, fast ripple from the terminal into the forehead.
  const seq = store.pulseSeq;
  if (seq !== lastSeq) {
    lastSeq = seq;
    burstT0 = elapsed;
  }
  const bt = (elapsed - burstT0) / BURST_DUR;
  if (bt >= 0 && bt < 1) {
    burstRing.visible = true;
    placeAt(burstRing, bt, R_START_BURST);
    burstMaterial.opacity =
      reveal * Math.min(clamp01(bt / 0.08), clamp01((1 - bt) / 0.06));
  } else {
    burstRing.visible = false;
  }

  // Source ring: gentle idle pulse + a bright flare as a command leaves the CLI.
  const flare = bt >= 0 && bt < 0.3 ? 1 - bt / 0.3 : 0;
  emitterMaterial.opacity =
    reveal * (0.3 + 0.18 * (0.5 + 0.5 * Math.sin(elapsed * 3)) + 0.5 * flare);
  emitterRing.scale.setScalar(EMITTER_R * (1 + 0.5 * flare));
});

onBeforeUnmount(() => {
  circleGeom.dispose();
  linkGeom.dispose();
  for (const m of ringMaterials) m.dispose();
  linkMaterial.dispose();
  emitterMaterial.dispose();
  burstMaterial.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <primitive :object="link" />
    <primitive :object="emitterRing" />
    <primitive v-for="(ring, i) in rings" :key="i" :object="ring" />
    <primitive :object="burstRing" />
  </TresGroup>
</template>
