<script setup lang="ts">
import { TresCanvas, useRenderLoop } from "@tresjs/core";
import { OrbitControls, useGLTF } from "@tresjs/cientos";
import { EffectComposerPmndrs, ASCIIPmndrs } from "@tresjs/post-processing";
import { NoToneMapping, Box3, Vector3 } from "three";
import type { Object3D, PerspectiveCamera } from "three";

const store = useSceneControlStore();
const bootState = useBootStateStore();

const modelRef = shallowRef<Object3D | null>(null);
const cameraRef = shallowRef<PerspectiveCamera | null>(null);
const orbitControlsRef = shallowRef<InstanceType<typeof OrbitControls> | null>(
  null
);
const boundingBox = shallowRef<Box3 | null>(null);
const boxSize = shallowRef<Vector3>(new Vector3());
const boxCenter = shallowRef<Vector3>(new Vector3());
const modelOffset = shallowRef<Vector3>(new Vector3());
const headRotatinY = shallowRef(-0.8); // Start at center (0)
const headRotationX = shallowRef(0);
const wireFrameRotationY = shallowRef(0);

// Mouse tracking for head rotation
const mousePosition = shallowRef({ x: 0, y: 0 });
const isMouseTracking = shallowRef(true); // Toggle mouse tracking on/off
const headFollowSpeed = shallowRef(0.01); // Controls how fast head follows cursor (0-1, where 1 is instant)
const headFollowMinSpeed = shallowRef(0.005); // Minimum speed to ensure target is reached
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
const { scene: gltfScene } = await useGLTF("/models/head.glb", {
  draco: true, // Enable Draco compression
});

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
const { onLoop } = useRenderLoop();

onLoop(({ elapsed }) => {
  // Only update store from camera if in orbit mode (to avoid conflicts with scroll mode)
  if (store.cameraControlMode === "orbit") {
    const position = cameraRef.value?.position;
    const rotation = cameraRef.value?.rotation;
    if (position && rotation) {
      // Update camera position
      store.cameraPosition.x = Math.round(position.x * 100) / 100;
      store.cameraPosition.y = Math.round(position.y * 100) / 100;
      store.cameraPosition.z = Math.round(position.z * 100) / 100;

      // Update camera rotation
      store.cameraRotation.x = Math.round(rotation.x * 100) / 100;
      store.cameraRotation.y = Math.round(rotation.y * 100) / 100;
      store.cameraRotation.z = Math.round(rotation.z * 100) / 100;
    }
  }

  // Update head rotation based on mouse position with smooth lerping
  if (isMouseTracking.value) {
    // Calculate target rotations based on mouse position
    const maxRotationY = Math.PI * 0.3; // Max 72 degrees left/right
    const targetRotationY =
      mousePosition.value.x * maxRotationY + headRotationOffsetY.value;

    const maxRotationX = Math.PI * 0.18; // Max 54 degrees up/down
    const targetRotationX =
      mousePosition.value.y * maxRotationX + headRotationOffsetX.value;

    // Calculate deltas
    const deltaY = targetRotationY - headRotatinY.value;
    const deltaX = targetRotationX - headRotationX.value;

    // Distance-based speed: faster when far away, slower when close, but with minimum
    const speed = headFollowSpeed.value;
    const minSpeed = headFollowMinSpeed.value;
    const dynamicSpeedY = Math.max(speed * (1 + Math.abs(deltaY)), minSpeed);
    const dynamicSpeedX = Math.max(speed * (1 + Math.abs(deltaX)), minSpeed);

    headRotatinY.value += deltaY * dynamicSpeedY;
    headRotationX.value += deltaX * dynamicSpeedX;
  }

  wireFrameRotationY.value = elapsed * 0.5;
});

// Debug output for camera mode
console.log("Camera control mode:", store.cameraControlMode);

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
</script>

<template>
  <TresCanvas v-bind="gl" clear-color="#111" shadows alpha window-size>
    <OrbitControls
      v-if="store.cameraControlMode === 'orbit'"
      ref="orbitControlsRef"
    />
    <TresPerspectiveCamera
      ref="cameraRef"
      :position="[
        store.cameraPosition.x,
        store.cameraPosition.y,
        store.cameraPosition.z,
      ]"
      :rotation="[
        store.cameraRotation.x,
        store.cameraRotation.y,
        store.cameraRotation.z,
      ]"
      :fov="45"
      :aspect="1"
      :near="0.1"
      :far="1000"
    />

    <Levioso
      ref="groupRef"
      :speed="store.floatSpeed"
      :rotation-factor="1"
      :float-factor="store.floatFactor"
    >
      <TresGroup :rotation="[headRotationX, headRotatinY, 0]">
        <!-- Load the head model with offset to center it -->
        <primitive
          ref="modelRef"
          :object="gltfScene"
          :position="modelOffset.toArray()"
          :scale="[2, 2, 2]"
        />
      </TresGroup>
    </Levioso>
    <!-- Group that rotates around origin, containing the offset model -->

    <!-- Wireframe bounding box centered at origin (now toggleable) -->
    <TresGroup
      v-if="boundingBox && store.showWireframe"
      :rotation="[0, wireFrameRotationY, 0]"
    >
      <TresMesh :position="[0, 0, 0]">
        <TresBoxGeometry :args="[boxSize.x, boxSize.y, boxSize.z]" />
        <TresMeshBasicMaterial
          color="#00ff00"
          wireframe
          :wireframe-linecap="'butt'"
        />
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
