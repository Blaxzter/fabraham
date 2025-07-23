<script setup lang="ts">
import {
  Settings2Icon,
  XIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-vue-next";
import { ref } from "vue";

const store = useSceneControlStore();
const scrollAnimations = useScrollAnimationsStore();

// Tab state
const activeTab = ref<"scene" | "lights">("scene");

// Light debugger state
const nextLightId = ref(1);

// Toggle section collapse
const toggleSection = (section: keyof typeof store.collapsedSections) => {
  store.collapsedSections[section] = !store.collapsedSections[section];
};

// Light management functions
const toggleLight = (lightId: string) => {
  store.toggleLight(lightId);
};

const removeLight = (lightId: string) => {
  store.removeLight(lightId);
};

const updateLightProperty = (lightId: string, property: string, value: any) => {
  store.updateLightProperty(lightId, property as any, value);
};

const updatePosition = (
  lightId: string,
  axis: "x" | "y" | "z",
  value: number
) => {
  const light = store.getLight(lightId);
  if (light) {
    light.position[axis] = value;
  }
};

// Event handlers with proper typing
const handleTypeChange = (lightId: string, event: Event) => {
  const target = event.target as HTMLSelectElement;
  updateLightProperty(lightId, "type", target.value);
};

const handlePositionInput = (
  lightId: string,
  axis: "x" | "y" | "z",
  event: Event
) => {
  const target = event.target as HTMLInputElement;
  updatePosition(lightId, axis, parseFloat(target.value));
};

const handleColorInput = (lightId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  updateLightProperty(lightId, "color", target.value);
};

const handleIntensityInput = (lightId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  updateLightProperty(lightId, "intensity", parseFloat(target.value));
};

const handleAngleInput = (lightId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  updateLightProperty(lightId, "angle", parseFloat(target.value));
};

const handlePenumbraInput = (lightId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  updateLightProperty(lightId, "penumbra", parseFloat(target.value));
};

const handleAnimatableChange = (lightId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  updateLightProperty(lightId, "animatable", target.checked);
};

const addNewLight = () => {
  const newId = `custom_${nextLightId.value++}`;
  store.addLight({
    id: newId,
    name: `Custom Light ${nextLightId.value - 1}`,
    type: "point",
    enabled: true,
    position: { x: 0, y: 2, z: 0 },
    color: "#ffffff",
    intensity: 1.0,
    distance: 10,
    decay: 1,
    animatable: false,
  });
};

const exportLightConfig = () => {
  const config = JSON.stringify(store.lights, null, 2);
  navigator.clipboard.writeText(config);
  console.log("Light configuration copied to clipboard:", config);
};

const copyCurrentPosition = () => {
  const positions = Object.entries(store.lights)
    .map(
      ([id, light]) =>
        `${id}: { x: ${light.position.x.toFixed(
          2
        )}, y: ${light.position.y.toFixed(2)}, z: ${light.position.z.toFixed(
          2
        )} }`
    )
    .join("\n");

  navigator.clipboard.writeText(positions);
  console.log("Current positions copied to clipboard:\n", positions);
};
</script>

<template>
  <!-- Toggle Button -->
  <button
    class="fixed top-4 right-4 z-50 bg-black/90 hover:bg-black text-white p-2 rounded-lg transition-colors"
    :title="store.showControlsPanel ? 'Hide Controls' : 'Show Controls'"
    @click="store.showControlsPanel = !store.showControlsPanel"
  >
    <XIcon v-if="store.showControlsPanel" class="w-5 h-5" />
    <Settings2Icon v-else class="w-5 h-5" />
  </button>

  <!-- Controls Panel -->
  <div
    v-if="store.showControlsPanel"
    class="fixed top-16 right-4 z-40 bg-black/90 p-4 rounded-lg text-white space-y-3 max-h-[85vh] overflow-y-auto w-80"
    @wheel.stop
  >
    <h3 class="text-lg font-semibold mb-2">
      Controls | {{ scrollAnimations?.isEnabled }}
    </h3>

    <!-- Tab Navigation -->
    <div class="flex bg-gray-800 rounded-lg p-1 mb-4">
      <button
        @click="activeTab = 'scene'"
        :class="[
          'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
          activeTab === 'scene'
            ? 'bg-gray-600 text-white'
            : 'text-gray-300 hover:text-white hover:bg-gray-700',
        ]"
      >
        Scene
      </button>
      <button
        @click="activeTab = 'lights'"
        :class="[
          'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
          activeTab === 'lights'
            ? 'bg-gray-600 text-white'
            : 'text-gray-300 hover:text-white hover:bg-gray-700',
        ]"
      >
        Lights
      </button>
    </div>

    <!-- Scene Tab Content -->
    <div v-if="activeTab === 'scene'" class="space-y-3">
      <!-- Camera Information and Controls -->
      <div class="space-y-2">
        <button
          @click="toggleSection('camera')"
          class="flex items-center justify-between w-full text-left hover:bg-gray-700/50 p-2 rounded transition-colors"
        >
          <h4 class="text-sm font-medium text-gray-300">Camera</h4>
          <ChevronDownIcon
            v-if="!store.collapsedSections.camera"
            class="w-4 h-4 text-gray-400"
          />
          <ChevronRightIcon v-else class="w-4 h-4 text-gray-400" />
        </button>

        <div v-if="!store.collapsedSections.camera" class="space-y-2 pl-2">
          <!-- Camera Control Mode -->
          <div class="space-y-1">
            <label class="text-xs text-gray-400">Control Mode</label>
            <select
              v-model="store.cameraControlMode"
              @change="
                () => {
                  if (store.cameraControlMode === 'scroll') {
                    scrollAnimations.enable();
                  } else {
                    scrollAnimations.disable();
                  }
                }
              "
              class="w-full p-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="scroll">Scroll Controlled</option>
              <option value="orbit">Orbit Controls</option>
            </select>
          </div>

          <!-- Scroll Progress (when in scroll mode) -->
          <div v-if="store.cameraControlMode === 'scroll'" class="space-y-1">
            <div class="text-xs text-gray-400 space-y-1">
              <div>
                Position: ({{ store.cameraPosition.x.toFixed(2) }},
                {{ store.cameraPosition.y.toFixed(2) }},
                {{ store.cameraPosition.z.toFixed(2) }})
              </div>
              <div>
                Rotation: ({{ store.cameraRotation.x.toFixed(2) }},
                {{ store.cameraRotation.y.toFixed(2) }},
                {{ store.cameraRotation.z.toFixed(2) }})
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scene Controls -->
      <div class="space-y-2">
        <button
          @click="toggleSection('scene')"
          class="flex items-center justify-between w-full text-left hover:bg-gray-700/50 p-2 rounded transition-colors"
        >
          <h4 class="text-sm font-medium text-gray-300">Scene</h4>
          <ChevronDownIcon
            v-if="!store.collapsedSections.scene"
            class="w-4 h-4 text-gray-400"
          />
          <ChevronRightIcon v-else class="w-4 h-4 text-gray-400" />
        </button>

        <div
          v-if="!store.collapsedSections.scene"
          class="space-y-2 pl-2 pt-2 border-t border-gray-600"
        >
          <div class="flex items-center space-x-2">
            <input
              id="wireframe"
              v-model="store.showWireframe"
              type="checkbox"
              class="w-4 h-4"
            />
            <label for="wireframe" class="text-sm">Show Wireframe</label>
          </div>
          <div class="flex items-center space-x-2">
            <input
              id="rotationAxis"
              v-model="store.showRotationAxis"
              type="checkbox"
              class="w-4 h-4"
            />
            <label for="rotationAxis" class="text-sm">Show Rotation Axis</label>
          </div>
        </div>
      </div>

      <!-- ASCII Controls -->
      <div class="space-y-2">
        <button
          @click="toggleSection('ascii')"
          class="flex items-center justify-between w-full text-left hover:bg-gray-700/50 p-2 rounded transition-colors"
        >
          <h4 class="text-sm font-medium text-gray-300">ASCII Effect</h4>
          <ChevronDownIcon
            v-if="!store.collapsedSections.ascii"
            class="w-4 h-4 text-gray-400"
          />
          <ChevronRightIcon v-else class="w-4 h-4 text-gray-400" />
        </button>

        <div
          v-if="!store.collapsedSections.ascii"
          class="space-y-2 pl-2 pt-2 border-t border-gray-600"
        >
          <div class="flex items-center space-x-2">
            <input
              id="ascii"
              v-model="store.enableASCII"
              type="checkbox"
              class="w-4 h-4"
            />
            <label for="ascii" class="text-sm">Enable ASCII</label>
          </div>

          <div v-if="store.enableASCII" class="space-y-3">
            <!-- Cell Size -->
            <div>
              <label class="text-xs text-gray-400">
                Cell Size: {{ store.cellSize }}
              </label>
              <input
                v-model="store.cellSize"
                type="range"
                min="2"
                max="64"
                step="1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <!-- Opacity -->
            <div>
              <label class="text-xs text-gray-400">
                Opacity: {{ store.opacity.toFixed(1) }}
              </label>
              <input
                v-model="store.opacity"
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
                v-model="store.useSceneColor"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="useSceneColor" class="text-sm">Use Scene Color</label>
            </div>

            <!-- ASCII Color -->
            <div v-if="!store.useSceneColor">
              <label class="text-xs text-gray-400">ASCII Color</label>
              <input
                v-model="store.asciiColor"
                type="color"
                class="w-full h-8 rounded cursor-pointer"
              />
            </div>

            <!-- Inverted -->
            <div class="flex items-center space-x-2">
              <input
                id="inverted"
                v-model="store.inverted"
                type="checkbox"
                class="w-4 h-4"
              />
              <label for="inverted" class="text-sm">Inverted</label>
            </div>

            <!-- Blend Function -->
            <div>
              <label class="text-xs text-gray-400">Blend Mode</label>
              <select
                v-model="store.blendFunction"
                class="w-full p-1 bg-gray-700 border border-gray-600 rounded text-sm"
              >
                <option
                  v-for="option in store.blendOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <!-- Font Size -->
            <div>
              <label class="text-xs text-gray-400">
                Font Size: {{ store.fontSize }}
              </label>
              <input
                v-model="store.fontSize"
                type="range"
                min="10"
                max="100"
                step="1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <!-- Texture Size -->
            <div>
              <label class="text-xs text-gray-400">
                Texture Size: {{ store.textureSize }}
              </label>
              <input
                v-model="store.textureSize"
                type="range"
                min="256"
                max="2048"
                step="128"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <!-- Cell Count -->
            <div>
              <label class="text-xs text-gray-400">
                Cell Count: {{ store.cellCount }}
              </label>
              <input
                v-model="store.cellCount"
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
                v-model="store.characters"
                class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm resize-none"
                rows="2"
              />
            </div>

            <!-- Font -->
            <div>
              <label class="text-xs text-gray-400">Font</label>
              <select
                v-model="store.font"
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
    </div>

    <!-- Lights Tab Content -->
    <div v-if="activeTab === 'lights'" class="space-y-3">
      <!-- Global Light Controls -->
      <div class="p-3 border border-gray-600 rounded">
        <h4 class="font-semibold mb-2">Global Controls</h4>
        <label class="flex items-center mb-2">
          <input
            type="checkbox"
            v-model="store.enableColoredLights"
            class="mr-2"
          />
          Enable Lights
        </label>
        <label class="flex items-center mb-2">
          <input
            type="checkbox"
            v-model="store.showLightHelpers"
            class="mr-2"
          />
          Show Helpers
        </label>
        <button
          @click="addNewLight"
          class="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm mr-2"
        >
          Add New Light
        </button>
        <button
          @click="scrollAnimations.addLightAnimationExample()"
          class="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
        >
          Add Animation Example
        </button>
      </div>

      <!-- Individual Light Controls -->
      <div class="space-y-4">
        <div
          v-for="light in Object.values(store.lights)"
          :key="light.id"
          class="p-3 border border-gray-600 rounded"
        >
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-semibold">{{ light.name }}</h4>
            <div class="flex items-center space-x-2">
              <label class="text-xs">
                <input
                  type="checkbox"
                  :checked="light.enabled"
                  @change="toggleLight(light.id)"
                  class="mr-1"
                />
                Enabled
              </label>
              <button
                @click="removeLight(light.id)"
                class="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
              >
                Remove
              </button>
            </div>
          </div>

          <!-- Light Type -->
          <div class="mb-2">
            <label class="block text-xs mb-1">Type</label>
            <select
              :value="light.type"
              @change="handleTypeChange(light.id, $event)"
              class="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs"
            >
              <option value="point">Point Light</option>
              <option value="spot">Spotlight</option>
              <option value="directional">Directional Light</option>
            </select>
          </div>

          <!-- Position Controls -->
          <div class="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label class="block text-xs mb-1">X</label>
              <input
                type="number"
                step="0.1"
                :value="light.position.x"
                @input="handlePositionInput(light.id, 'x', $event)"
                class="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs"
              />
            </div>
            <div>
              <label class="block text-xs mb-1">Y</label>
              <input
                type="number"
                step="0.1"
                :value="light.position.y"
                @input="handlePositionInput(light.id, 'y', $event)"
                class="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs"
              />
            </div>
            <div>
              <label class="block text-xs mb-1">Z</label>
              <input
                type="number"
                step="0.1"
                :value="light.position.z"
                @input="handlePositionInput(light.id, 'z', $event)"
                class="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs"
              />
            </div>
          </div>

          <!-- Color and Intensity -->
          <div class="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label class="block text-xs mb-1">Color</label>
              <input
                type="color"
                :value="light.color"
                @input="handleColorInput(light.id, $event)"
                class="w-full bg-gray-700 rounded"
              />
            </div>
            <div>
              <label class="block text-xs mb-1">Intensity</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                :value="light.intensity"
                @input="handleIntensityInput(light.id, $event)"
                class="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs"
              />
            </div>
          </div>

          <!-- Spotlight specific controls -->
          <div v-if="light.type === 'spot'" class="space-y-2">
            <div>
              <label class="block text-xs mb-1">Angle (radians)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="3.14"
                :value="light.angle || Math.PI / 6"
                @input="handleAngleInput(light.id, $event)"
                class="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs"
              />
            </div>
            <div>
              <label class="block text-xs mb-1">Penumbra</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                :value="light.penumbra || 0.3"
                @input="handlePenumbraInput(light.id, $event)"
                class="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs"
              />
            </div>
          </div>

          <!-- Animation Controls -->
          <div class="mt-2">
            <label class="flex items-center text-xs">
              <input
                type="checkbox"
                :checked="light.animatable"
                @change="handleAnimatableChange(light.id, $event)"
                class="mr-1"
              />
              Animatable
            </label>
          </div>

          <!-- Current values display -->
          <div class="mt-2 text-xs text-gray-400">
            <div>
              Pos: ({{ light.position.x.toFixed(2) }},
              {{ light.position.y.toFixed(2) }},
              {{ light.position.z.toFixed(2) }})
            </div>
            <div>Intensity: {{ light.intensity.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <!-- Export Current Config -->
      <div class="p-3 border border-gray-600 rounded">
        <h4 class="font-semibold mb-2">Export</h4>
        <button
          @click="exportLightConfig"
          class="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm mr-2"
        >
          Export Config
        </button>
        <button
          @click="copyCurrentPosition"
          class="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-sm"
        >
          Copy Positions
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for the controls panel */
.fixed::-webkit-scrollbar {
  width: 6px;
}

.fixed::-webkit-scrollbar-track {
  background: #374151;
}

.fixed::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 3px;
}

.fixed::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
