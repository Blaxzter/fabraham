<script setup lang="ts">
import { TresCanvas, useRenderLoop } from "@tresjs/core";
import { OrbitControls, useGLTF } from "@tresjs/cientos";
import { EffectComposerPmndrs, ASCIIPmndrs } from "@tresjs/post-processing";
import { NoToneMapping, Box3, Vector3 } from "three";
import type { Object3D, PerspectiveCamera } from "three";

const store = useSceneControlStore();

const modelRef = shallowRef<Object3D | null>(null);
const cameraRef = shallowRef<PerspectiveCamera | null>(null);
const orbitControlsRef = shallowRef<InstanceType<typeof OrbitControls> | null>(
    null
);
const boundingBox = shallowRef<Box3 | null>(null);
const boxSize = shallowRef<Vector3>(new Vector3());
const boxCenter = shallowRef<Vector3>(new Vector3());
const modelOffset = shallowRef<Vector3>(new Vector3());
const headRotatinY = shallowRef(-0.8);
const wireFrameRotationY = shallowRef(0);

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

    //   headRotatinY.value = elapsed * 0.5;
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
            <TresGroup :rotation="[0, headRotatinY, 0]">
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
        <TresDirectionalLight
            :position="[5, 5, 5]"
            :intensity="0.5"
            cast-shadow
        />
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
