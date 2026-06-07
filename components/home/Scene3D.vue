<script setup lang="ts">
import { TresCanvas } from "@tresjs/core";
import { OrbitControls, useGLTF } from "@tresjs/cientos";
import { EffectComposerPmndrs, ASCIIPmndrs } from "@tresjs/post-processing";
import { NoToneMapping, Box3, Vector3 } from "three";
import type { Group, Object3D, PerspectiveCamera } from "three";
import { useWindowSize } from "@vueuse/core";
import SceneSetPieces from "./SceneSetPieces.vue";

const store = useSceneControlStore();
const bootState = useBootStateStore();
const sectionsStore = useSectionsStore();

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
const RESTING_YAW = -0.8; // profile the head gazes in through the journey
const ADDRESS_YAW = 0.45; // at the finale, turn to look toward the terminal card (screen-right)
const ADDRESS_PITCH = 0.02;
const MAX_YAW = 0.22; // gentle cursor parallax once addressing the visitor
const MAX_PITCH = 0.14;
const headRotationY = shallowRef(RESTING_YAW);
const headRotationX = shallowRef(0);
const wireFrameRotationY = shallowRef(0);
const headGroupRef = shallowRef<Group | null>(null);
const wireframeGroupRef = shallowRef<Group | null>(null);

// Cursor position (normalised -1..1), always recorded; only *applied* to the head
// while the contact beat is centered (store.addressing). Honour reduced-motion by
// dropping the cursor-follow — the head still turns to face front.
const mousePosition = shallowRef({ x: 0, y: 0 });
const prefersReducedMotion = shallowRef(false);

// ASCII and rendering configuration
const gl = {
  toneMapping: NoToneMapping,
};

const glComposer = {
  multisampling: 4,
};

// Load GLTF model with DRACO support
const { state: gltfModel } = await useGLTF("/models/head.glb", {
  draco: true, // Enable Draco compression
});

// Extract the scene from the GLTF model
const gltfScene = computed(() => gltfModel.value?.scene);

// Mark scene as ready for boot screen
if (import.meta.client) {
  bootState.markSceneReady();
}

// Track the cursor (always) + the reduced-motion preference. The head only acts
// on these at the finale; recording them is just two numbers, event-driven.
if (import.meta.client) {
  prefersReducedMotion.value = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const handleMouseMove = (event: MouseEvent) => {
    // Normalize mouse position to -1..1.
    mousePosition.value = {
      x: (event.clientX / window.innerWidth) * 2 - 1,
      y: (event.clientY / window.innerHeight) * 2 - 1,
    };
  };

  window.addEventListener("mousemove", handleMouseMove);
  onBeforeUnmount(() => {
    window.removeEventListener("mousemove", handleMouseMove);
  });
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

  // Head addressing: hold the resting profile through the journey, then swing to
  // look toward the terminal card as the contact beat centers (addressing → 1),
  // with a gentle cursor parallax on top. Frame-rate-independent smoothing; no
  // extra rAF or layout read — addressing comes from store getters, the cursor
  // from an event. The base aim is part of `addressing` (not the cursor), so it
  // still turns under prefers-reduced-motion (only the parallax is dropped).
  const addressing = sectionsStore.addressing;
  const cursorScale = prefersReducedMotion.value ? 0 : addressing;
  const baseYaw = RESTING_YAW * (1 - addressing) + ADDRESS_YAW * addressing;
  const basePitch = ADDRESS_PITCH * addressing;
  const targetY = baseYaw + mousePosition.value.x * MAX_YAW * cursorScale;
  const targetX = basePitch + mousePosition.value.y * MAX_PITCH * cursorScale;
  const ease = 1 - Math.pow(1 - 0.12, delta * 60);
  headRotationY.value += (targetY - headRotationY.value) * ease;
  headRotationX.value += (targetX - headRotationX.value) * ease;
  // Apply imperatively to the Three group — no reactive prop patching (issue #4).
  headGroupRef.value?.rotation.set(headRotationX.value, headRotationY.value, 0);

  wireFrameRotationY.value = elapsed * 0.5;
  wireframeGroupRef.value?.rotation.set(0, wireFrameRotationY.value, 0);
};

// Calculate bounding box once the model ref is available
watch(
  modelRef,
  async (newModel) => {
    if (newModel) {
      await nextTick();
      boundingBox.value = new Box3().setFromObject(newModel);
      boundingBox.value.getSize(boxSize.value);
      boundingBox.value.getCenter(boxCenter.value);

      // Calculate offset to center the model at origin
      modelOffset.value.copy(boxCenter.value).negate();

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
    <OrbitControls
      v-if="store.cameraControlMode === 'orbit'"
      ref="orbitControlsRef"
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
      <TresGroup ref="headGroupRef">
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

    <!-- Wireframe bounding box centered at origin (now toggleable) -->
    <TresGroup
      v-if="boundingBox && store.showWireframe"
      ref="wireframeGroupRef"
    >
      <TresMesh :position="[0, 0, 0]">
        <TresBoxGeometry :args="[boxSize.x, boxSize.y, boxSize.z]" />
        <TresMeshBasicMaterial color="#00ff00" wireframe />
      </TresMesh>
    </TresGroup>

    <!-- Y-Axis visualization (rotation axis) - now toggleable -->
    <TresGroup v-if="store.showRotationAxis">
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

    <!-- Lighting for better model visibility -->
    <TresDirectionalLight :position="[5, 5, 5]" :intensity="0.5" cast-shadow />
    <TresAmbientLight :intensity="0.1" />

    <HomeLights />

    <!-- ASCII Post-processing Effect -->
    <Suspense>
      <EffectComposerPmndrs v-bind="glComposer">
        <ASCIIPmndrs v-bind="store.effectProps" />
      </EffectComposerPmndrs>
    </Suspense>
  </TresCanvas>
</template>
