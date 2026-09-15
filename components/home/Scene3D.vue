<script setup lang="ts">
import { TresCanvas } from "@tresjs/core";
import { OrbitControls, useGLTF } from "@tresjs/cientos";
import { EffectComposerPmndrs, ASCIIPmndrs } from "@tresjs/post-processing";
import { NoToneMapping, Box3, Vector3 } from "three";
import type { Group, Material, Object3D, PerspectiveCamera } from "three";
import { useWindowSize } from "@vueuse/core";
import SceneSetPieces from "./SceneSetPieces.vue";
import ScrollSpotlights from "./ScrollSpotlights.vue";
import TuningGizmos from "./TuningGizmos.vue";

const store = useSceneControlStore();
const bootState = useBootStateStore();
const sectionsStore = useSectionsStore();
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
const maxYaw = tuneHead.num("maxYaw", 0.22, { min: 0, max: 1, step: 0.01, label: "Cursor yaw range" });
const maxPitch = tuneHead.num("maxPitch", 0.14, { min: 0, max: 1, step: 0.01, label: "Cursor pitch range" });

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
// the head while the contact beat is centered (store.addressing). Honour
// reduced-motion by dropping the cursor-follow — the head still turns to face
// front. The preference resolves OS prefers-reduced-motion + the /setup override.
const { pointer } = usePointer();
const { reducedMotion } = usePreferences();

// ASCII and rendering configuration
const gl = {
  toneMapping: NoToneMapping,
};

const glComposer = {
  multisampling: 4,
};

// Load the head model. Textures are 1024² WebP (EXT_texture_webp); geometry is
// ~10k verts uncompressed — no DRACO in the file, so no decoder is loaded
// (`pnpm optimize:model` rebuilds this asset; see package.json).
const { state: gltfModel } = await useGLTF("/models/head.glb");

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
    m.transparent = !solid;
    m.opacity = opacity;
  }
};

// Mark scene as ready for boot screen
if (import.meta.client) {
  bootState.markSceneReady();
}

// Setup render loop to track camera changes
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
  const addressing = sectionsStore.addressing;
  const cursorScale = reducedMotion.value ? 0 : addressing;
  const baseYaw = headPose.rotation.y * (1 - addressing) + addressYaw.value * addressing;
  const basePitch = headPose.rotation.x * (1 - addressing) + addressPitch.value * addressing;
  const targetY = baseYaw + pointer.value.x * maxYaw.value * cursorScale;
  const targetX = basePitch + pointer.value.y * maxPitch.value * cursorScale;
  // Frame-rate independent: the per-frame factor is re-based onto this frame's
  // actual delta, so the feel is identical at 30, 60 or 144fps.
  const ease = 1 - Math.pow(1 - turnSpeed.value, delta * 60);
  headRotationY.value += (targetY - headRotationY.value) * ease;
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

// Keep the camera aspect matched to the (window-size) canvas so the scene isn't
// stretched. The hard-coded aspect=1 distorted everything on wide viewports.
const { width: windowWidth, height: windowHeight } = useWindowSize();
watch(
  [cameraRef, windowWidth, windowHeight],
  () => {
    const cam = cameraRef.value;
    if (!cam) return;
    cam.aspect = (windowWidth.value || 1) / (windowHeight.value || 1);
    cam.updateProjectionMatrix();
  },
  { immediate: true }
);
</script>

<template>
  <TresCanvas
    v-bind="gl"
    clear-color="#111"
    shadows
    alpha
    window-size
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
    <!-- aspect is managed imperatively from the window size (see watch above). -->
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

    <!-- Ground plane -->
    <TresMesh :position="[0, -2, 0]" :scale="[10, 10, 10]">
      <Backdrop :floor="0.25" :segments="20" receive-shadow>
        <TresMeshPhysicalMaterial color="#444" :roughness="0.5" />
      </Backdrop>
    </TresMesh>

    <!-- Constant base lighting (tunable). The scroll spotlights add focused,
         scroll-driven light on top of this. -->
    <TresDirectionalLight :position="[5, 5, 5]" :intensity="spotlights.baseFill" cast-shadow />
    <TresAmbientLight :intensity="spotlights.baseAmbient" />

    <!-- Scroll-driven spotlight rig: dark through the hero, then lights kick on
         at the interlude and follow the scroll across the set-pieces. -->
    <ScrollSpotlights />

    <HomeLights />

    <!-- ASCII Post-processing Effect -->
    <Suspense>
      <EffectComposerPmndrs v-bind="glComposer">
        <ASCIIPmndrs v-bind="store.effectProps" />
      </EffectComposerPmndrs>
    </Suspense>
  </TresCanvas>
</template>
