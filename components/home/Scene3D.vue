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
const timeline = useTimelineStore();

const modelRef = shallowRef<Object3D | null>(null);
const cameraRef = shallowRef<PerspectiveCamera | null>(null);
const orbitControlsRef = shallowRef<InstanceType<typeof OrbitControls> | null>(
  null
);
const boundingBox = shallowRef<Box3 | null>(null);
const boxSize = shallowRef<Vector3>(new Vector3());
const boxCenter = shallowRef<Vector3>(new Vector3());
const modelOffset = shallowRef<Vector3>(new Vector3());
// Head/wireframe rotation accumulators. These are mutated in onLoop and applied
// imperatively to their Three groups (issue #4) — never bound as reactive props.
const headRotationY = shallowRef(-0.8); // Start at center (0)
const headRotationX = shallowRef(0);
const wireFrameRotationY = shallowRef(0);
const headGroupRef = shallowRef<Group | null>(null);
const wireframeGroupRef = shallowRef<Group | null>(null);

// Mouse tracking for head rotation. Disabled for now — the cursor-following head
// is being reworked into a deliberate end-of-page feature (see GitHub issue).
const mousePosition = shallowRef({ x: 0, y: 0 });
const isMouseTracking = shallowRef(false); // Toggle mouse tracking on/off
const headFollowSpeed = shallowRef(0.02); // Controls how fast head follows cursor (0-1, where 1 is instant)
const headFollowMinSpeed = shallowRef(0.01); // Minimum speed to ensure target is reached
const headRotationOffsetY = shallowRef(-0.75); // Fine-tune left/right viewing direction (in radians)
const headRotationOffsetX = shallowRef(0); // Fine-tune up/down viewing direction (in radians)

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

// Mouse tracking setup
if (import.meta.client) {
  const handleMouseMove = (event: MouseEvent) => {
    if (!isMouseTracking.value) return;

    // Normalize mouse position to -1 to 1 range
    mousePosition.value = {
      x: (event.clientX / window.innerWidth) * 2 - 1,
      y: (event.clientY / window.innerHeight) * 2 - 1, // Not inverted
    };
  };

  window.addEventListener("mousemove", handleMouseMove);

  // Cleanup on unmount
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
  } else if (timeline.enabled && cameraRef.value) {
    // Scroll: drive the camera imperatively from the timeline progress — no
    // reactive camera props, no per-frame layout reads (issue #4).
    const pose = timeline.cameraAt(timeline.progress);
    const cam = cameraRef.value;
    cam.position.set(pose.position.x, pose.position.y, pose.position.z);
    cam.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
  }

  // Update head rotation toward the mouse with frame-rate-independent smoothing.
  if (isMouseTracking.value) {
    // Calculate target rotations based on mouse position
    const maxRotationY = Math.PI * 0.3; // Max 72 degrees left/right
    const targetRotationY =
      mousePosition.value.x * maxRotationY + headRotationOffsetY.value;

    const maxRotationX = Math.PI * 0.18; // Max 54 degrees up/down
    const targetRotationX =
      mousePosition.value.y * maxRotationX + headRotationOffsetX.value;

    // Calculate deltas
    const deltaY = targetRotationY - headRotationY.value;
    const deltaX = targetRotationX - headRotationX.value;

    // Distance-based speed (faster when far, with a floor), scaled by frame time
    // so convergence feels the same at 60Hz and 144Hz.
    const frame = delta * 60;
    const speed = headFollowSpeed.value;
    const minSpeed = headFollowMinSpeed.value;
    const stepY = Math.min(1, Math.max(speed * (1 + Math.abs(deltaY)), minSpeed) * frame);
    const stepX = Math.min(1, Math.max(speed * (1 + Math.abs(deltaX)), minSpeed) * frame);

    headRotationY.value += deltaY * stepY;
    headRotationX.value += deltaX * stepX;
  }
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
