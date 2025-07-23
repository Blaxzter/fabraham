<template>
  <div
    class="light-debugger fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg max-w-md max-h-screen overflow-y-auto z-50"
  >
    <h3 class="text-lg font-bold mb-4">Light Debugger</h3>

    <!-- Global Controls -->
    <div class="mb-4 p-3 border border-gray-600 rounded">
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
        <input type="checkbox" v-model="store.showLightHelpers" class="mr-2" />
        Show Helpers
      </label>
      <button
        @click="addNewLight"
        class="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm mr-2"
      >
        Add New Light
      </button>
      <button
        @click="scrollStore.addLightAnimationExample()"
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
    <div class="mt-4 p-3 border border-gray-600 rounded">
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
</template>

<script lang="ts" setup>
import { ref } from "vue";

const store = useSceneControlStore();
const scrollStore = useScrollAnimationsStore();

const nextLightId = ref(1);

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

<style scoped>
/* Custom scrollbar for the debugger */
.light-debugger::-webkit-scrollbar {
  width: 6px;
}

.light-debugger::-webkit-scrollbar-track {
  background: #374151;
}

.light-debugger::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 3px;
}

.light-debugger::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
