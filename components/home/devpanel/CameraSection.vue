<script setup lang="ts">
// The camera / positioning workflow: switch between scroll-driven and free
// orbit, read the live pose, and copy it as a registry-ready snippet to paste
// into a section's `camera` in components/home/sections/registry.ts.
import { ref } from "vue";

const store = useSceneControlStore();
const timeline = useSectionsStore();

// Scroll mode → the timeline owns the camera; orbit mode → OrbitControls do.
// Toggling enable/disable mirrors the old ControlsPanel behaviour exactly.
const onModeChange = () => {
  if (store.cameraControlMode === "scroll") timeline.enable();
  else timeline.disable();
};

const fmt = (n: number) => n.toFixed(2);

const copied = ref(false);
const copyPose = async () => {
  const p = store.cameraPosition;
  const r = store.cameraRotation;
  const snippet = `camera: { position: v3(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(
    p.z
  )}), rotation: v3(${fmt(r.x)}, ${fmt(r.y)}, ${fmt(r.z)}) },`;
  try {
    await navigator.clipboard.writeText(snippet);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1300);
  } catch {
    /* clipboard blocked — ignore */
  }
};
</script>

<template>
  <div class="dvp-field">
    <label class="dvp-row">
      <span class="dvp-label">Mode</span>
      <select
        v-model="store.cameraControlMode"
        class="dvp-select"
        @change="onModeChange"
      >
        <option value="scroll">Scroll</option>
        <option value="orbit">Orbit (free)</option>
      </select>
    </label>
  </div>

  <div class="dvp-field dvp-readout">
    <div class="dvp-row">
      <span class="dvp-label">pos</span>
      <span class="dvp-val">
        {{ fmt(store.cameraPosition.x) }}, {{ fmt(store.cameraPosition.y) }},
        {{ fmt(store.cameraPosition.z) }}
      </span>
    </div>
    <div class="dvp-row">
      <span class="dvp-label">rot</span>
      <span class="dvp-val">
        {{ fmt(store.cameraRotation.x) }}, {{ fmt(store.cameraRotation.y) }},
        {{ fmt(store.cameraRotation.z) }}
      </span>
    </div>
  </div>

  <button class="dvp-btn dvp-btn-block" @click="copyPose">
    {{ copied ? "copied pose" : "copy camera pose" }}
  </button>
  <p class="dvp-hint">
    Orbit to a pose, then paste into a section's <code>camera</code> in
    <code>registry.ts</code>.
  </p>
</template>
