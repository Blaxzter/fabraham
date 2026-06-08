<script setup lang="ts">
// Scene debug toggles (bounding wireframe + rotation axis helper).
const store = useSceneControlStore();
</script>

<template>
  <label class="dvp-row dvp-clickable">
    <span class="dvp-label">Wireframe box</span>
    <input v-model="store.showWireframe" type="checkbox" />
  </label>
  <label class="dvp-row dvp-clickable">
    <span class="dvp-label">Rotation axis</span>
    <input v-model="store.showRotationAxis" type="checkbox" />
  </label>
</template>
