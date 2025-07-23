<template>
  <!-- Dynamic Light System -->
  <TresGroup v-if="store.enableColoredLights">
    <Light
      v-for="light in store.getEnabledLights()"
      :key="light.id"
      :light-config="light"
      :show-helper="store.showLightHelpers"
    />
  </TresGroup>
</template>

<script lang="ts" setup>
import Light from "./Light.vue";

const store = useSceneControlStore();
</script>

<style></style>
