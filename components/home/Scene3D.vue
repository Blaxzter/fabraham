<script setup lang="ts">
import { TresCanvas } from "@tresjs/core";
import { OrbitControls, useGLTF } from "@tresjs/cientos";
import { EffectComposerPmndrs } from "@tresjs/post-processing";
import { NoToneMapping, Box3, Vector3 } from "three";
import type { Group, Material, MeshPhysicalMaterial, Object3D, PerspectiveCamera } from "three";
import { useWindowSize } from "@vueuse/core";
import { fovForAspect } from "~/lib/frame";
import SceneSetPieces from "./SceneSetPieces.vue";
import HeroGlyphs from "./HeroGlyphs.vue";
import HeroAscii from "./HeroAscii.vue";
import ScrollSpotlights from "./ScrollSpotlights.vue";
import CursorOrb from "./CursorOrb.vue";
import Planets from "./Planets.vue";
import TuningGizmos from "./TuningGizmos.vue";
import SceneWarmup from "./SceneWarmup.vue";
import RenderGovernor from "./RenderGovernor.vue";

const store = useSceneControlStore();
const bootState = useBootStateStore();
const sectionsStore = useSectionsStore();
const quality = useRenderQuality();
const isDev = import.meta.dev;

const modelRef = shallowRef<Object3D | null>(null);
const cameraRef = shallowRef<PerspectiveCamera | null>(null);
const orbitControlsRef = shallowRef<InstanceType<typeof OrbitControls> | null>(
  null
);
const boundingBox = shallowRef<Box3 | null>(null);
const boxSize = shallowRef<Vector3>(new Vector3());
const boxCenter = shallowRef<Vector3>(new Vector3());
const modelOffset = shallowRef<Vector3>(new Vector3());
// The head holds a resting profile for the whole scroll, then turns to address
// the visitor at the finale (see onLoop). Rotation accumulators are mutated in
// the loop and applied imperatively to the Three group — never reactive props
// (issue #4).
// The head's per-scene BASE pose (position + rotation) is now a keyframe track in
// the sections store (edited in the dev panel scenes tab → Head; see headAt),
// replacing the old constant resting yaw. These remaining angles are the finale
// ---- Model-space face correction (the one place it is applied) --------------
// `head.glb` is authored ALREADY TURNED — about 41 degrees to its own left — so
// the yaw that points the face at the camera is ~-0.72, not 0. Rather than make
// every author and every generator remember that offset (they will not; the
// skills gaze was built around 0 and spent the chapter showing an ear), it is
// corrected exactly once, here, on the way to the Object3D.
//
// So EVERYWHERE ELSE — head keyframes, generated gazes, the dev panel's scenes
// tab, the addressing pose below — yaw 0 means FACE-ON and positive means
// screen-right. Nothing downstream knows the model is crooked.
//
// It is tunable rather than a constant so a new head model can be corrected
// without touching a single animation: dial "Face-on yaw" until the resting head
// looks straight down the lens and export. To re-measure it for a new model, see
// the note in docs/scroll-3d-architecture.md ("Yaw 0 is face-on").
const tuneModel = useTuning("headModel", "Head model");
const faceYaw = tuneModel.num("faceYaw", -0.72, {
  min: -3.2,
  max: 3.2,
  step: 0.01,
  label: "Face-on yaw (model correction)",
});
/**
 * How hard the head chases its target rotation each frame, at 60fps.
 *
 * This is RESPONSIVENESS, not amplitude — the two are easy to confuse when the
 * turn feels wrong. The keyframe tracks decide how FAR the head turns; this
 * decides how long it takes to get there once the scroll has moved the target.
 * At 0.12 the head lagged the scroll by ~90ms and read as sluggish, as though it
 * noticed each card late; 0.28 was still behind. At 0.45 it is ~15ms — the turn
 * lands with the card instead of trailing it, without the swing itself getting any
 * wider.
 *
 * Still damped rather than instant: the contact beat rides the cursor on top of
 * this, and un-damped pointer input jitters.
 */
const turnSpeed = tuneModel.num("turnSpeed", 0.45, {
  min: 0.04,
  max: 1,
  step: 0.01,
  label: "Turn response (per frame @60fps)",
});

// "addressing" OVERLAY: at the contact beat the head turns from its keyframed
// rotation toward the CLI, with a cursor parallax. Live-tunable, tagged to contact.
const tuneHead = useTuning("headAddress", "Head addressing", "contact");
const addressYaw = tuneHead.num("addressYaw", 1.17, { min: -2.5, max: 2.5, step: 0.01, label: "Address yaw (toward CLI)" });
const addressPitch = tuneHead.num("addressPitch", 0.02, { min: -1, max: 1, step: 0.01, label: "Address pitch" });
/**
 * The same turn on a phone, where there is no "toward the CLI" to the side: the
 * portrait finale stacks the head ABOVE the terminal, so it addresses the card
 * by looking down at it, square to the lens. Positive pitch is chin-down.
 */
const portraitAddressYaw = tuneHead.num("portraitAddressYaw", 0, { min: -2.5, max: 2.5, step: 0.01, label: "Portrait: address yaw" });
const portraitAddressPitch = tuneHead.num("portraitAddressPitch", 0.28, { min: -1, max: 1, step: 0.01, label: "Portrait: address pitch (down at the card)" });
const maxYaw = tuneHead.num("maxYaw", 0.22, { min: 0, max: 1, step: 0.01, label: "Cursor yaw range" });
const maxPitch = tuneHead.num("maxPitch", 0.14, { min: 0, max: 1, step: 0.01, label: "Cursor pitch range" });
/**
 * Whether the head watches the ORB or the cursor itself.
 *
 * At 1 the gaze is aimed at the fly (`CursorOrb`), which is a damped, wandering
 * thing that hovers near the pointer and lags behind a fast move — so the head
 * reads as tracking something alive in the room rather than as being wired to the
 * mouse. At 0 it goes back to the raw pointer. The two only diverge by a few
 * percent of the parallax range while the cursor is still; the difference shows
 * when it moves, which is the point.
 *
 * It scales the orb's own fade rather than replacing it, so whenever there is no
 * orb to look at — before the contact beat, under reduced motion, on a touch
 * device — the head is back on the pointer with nothing to configure.
 */
const followOrb = tuneHead.num("followOrb", 1, { min: 0, max: 1, step: 0.05, label: "Follow the orb (vs the cursor)" });

// The constant base lighting the scroll spotlights sit on top of. Lives in the
// spotlights store (edited in the dev panel's Spotlights section, alongside the
// rig knobs); lower the base fill to deepen the dark so the "tada" reveal pops.
const spotlights = useSpotlightsStore();

const headRotationY = shallowRef(0.28); // seeded to the resting yaw to avoid a first-frame swing
const headRotationX = shallowRef(0);
const headRotationZ = shallowRef(0);
const wireFrameRotationY = shallowRef(0);
const headGroupRef = shallowRef<Group | null>(null);
const wireframeGroupRef = shallowRef<Group | null>(null);

// Cursor position (normalised -1..1) from the shared `usePointer` singleton —
// one listener for the whole app, since the set-pieces react to the cursor too
// (the Berlin skyline parallaxes against it). Always recorded; only *applied* to
// the head while the contact beat is centered (store.tracking — the turn itself
// outlives it, see the loop). Honour
// reduced-motion by dropping the cursor-follow — the head still turns to face
// front. The preference resolves OS prefers-reduced-motion + the /setup override.
const { pointer } = usePointer();
const { reducedMotion } = usePreferences();
// Where the cursor orb is on screen, in the same -1..1 screen-space shape as
// `pointer` so the two are interchangeable inputs to the gaze below. Plain
// object, rewritten by CursorOrb each frame and read here each frame — never a
// ref, because a value that changes every frame has no business in the
// reactivity graph (issue #4). `influence` is 0 whenever there is no orb.
const orbGaze = useCursorOrb();

// ASCII and rendering configuration
//
// `antialias` is the canvas' own MSAA, and all it smooths is the line overlay:
// the ASCII pass is a full-screen quad, which has no edges. It is a context
// attribute, fixed when the canvas is created, so it is read once here; the
// tiers that turn it off are the ones where every sample is CPU time.
const gl = {
  toneMapping: NoToneMapping,
  antialias: quality.antialias.value,
};

// The composer's buffer is where the lit scene is drawn, and HeroAscii keeps it
// far smaller than the screen and sets its sample count per quality tier (see
// "The scene buffer" there). No normal pass: nothing reads normals, and TresJS
// otherwise builds one, disabled, with a full-size target of its own.
const glComposer = {
  multisampling: quality.sceneSamples.value,
  disableNormalPass: true,
};
// `EffectComposerPmndrs` exposes its composer; HeroAscii and SceneWarmup need
// the instance itself.
const composerHost = shallowRef<InstanceType<typeof EffectComposerPmndrs> | null>(null);
const composer = computed(() => composerHost.value?.composer ?? null);

// Load the head model. Textures are 1024² WebP (EXT_texture_webp); geometry is
// ~10k verts uncompressed — no DRACO in the file, so no decoder is loaded
// (`pnpm optimize:model` rebuilds this asset; see package.json).
//
// The bytes come down through `downloadWithProgress` first so the boot screen's
// memory test can count them (stores/BootState.ts); the loader then parses from
// memory. That also makes the `await` real — `useGLTF` itself returns at once —
// so "scene ready" below means the model is actually here. If the fetch fails
// the loader falls back to the plain path and the boot just loses its readout.
const HEAD_GLB_PATH = "/models/head.glb";
const HEAD_GLB_BYTES = 453_180; // the file's size as of this writing, for a missing Content-Length
let headUrl = HEAD_GLB_PATH;
if (import.meta.client) {
  try {
    headUrl = await downloadWithProgress(HEAD_GLB_PATH, bootState.setLoadProgress, HEAD_GLB_BYTES);
  } catch {
    headUrl = HEAD_GLB_PATH;
  }
}
const { state: gltfModel } = await useGLTF(headUrl);
// The blob URL has done its job once the model is parsed.
if (headUrl.startsWith("blob:")) {
  const stopRevoke = watch(gltfModel, (m) => {
    if (!m) return;
    URL.revokeObjectURL(headUrl);
    stopRevoke();
  });
}

// Extract the scene from the GLTF model
const gltfScene = computed(() => gltfModel.value?.scene);

// --- Head fade -----------------------------------------------------------------
// The head keyframe track carries an `opacity` so a scene can cut the head away
// and bring it back instead of always interpolating it across the frame (the
// skills chapter uses this to give each card its own pass). Materials are
// collected ONCE per model load, so the render loop only writes numbers — no
// traversal per frame (issue #4).
const headMaterials = shallowRef<Material[]>([]);
watch(
  gltfScene,
  (scene) => {
    const found: Material[] = [];
    // Structural read rather than a `Mesh` cast: @types/three resolves Object3D
    // through two module paths here, so the nominal cast doesn't typecheck (the
    // same quirk SignalField hits).
    scene?.traverse((o) => {
      const m = (o as unknown as { material?: Material | Material[] }).material;
      if (!m) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        if (!found.includes(mat)) found.push(mat);
      }
    });
    headMaterials.value = found;
  },
  { immediate: true }
);
// Only touch the materials when the value actually moves — a fade is a handful
// of frames, not every frame.
let lastHeadOpacity = -1;
const applyHeadOpacity = (opacity: number) => {
  if (opacity === lastHeadOpacity) return;
  lastHeadOpacity = opacity;
  // Fully faded → hide the group outright. That also drops it from the
  // depth-occluder pass, so set-pieces aren't masked by an invisible head.
  const visible = opacity > 0.004;
  if (headGroupRef.value) headGroupRef.value.visible = visible;
  if (!visible) return;
  const solid = opacity > 0.999;
  for (const m of headMaterials.value) {
    // depthWrite is left alone: turning it off mid-fade makes the back of the
    // head show through the front.
    //
    // `needsUpdate` on the flip, because opaque and transparent are two
    // different programs (an opaque one writes alpha 1 whatever `opacity` says).
    // It used to be picked up without this, by accident: the extra passes each
    // frame change the renderer's light state, which sends every lit material
    // back through program selection anyway.
    if (m.transparent === solid) {
      m.transparent = !solid;
      m.needsUpdate = true;
    }
    m.opacity = opacity;
  }
};

// The model is here. The scene is not ready until it has drawn and compiled its
// shaders, which SceneWarmup reports from inside the canvas; the timer is the
// way out if the canvas never draws at all, so the boot cannot wait forever on
// a scene that is not coming.
if (import.meta.client) {
  bootState.markModelReady();
  setTimeout(() => bootState.markSceneReady(), 8000);
}

// Setup render loop to track camera changes
const TWO_PI = Math.PI * 2;

const onLoop = ({ delta, elapsed }: { delta: number; elapsed: number }) => {
  // Camera ownership depends on the mode.
  if (store.cameraControlMode === "orbit") {
    // Orbit (dev): the user drives the camera; mirror it back into the store so
    // the controls panel reflects the current pose.
    const position = cameraRef.value?.position;
    const rotation = cameraRef.value?.rotation;
    if (position && rotation) {
      store.cameraPosition.x = Math.round(position.x * 100) / 100;
      store.cameraPosition.y = Math.round(position.y * 100) / 100;
      store.cameraPosition.z = Math.round(position.z * 100) / 100;

      store.cameraRotation.x = Math.round(rotation.x * 100) / 100;
      store.cameraRotation.y = Math.round(rotation.y * 100) / 100;
      store.cameraRotation.z = Math.round(rotation.z * 100) / 100;
    }
  } else if (sectionsStore.enabled && cameraRef.value) {
    // Scroll: drive the camera imperatively from the scroll progress — no
    // reactive camera props, no per-frame layout reads (issue #4).
    const pose = sectionsStore.cameraAt(sectionsStore.progress);
    const cam = cameraRef.value;
    cam.position.set(pose.position.x, pose.position.y, pose.position.z);
    cam.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
  }

  // Head pose: a scroll-driven BASE pose (position offset + rotation) from the
  // head keyframe track, with the finale "addressing" turn + cursor parallax
  // overlaid on the rotation. The base position is applied directly (scroll-
  // interpolated, smooth); the rotation is smoothed (frame-rate-independent) so
  // the cursor parallax doesn't jitter. No extra rAF or layout read (issue #4).
  const headPose = sectionsStore.headAt(sectionsStore.progress);
  applyHeadOpacity(headPose.opacity);
  headGroupRef.value?.position.set(
    headPose.position.x,
    headPose.position.y,
    headPose.position.z
  );
  // At the contact beat, addressing ramps 0→1 and swings the head from its
  // keyframed rotation toward the CLI; the cursor parallax rides on top (dropped
  // under prefers-reduced-motion, but the turn itself still happens).
  //
  // The two do not end together. The TURN holds for the rest of the page — the
  // coda is still addressing the visitor — while the TRACKING is released as the
  // coda opens, handing the face over to the planets (`tracking` in the sections
  // store). So this is `tracking`, not `addressing`.
  const addressing = sectionsStore.addressing;
  const cursorScale = reducedMotion.value ? 0 : sectionsStore.tracking;
  const toYaw = sectionsStore.portrait ? portraitAddressYaw.value : addressYaw.value;
  const toPitch = sectionsStore.portrait ? portraitAddressPitch.value : addressPitch.value;
  const baseYaw = headPose.rotation.y * (1 - addressing) + toYaw * addressing;
  const basePitch = headPose.rotation.x * (1 - addressing) + toPitch * addressing;
  // What the head is actually watching. The orb, when there is one — it hovers
  // near the cursor and lags a fast move, so the gaze inherits that life instead
  // of being pinned to the pointer — blending back to the raw cursor by however
  // much of an orb there is (`influence` follows its fade, and is 0 before the
  // contact beat, under reduced motion, and on touch).
  const orbMix = orbGaze.influence * followOrb.value;
  const aimX = pointer.value.x + (orbGaze.x - pointer.value.x) * orbMix;
  const aimY = pointer.value.y + (orbGaze.y - pointer.value.y) * orbMix;
  const targetY = baseYaw + aimX * maxYaw.value * cursorScale;
  const targetX = basePitch + aimY * maxPitch.value * cursorScale;
  // Frame-rate independent: the per-frame factor is re-based onto this frame's
  // actual delta, so the feel is identical at 30, 60 or 144fps.
  const ease = 1 - Math.pow(1 - turnSpeed.value, delta * 60);
  // Yaw chases the SHORTEST way round, not the shortest numeric distance.
  //
  // For everything authored by hand this changes nothing — every one of those
  // angles is well inside half a turn, so the wrap below is a no-op. It matters
  // for a track that WINDS: the projects chapter turns the head after the vine's
  // growing tip, which goes all the way around, so that track accumulates two
  // full turns and hands over to a neighbour that quite reasonably asks for 0.
  // Read numerically that is a two-turn unwind; read as an angle it is no motion
  // at all, which is also what it looks like. Pitch is never more than a nod, so
  // it is left alone.
  const dYaw = targetY - headRotationY.value;
  headRotationY.value += (dYaw - TWO_PI * Math.round(dYaw / TWO_PI)) * ease;
  headRotationX.value += (targetX - headRotationX.value) * ease;
  headRotationZ.value += (headPose.rotation.z - headRotationZ.value) * ease;
  // Apply imperatively to the Three group — no reactive prop patching (issue #4).
  // `faceYaw` is added HERE and nowhere else: everything above works in face-on
  // space, and this is the only line that knows the model is authored crooked.
  headGroupRef.value?.rotation.set(
    headRotationX.value,
    headRotationY.value + faceYaw.value,
    headRotationZ.value
  );

  wireFrameRotationY.value = elapsed * 0.5;
  wireframeGroupRef.value?.rotation.set(0, wireFrameRotationY.value, 0);
};

// Calculate bounding box once the model ref is available
watch(
  modelRef,
  async (newModel) => {
    if (newModel) {
      await nextTick();
      // REPLACE these refs, never mutate them in place: they are `shallowRef`s,
      // so `.copy()` on the vector inside one changes no reactive dependency and
      // the `:position` binding below never re-renders. In dev that went unseen
      // (the panel's reactivity re-renders this component often enough to pick
      // the mutated vector up); in the built site nothing else invalidates it, so
      // the head kept the initial (0,0,0) offset and sat ~2.4 units above frame —
      // present, lit and pointed at, but never on screen. One assignment per
      // model load, so the extra vectors cost nothing.
      const box = new Box3().setFromObject(newModel);
      boundingBox.value = box;
      boxSize.value = box.getSize(new Vector3());
      boxCenter.value = box.getCenter(new Vector3());

      // Calculate offset to center the model at origin
      modelOffset.value = boxCenter.value.clone().negate();

      // Also tag the head onto layer 2 (keeping the default layer 0). The
      // set-piece overlay (SceneSetPieces.vue) renders this layer depth-only as
      // an occluder so the head hides the back of the graph set-piece — the face
      // sits *inside* the lattice. Keep in sync with HEAD_LAYER there.
      newModel.traverse((o) => o.layers.enable(2));
    }
  },
  { immediate: true }
);

// Seed the camera with a sane pose as soon as it mounts (matches the timeline
// fallback). This avoids a first-frame origin "flash" before onLoop runs and
// gives OrbitControls (dev) a non-degenerate starting radius.
watch(
  cameraRef,
  (cam) => {
    if (!cam) return;
    cam.position.set(0.06, 0.04, 0.51);
    cam.rotation.set(-0.09, 0.13, 0.01);
  },
  { immediate: true }
);

/**
 * Entering EXPLORE mode: pull the camera back to a wide three-quarter pose.
 *
 * Without this, orbit starts from wherever the scroll left the camera — which is
 * a close-up of the face at z≈0.5 with the head filling the frame. OrbitControls
 * would then take that tiny radius as its orbit distance and you would swing
 * around the inside of the model, which reads as broken rather than as a free
 * camera. This puts you back and to the side, where the head reads as an object
 * and the stack field can be seen streaming past it.
 *
 * `flush: "pre"` matters: it runs BEFORE the render that mounts OrbitControls, so
 * the controls read this pose as their starting radius instead of snapping the
 * camera on their first frame. The dev panel's own orbit toggle deliberately does
 * not come through here — inspecting a pose means keeping the pose you are on.
 */
watch(
  () => store.exploreMode,
  (on) => {
    const cam = cameraRef.value;
    if (!on || !cam) return;
    cam.position.set(2.5, 1.15, 3.6);
    cam.lookAt(0, 0, 0);
  },
  { flush: "pre" }
);

// --- Backdrop floor fade ----------------------------------------------------------
// The backdrop is one lit sweep — a floor running from under the camera back to
// a wall that curves up behind the head — and it goes through the ASCII pass
// like the face does. Far away that is the faint character texture behind
// everything, which is part of the look. Up close it is not: the near floor is
// the bit of it nearest the lights and nearest the lens, and at the bottom of
// every frame it turned into a flat field of grey characters (tinted red and
// violet by the planets at the coda) that read as nothing but noise.
//
// So the floor fades out, by world HEIGHT: `fadeFloor` at floor level (the
// whole floor sits at y=-2), back to full strength by `fadeTop`, a little way up
// the wall. Height rather than depth because the cameras look slightly down: the
// bottom edge of the frame meets the floor around z≈-2.3, well behind the head,
// so a fade toward the lens missed nearly all of the floor that is in shot.
// Injected into the material's own shader rather than a second mesh or a
// texture: one uniform write per tuning change, nothing per frame.
const tuneBackdrop = useTuning("backdrop", "Backdrop");
const FLOOR_Y = -2; // the backdrop group's y in the template below
// 0.5, not just above the floor: the backdrop's curve rises gently out of the
// floor, and that low slope is what caught the planets' light as the red haze.
const fadeTop = tuneBackdrop.num("fadeTop", 0.5, { min: -2, max: 3, step: 0.05, label: "Floor fade · full strength from y" });
const fadeFloor = tuneBackdrop.num("fadeFloor", 0, { min: 0, max: 1, step: 0.01, label: "Floor fade · brightness at the floor" });
const backdropUniforms = {
  uFadeBottom: { value: FLOOR_Y },
  uFadeTop: { value: fadeTop.value },
  uFadeFloor: { value: fadeFloor.value },
};
watchEffect(() => {
  // Kept above the floor: smoothstep with equal (or crossed) edges is undefined.
  backdropUniforms.uFadeTop.value = Math.max(FLOOR_Y + 0.01, fadeTop.value);
  backdropUniforms.uFadeFloor.value = fadeFloor.value;
});
const backdropMatRef = shallowRef<MeshPhysicalMaterial | null>(null);
watch(backdropMatRef, (mat) => {
  if (!mat) return;
  mat.onBeforeCompile = (shader) => {
    // Shared objects, so the watchEffect above reaches the compiled program.
    Object.assign(shader.uniforms, backdropUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vFadeY;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvFadeY = (modelMatrix * vec4(transformed, 1.0)).y;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vFadeY;\nuniform float uFadeBottom;\nuniform float uFadeTop;\nuniform float uFadeFloor;"
      )
      .replace(
        "#include <dithering_fragment>",
        "gl_FragColor.rgb *= mix(uFadeFloor, 1.0, smoothstep(uFadeBottom, uFadeTop, vFadeY));\n#include <dithering_fragment>"
      );
  };
  mat.needsUpdate = true;
}, { immediate: true });

// Keep the camera aspect matched to the (window-size) canvas so the scene isn't
// stretched. The hard-coded aspect=1 distorted everything on wide viewports.
const { width: windowWidth, height: windowHeight } = useWindowSize();

/**
 * The lens is shared, not local.
 *
 * `fovForAspect` lives in `~/lib/frame` because the biography's choreography has
 * to measure the frame this lens produces in order to keep the head inside it
 * (see `frameHalfAt` there, and `biography.ts`). Two copies of the widening
 * formula would be two chances for the scene and the generators to disagree
 * about how wide the world is — which is exactly the bug that put the head off
 * the side of a phone in the first place.
 */
watch(
  [cameraRef, windowWidth, windowHeight],
  () => {
    const cam = cameraRef.value;
    if (!cam) return;
    const aspect = (windowWidth.value || 1) / (windowHeight.value || 1);
    cam.aspect = aspect;
    cam.fov = fovForAspect(aspect);
    cam.updateProjectionMatrix();
  },
  { immediate: true }
);
</script>

<template>
  <!-- Capped at 60 fps: on a 120/144 Hz screen the scene otherwise renders two
       to two and a half times as often as it needs to, and every one of those
       frames is the full scene plus the ASCII pass. `fps-limit` is backported
       into @tresjs/core 5.2.1 by patches/@tresjs__core@5.2.1.patch.

       The cap and the pixel ratio both come from the quality tier (see
       useRenderQuality): the display's own ratio and 60 on a GPU that keeps
       up, less where it does not.

       No `shadows`. Nothing in the scene casts one (the lights say why: the
       ASCII grid hides the detail), so the shadow pass walked the whole scene
       every frame to draw an empty map, and the backdrop's shader sampled it
       at every fragment. -->
  <TresCanvas
    v-bind="gl"
    clear-color="#111"
    alpha
    window-size
    :dpr="quality.dpr.value"
    :fps-limit="quality.fps.value"
    @loop="onLoop"
  >
    <!-- Free camera. `minDistance` keeps you out of the inside of the head;
         `maxDistance` is generous because the stack field runs a long way back
         and pulling out to see all of it is half the point of explore mode.
         Damping because this is something a visitor drags, not a dev nudges. -->
    <OrbitControls
      v-if="store.cameraControlMode === 'orbit'"
      ref="orbitControlsRef"
      make-default
      :enable-damping="true"
      :damping-factor="0.08"
      :min-distance="0.8"
      :max-distance="45"
    />
    <!-- Camera pose is driven imperatively in onLoop (scroll) or by OrbitControls
         (dev), so no reactive position/rotation props here (issue #4). -->
    <!-- aspect AND fov are managed imperatively from the window size (see the
         watch above — narrow viewports widen the fov to keep the horizontal
         frame). The literal here is only the initial value, and is the same
         `BASE_FOV` that watch resolves to at any desktop aspect. -->
    <TresPerspectiveCamera
      ref="cameraRef"
      :fov="45"
      :near="0.1"
      :far="1000"
    />

    <Levioso
      :speed="store.floatSpeed"
      :rotation-factor="1"
      :float-factor="store.floatFactor"
    >
      <!-- name="headGroup" lets SignalField anchor the forehead point to the
           head's live world matrix (so it rotates/floats with the head). -->
      <TresGroup ref="headGroupRef" name="headGroup">
        <!-- Load the head model with offset to center it -->
        <primitive
          v-if="gltfScene"
          ref="modelRef"
          :object="gltfScene"
          :position="modelOffset.toArray()"
          :scale="[2, 2, 2]"
        />
      </TresGroup>
    </Levioso>

    <!-- Data-driven line set-pieces that bloom around the head per chapter. -->
    <SceneSetPieces />

    <!-- The fly: a glowing orb orbiting the cursor, in 3D between the head and
         the lens, for as long as the head is tracking the cursor (addressing),
         shedding sparks that fall away behind it. On the default layer, so it
         goes through the ASCII pass with the face rather than sitting on top. -->
    <CursorOrb />

    <!-- The coda: coloured lights on inclined orbits circling the head, painting
         the face as they pass. Comes up as the cursor tracking (and the fly with
         it) is released, so the last beat has exactly one thing moving around
         the head. Its lights live in the scene for the whole page at intensity
         0 — see the note in the component. -->
    <Planets />

    <!-- The hero name, as geometry. Renders to its OWN buffer on layer 4 (so it
         never lands on the face's coarse grid) which HeroAscii composites back
         in at its own cell size. -->
    <HeroGlyphs />

    <!-- Dev-only: markers for tunable vec3 anchors (forehead, emitter, …). -->
    <TuningGizmos v-if="isDev" />

    <!-- Dev-only: wireframe of the model bounding box, spinning slowly so its
         depth reads. Debug geometry — `isDev` so it can never reach a build. -->
    <TresGroup
      v-if="isDev && boundingBox && store.showWireframe"
      ref="wireframeGroupRef"
    >
      <TresMesh :position="[0, 0, 0]">
        <TresBoxGeometry :args="[boxSize.x, boxSize.y, boxSize.z]" />
        <TresMeshBasicMaterial color="#00ff00" wireframe />
      </TresMesh>
    </TresGroup>

    <!-- Dev-only: the Y rotation axis. Same reasoning as the wireframe. -->
    <TresGroup v-if="isDev && store.showRotationAxis">
      <TresMesh :position="[0, 0, 0]">
        <TresCylinderGeometry :args="[0.02, 0.02, 6, 8]" />
        <TresMeshBasicMaterial color="#ff0000" />
      </TresMesh>

      <!-- Axis labels using small spheres -->
      <!-- Y-axis top -->
      <TresMesh :position="[0, 3.2, 0]">
        <TresSphereGeometry :args="[0.08, 8, 6]" />
        <TresMeshBasicMaterial color="#ff0000" />
      </TresMesh>

      <!-- Y-axis bottom -->
      <TresMesh :position="[0, -3.2, 0]">
        <TresSphereGeometry :args="[0.08, 8, 6]" />
        <TresMeshBasicMaterial color="#ff0000" />
      </TresMesh>
    </TresGroup>

    <!-- Ground plane. A group, not a mesh: it only places the backdrop, and an
         empty TresMesh here was a geometry-less mesh in the scene (the one the
         TresJS devtools choked on with "reading 'count'"). -->
    <TresGroup :position="[0, -2, 0]" :scale="[10, 10, 10]">
      <Backdrop :floor="0.25" :segments="20">
        <TresMeshPhysicalMaterial ref="backdropMatRef" color="#444" :roughness="0.5" />
      </Backdrop>
    </TresGroup>

    <!-- Constant base lighting (tunable). The scroll spotlights add focused,
         scroll-driven light on top of this. -->
    <TresDirectionalLight :position="[5, 5, 5]" :intensity="spotlights.baseFill" />
    <TresAmbientLight :intensity="spotlights.baseAmbient" />

    <!-- Scroll-driven spotlight rig: dark through the hero, then lights kick on
         at the interlude and follow the scroll across the set-pieces. -->
    <ScrollSpotlights />

    <HomeLights />

    <!-- ASCII Post-processing Effect. Two grids: the face on the scroll-driven
         cell, the hero name on its own finer one. -->
    <Suspense>
      <EffectComposerPmndrs ref="composerHost" v-bind="glComposer">
        <HeroAscii :composer="composer" />
      </EffectComposerPmndrs>
    </Suspense>

    <!-- Compiles every shader while the boot screen is up, then reports the
         scene ready (the boot's handover waits for it). -->
    <SceneWarmup :composer="composer" />

    <!-- Watches the frame pacing and steps the quality down on a GPU that
         cannot keep up. -->
    <RenderGovernor />
  </TresCanvas>
</template>
