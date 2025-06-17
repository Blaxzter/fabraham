<script setup lang="ts">
import { shallowRef, ref, watch, nextTick, computed } from "vue";
import { TresCanvas, useRenderLoop } from "@tresjs/core";
import { OrbitControls, useGLTF } from "@tresjs/cientos";
import { EffectComposerPmndrs, ASCIIPmndrs } from "@tresjs/post-processing";
import { NoToneMapping, Box3, Vector3 } from "three";
import { BlendFunction } from "postprocessing";
import type { Object3D } from "three";

const modelRef = shallowRef<Object3D | null>(null);
const boundingBox = shallowRef<Box3 | null>(null);
const boxSize = shallowRef<Vector3>(new Vector3());
const boxCenter = shallowRef<Vector3>(new Vector3());
const modelOffset = shallowRef<Vector3>(new Vector3());
const rotationY = shallowRef(0);

// Simple Vue refs for toggleable elements
const showWireframe = ref(false);
const showRotationAxis = ref(false);
const enableASCII = ref(true);

// Colored lights controls
const enableColoredLights = ref(true);
const showLightHelpers = ref(true);
const redLight = ref({ enabled: true, intensity: 1.5, color: "#ff0000" });
const greenLight = ref({ enabled: true, intensity: 1.5, color: "#00ff00" });
const blueLight = ref({ enabled: true, intensity: 1.5, color: "#0088ff" });
const yellowLight = ref({ enabled: true, intensity: 1.2, color: "#ffff00" });
const purpleLight = ref({ enabled: true, intensity: 1.2, color: "#ff00ff" });
const spotlight = ref({
  enabled: true,
  intensity: 2.0,
  color: "#ffffff",
  angle: Math.PI / 6,
});

// ASCII Control Parameters
const cellSize = ref(10);
const useSceneColor = ref(true);
const asciiColor = ref("#ffffff");
const inverted = ref(false);
const characters = ref(" .,:-~+=*≡HELLOWORLD#░▒▓█■▲◼◾");
const font = ref("Arial");
const fontSize = ref(44);
const textureSize = ref(1024);
const cellCount = ref(16);
const opacity = ref(1);
const blendFunction = ref(BlendFunction.NORMAL);

// ASCII and rendering configuration
const gl = {
  toneMapping: NoToneMapping,
};

const glComposer = {
  multisampling: 4,
};

// Computed effect props that update reactively
const effectProps = computed(() => ({
  blendFunction: enableASCII.value ? blendFunction.value : BlendFunction.SKIP,
  opacity: opacity.value,
  cellSize: cellSize.value,
  inverted: inverted.value,
  color: asciiColor.value,
  useSceneColor: useSceneColor.value,
  asciiTexture: {
    characters: characters.value,
    font: font.value,
    fontSize: fontSize.value,
    size: textureSize.value,
    cellCount: cellCount.value,
  },
}));

// Blend function options for dropdown
const blendOptions = [
  { label: "Normal", value: BlendFunction.NORMAL },
  { label: "Add", value: BlendFunction.ADD },
  { label: "Alpha", value: BlendFunction.ALPHA },
  { label: "Average", value: BlendFunction.AVERAGE },
  { label: "Color", value: BlendFunction.COLOR },
  { label: "Darken", value: BlendFunction.DARKEN },
  { label: "Difference", value: BlendFunction.DIFFERENCE },
  { label: "Exclusion", value: BlendFunction.EXCLUSION },
  { label: "Lighten", value: BlendFunction.LIGHTEN },
  { label: "Multiply", value: BlendFunction.MULTIPLY },
  { label: "Overlay", value: BlendFunction.OVERLAY },
  { label: "Screen", value: BlendFunction.SCREEN },
  { label: "Subtract", value: BlendFunction.SUBTRACT },
];

// Load GLTF model with DRACO support
const { scene: gltfScene } = await useGLTF("/models/head.glb", {
  draco: true, // Enable Draco compression
});

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

const { onLoop } = useRenderLoop();
onLoop(({ elapsed }) => {
  // Update rotation value for both model group and bounding box
  rotationY.value = elapsed * 0.5;
});
</script>

<template>
  <div class="relative w-full h-screen">
    <!-- Enhanced ASCII Controls -->
    <div
      class="absolute top-4 right-4 z-10 bg-black/90 p-4 rounded-lg text-white space-y-3 max-h-[90vh] overflow-y-auto w-80"
    >
      <h3 class="text-lg font-semibold mb-2">Controls</h3>

      <!-- Scene Controls -->
      <div class="space-y-2">
        <h4 class="text-sm font-medium text-gray-300">Scene</h4>
        <div class="flex items-center space-x-2">
          <input
            id="wireframe"
            v-model="showWireframe"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="wireframe" class="text-sm">Show Wireframe</label>
        </div>
        <div class="flex items-center space-x-2">
          <input
            id="rotationAxis"
            v-model="showRotationAxis"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="rotationAxis" class="text-sm">Show Rotation Axis</label>
        </div>
      </div>

      <!-- Colored Lights Controls -->
      <div class="space-y-2 pt-2 border-t border-gray-600">
        <h4 class="text-sm font-medium text-gray-300">Colored Lights</h4>

        <div class="flex items-center space-x-2">
          <input
            id="coloredLights"
            v-model="enableColoredLights"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="coloredLights" class="text-sm"
            >Enable Colored Lights</label
          >
        </div>

        <div class="flex items-center space-x-2">
          <input
            id="lightHelpers"
            v-model="showLightHelpers"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="lightHelpers" class="text-sm">Show Light Helpers</label>
        </div>

        <div v-if="enableColoredLights" class="space-y-3">
          <!-- Red Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="redLight"
                v-model="redLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="redLight" class="text-sm">Red Light</label>
            </div>
            <div v-if="redLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400"
                >Intensity: {{ redLight.intensity.toFixed(1) }}</label
              >
              <input
                v-model="redLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="redLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Green Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="greenLight"
                v-model="greenLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="greenLight" class="text-sm">Green Light</label>
            </div>
            <div v-if="greenLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400"
                >Intensity: {{ greenLight.intensity.toFixed(1) }}</label
              >
              <input
                v-model="greenLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="greenLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Blue Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="blueLight"
                v-model="blueLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="blueLight" class="text-sm">Blue Light</label>
            </div>
            <div v-if="blueLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400"
                >Intensity: {{ blueLight.intensity.toFixed(1) }}</label
              >
              <input
                v-model="blueLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="blueLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Yellow Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="yellowLight"
                v-model="yellowLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="yellowLight" class="text-sm">Yellow Light</label>
            </div>
            <div v-if="yellowLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400"
                >Intensity: {{ yellowLight.intensity.toFixed(1) }}</label
              >
              <input
                v-model="yellowLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="yellowLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Purple Light -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="purpleLight"
                v-model="purpleLight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="purpleLight" class="text-sm">Purple Light</label>
            </div>
            <div v-if="purpleLight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400"
                >Intensity: {{ purpleLight.intensity.toFixed(1) }}</label
              >
              <input
                v-model="purpleLight.intensity"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="purpleLight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <!-- Spotlight -->
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <input
                id="spotlight"
                v-model="spotlight.enabled"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="spotlight" class="text-sm">Spotlight</label>
            </div>
            <div v-if="spotlight.enabled" class="ml-6 space-y-1">
              <label class="text-xs text-gray-400"
                >Intensity: {{ spotlight.intensity.toFixed(1) }}</label
              >
              <input
                v-model="spotlight.intensity"
                type="range"
                min="0"
                max="3"
                step="0.1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <label class="text-xs text-gray-400"
                >Angle:
                {{ ((spotlight.angle * 180) / Math.PI).toFixed(0) }}°</label
              >
              <input
                v-model="spotlight.angle"
                type="range"
                min="0.1"
                max="1.57"
                step="0.05"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex items-center space-x-2">
                <label class="text-xs text-gray-400">Color:</label>
                <input
                  v-model="spotlight.color"
                  type="color"
                  class="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ASCII Controls -->
      <div class="space-y-2 pt-2 border-t border-gray-600">
        <h4 class="text-sm font-medium text-gray-300">ASCII Effect</h4>

        <div class="flex items-center space-x-2">
          <input
            id="ascii"
            v-model="enableASCII"
            type="checkbox"
            class="w-4 h-4"
          />
          <label for="ascii" class="text-sm">Enable ASCII</label>
        </div>

        <div v-if="enableASCII" class="space-y-3">
          <!-- Cell Size -->
          <div>
            <label class="text-xs text-gray-400"
              >Cell Size: {{ cellSize }}</label
            >
            <input
              v-model="cellSize"
              type="range"
              min="2"
              max="64"
              step="1"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Opacity -->
          <div>
            <label class="text-xs text-gray-400"
              >Opacity: {{ opacity.toFixed(1) }}</label
            >
            <input
              v-model="opacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Use Scene Color -->
          <div class="flex items-center space-x-2">
            <input
              id="useSceneColor"
              v-model="useSceneColor"
              type="checkbox"
              class="w-4 h-4"
            />
            <label for="useSceneColor" class="text-sm">Use Scene Color</label>
          </div>

          <!-- ASCII Color -->
          <div v-if="!useSceneColor">
            <label class="text-xs text-gray-400">ASCII Color</label>
            <input
              v-model="asciiColor"
              type="color"
              class="w-full h-8 rounded cursor-pointer"
            />
          </div>

          <!-- Inverted -->
          <div class="flex items-center space-x-2">
            <input
              id="inverted"
              v-model="inverted"
              type="checkbox"
              class="w-4 h-4"
            />
            <label for="inverted" class="text-sm">Inverted</label>
          </div>

          <!-- Blend Function -->
          <div>
            <label class="text-xs text-gray-400">Blend Mode</label>
            <select
              v-model="blendFunction"
              class="w-full p-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option
                v-for="option in blendOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <!-- Font Size -->
          <div>
            <label class="text-xs text-gray-400"
              >Font Size: {{ fontSize }}</label
            >
            <input
              v-model="fontSize"
              type="range"
              min="10"
              max="100"
              step="1"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Texture Size -->
          <div>
            <label class="text-xs text-gray-400"
              >Texture Size: {{ textureSize }}</label
            >
            <input
              v-model="textureSize"
              type="range"
              min="256"
              max="2048"
              step="128"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Cell Count -->
          <div>
            <label class="text-xs text-gray-400"
              >Cell Count: {{ cellCount }}</label
            >
            <input
              v-model="cellCount"
              type="range"
              min="4"
              max="64"
              step="1"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Characters -->
          <div>
            <label class="text-xs text-gray-400">Characters</label>
            <textarea
              v-model="characters"
              class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm resize-none"
              rows="2"
            />
          </div>

          <!-- Font -->
          <div>
            <label class="text-xs text-gray-400">Font</label>
            <select
              v-model="font"
              class="w-full p-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="Arial">Arial</option>
              <option value="monospace">Monospace</option>
              <option value="Courier New">Courier New</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="sans-serif">Sans-serif</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <TresCanvas v-bind="gl" clear-color="#111" shadows alpha window-size>
      <OrbitControls />
      <TresPerspectiveCamera
        :position="[2, 2, 2]"
        :fov="45"
        :aspect="1"
        :near="0.1"
        :far="1000"
      />

      <Levioso ref="groupRef">
        <TresGroup :rotation="[0, rotationY, 0]">
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
        v-if="boundingBox && showWireframe"
        :rotation="[0, rotationY, 0]"
      >
        <TresMesh :position="[0, 0, 0]">
          <TresBoxGeometry :args="[boxSize.x, boxSize.y, boxSize.z]" />
          <TresMeshBasicMaterial color="#00ff00" wireframe />
        </TresMesh>
      </TresGroup>

      <!-- Y-Axis visualization (rotation axis) - now toggleable -->
      <TresGroup v-if="showRotationAxis">
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
      <TresMesh :rotation="[-Math.PI / 2, 0, 0]" :position="[0, -2, 0]">
        <TresPlaneGeometry :args="[10, 10, 10, 10]" />
        <TresMeshBasicMaterial color="#444" />
      </TresMesh>

      <!-- Lighting for better model visibility -->
      <TresDirectionalLight
        :position="[5, 5, 5]"
        :intensity="0.5"
        cast-shadow
      />
      <TresAmbientLight :intensity="0.1" />

      <!-- Test sphere to show colored lighting effects -->
      <TresMesh :position="[2.5, 0, 0]">
        <TresSphereGeometry :args="[0.3, 32, 32]" />
        <TresMeshStandardMaterial
          color="#ffffff"
          roughness="0.5"
          metalness="0.1"
        />
      </TresMesh>

      <!-- Colored Point Lights -->
      <template v-if="enableColoredLights">
        <!-- Red Light - positioned to the right -->
        <TresPointLight
          v-if="redLight.enabled"
          :position="[3, 2, 1]"
          :color="redLight.color"
          :intensity="redLight.intensity"
          :distance="10"
          :decay="1"
        />
        <!-- Red Light Helper -->
        <TresMesh
          v-if="redLight.enabled && showLightHelpers"
          :position="[3, 2, 1]"
        >
          <TresSphereGeometry :args="[0.1, 8, 8]" />
          <TresMeshBasicMaterial :color="redLight.color" />
        </TresMesh>

        <!-- Green Light - positioned to the left -->
        <TresPointLight
          v-if="greenLight.enabled"
          :position="[-3, 2, 1]"
          :color="greenLight.color"
          :intensity="greenLight.intensity"
          :distance="10"
          :decay="1"
        />
        <!-- Green Light Helper -->
        <TresMesh
          v-if="greenLight.enabled && showLightHelpers"
          :position="[-3, 2, 1]"
        >
          <TresSphereGeometry :args="[0.1, 8, 8]" />
          <TresMeshBasicMaterial :color="greenLight.color" />
        </TresMesh>

        <!-- Blue Light - positioned behind -->
        <TresPointLight
          v-if="blueLight.enabled"
          :position="[0, 2, -3]"
          :color="blueLight.color"
          :intensity="blueLight.intensity"
          :distance="10"
          :decay="1"
        />
        <!-- Blue Light Helper -->
        <TresMesh
          v-if="blueLight.enabled && showLightHelpers"
          :position="[0, 2, -3]"
        >
          <TresSphereGeometry :args="[0.1, 8, 8]" />
          <TresMeshBasicMaterial :color="blueLight.color" />
        </TresMesh>

        <!-- Yellow Light - positioned in front -->
        <TresPointLight
          v-if="yellowLight.enabled"
          :position="[0, 1, 3]"
          :color="yellowLight.color"
          :intensity="yellowLight.intensity"
          :distance="8"
          :decay="1"
        />
        <!-- Yellow Light Helper -->
        <TresMesh
          v-if="yellowLight.enabled && showLightHelpers"
          :position="[0, 1, 3]"
        >
          <TresSphereGeometry :args="[0.1, 8, 8]" />
          <TresMeshBasicMaterial :color="yellowLight.color" />
        </TresMesh>

        <!-- Purple Light - positioned above -->
        <TresPointLight
          v-if="purpleLight.enabled"
          :position="[0, 4, 0]"
          :color="purpleLight.color"
          :intensity="purpleLight.intensity"
          :distance="10"
          :decay="1"
        />
        <!-- Purple Light Helper -->
        <TresMesh
          v-if="purpleLight.enabled && showLightHelpers"
          :position="[0, 4, 0]"
        >
          <TresSphereGeometry :args="[0.1, 8, 8]" />
          <TresMeshBasicMaterial :color="purpleLight.color" />
        </TresMesh>

        <!-- Dramatic Spotlight from above-right -->
        <TresSpotLight
          v-if="spotlight.enabled"
          :position="[4, 6, 2]"
          :color="spotlight.color"
          :intensity="spotlight.intensity"
          :angle="spotlight.angle"
          :penumbra="0.3"
          :distance="15"
          :decay="1"
        />
        <!-- Spotlight Helper -->
        <TresMesh
          v-if="spotlight.enabled && showLightHelpers"
          :position="[4, 6, 2]"
        >
          <TresSphereGeometry :args="[0.15, 8, 8]" />
          <TresMeshBasicMaterial :color="spotlight.color" />
        </TresMesh>
      </template>

      <!-- ASCII Post-processing Effect -->
      <Suspense>
        <EffectComposerPmndrs v-bind="glComposer">
          <ASCIIPmndrs v-bind="effectProps" />
        </EffectComposerPmndrs>
      </Suspense>
    </TresCanvas>
  </div>
</template>
