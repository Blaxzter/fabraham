<script setup lang="ts">
// The colored-light debugger (CRUD). All state + actions live in
// useSceneControlStore; this is the editing surface, ported from the old
// ControlsPanel lights tab into the dev-panel style.
import { ref } from "vue";

const store = useSceneControlStore();
const nextLightId = ref(1);

const updateLightProperty = (lightId: string, property: string, value: unknown) => {
  store.updateLightProperty(lightId, property as never, value);
};

const handleTypeChange = (lightId: string, event: Event) =>
  updateLightProperty(lightId, "type", (event.target as HTMLSelectElement).value);

const handlePositionInput = (
  lightId: string,
  axis: "x" | "y" | "z",
  event: Event
) => {
  const light = store.getLight(lightId);
  if (light) light.position[axis] = parseFloat((event.target as HTMLInputElement).value);
};

const handleColorInput = (lightId: string, event: Event) =>
  updateLightProperty(lightId, "color", (event.target as HTMLInputElement).value);

const handleNumberInput = (lightId: string, property: string, event: Event) =>
  updateLightProperty(
    lightId,
    property,
    parseFloat((event.target as HTMLInputElement).value)
  );

const handleAnimatableChange = (lightId: string, event: Event) =>
  updateLightProperty(
    lightId,
    "animatable",
    (event.target as HTMLInputElement).checked
  );

const addNewLight = () => {
  const id = `custom_${nextLightId.value++}`;
  store.addLight({
    id,
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

const copiedConfig = ref(false);
const exportLightConfig = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(store.lights, null, 2));
    copiedConfig.value = true;
    setTimeout(() => (copiedConfig.value = false), 1300);
  } catch {
    /* clipboard blocked — ignore */
  }
};

const AXES = ["x", "y", "z"] as const;
</script>

<template>
  <label class="dvp-row dvp-clickable">
    <span class="dvp-label">Enable lights</span>
    <input v-model="store.enableColoredLights" type="checkbox" />
  </label>
  <label class="dvp-row dvp-clickable">
    <span class="dvp-label">Show helpers</span>
    <input v-model="store.showLightHelpers" type="checkbox" />
  </label>

  <div class="dvp-light-actions">
    <button class="dvp-btn" @click="addNewLight">+ add light</button>
    <button class="dvp-btn" @click="exportLightConfig">
      {{ copiedConfig ? "copied" : "export json" }}
    </button>
  </div>

  <div v-for="light in Object.values(store.lights)" :key="light.id" class="dvp-light">
    <div class="dvp-light-head">
      <span class="dvp-light-name">{{ light.name }}</span>
      <span class="dvp-light-controls">
        <label class="dvp-inline">
          <input
            type="checkbox"
            :checked="light.enabled"
            @change="store.toggleLight(light.id)"
          />
          on
        </label>
        <button class="dvp-btn dvp-btn-danger" @click="store.removeLight(light.id)">
          ✕
        </button>
      </span>
    </div>

    <label class="dvp-row">
      <span class="dvp-label">Type</span>
      <select
        :value="light.type"
        class="dvp-select"
        @change="handleTypeChange(light.id, $event)"
      >
        <option value="point">Point</option>
        <option value="spot">Spot</option>
        <option value="directional">Directional</option>
      </select>
    </label>

    <div v-for="axis in AXES" :key="axis" class="dvp-axis">
      <span class="dvp-axis-k">{{ axis }}</span>
      <input
        type="range"
        min="-6"
        max="6"
        step="0.1"
        :value="light.position[axis]"
        @input="handlePositionInput(light.id, axis, $event)"
      />
      <span class="dvp-axis-v">{{ light.position[axis].toFixed(2) }}</span>
    </div>

    <label class="dvp-row">
      <span class="dvp-label">Color</span>
      <input
        type="color"
        :value="light.color"
        @input="handleColorInput(light.id, $event)"
      />
    </label>
    <div class="dvp-field">
      <label class="dvp-row">
        <span class="dvp-label">Intensity</span>
        <span class="dvp-val">{{ light.intensity.toFixed(2) }}</span>
      </label>
      <input
        type="range"
        min="0"
        max="5"
        step="0.1"
        :value="light.intensity"
        @input="handleNumberInput(light.id, 'intensity', $event)"
      />
    </div>

    <template v-if="light.type === 'spot'">
      <div class="dvp-field">
        <label class="dvp-row">
          <span class="dvp-label">Angle</span>
          <span class="dvp-val">{{ (light.angle ?? Math.PI / 6).toFixed(2) }}</span>
        </label>
        <input
          type="range"
          min="0"
          max="3.14"
          step="0.05"
          :value="light.angle ?? Math.PI / 6"
          @input="handleNumberInput(light.id, 'angle', $event)"
        />
      </div>
      <div class="dvp-field">
        <label class="dvp-row">
          <span class="dvp-label">Penumbra</span>
          <span class="dvp-val">{{ (light.penumbra ?? 0.3).toFixed(2) }}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="light.penumbra ?? 0.3"
          @input="handleNumberInput(light.id, 'penumbra', $event)"
        />
      </div>
    </template>

    <label class="dvp-row dvp-clickable">
      <span class="dvp-label">Animatable</span>
      <input
        type="checkbox"
        :checked="light.animatable"
        @change="handleAnimatableChange(light.id, $event)"
      />
    </label>
  </div>
</template>
