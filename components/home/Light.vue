<template>
  <TresGroup v-if="lightConfig.enabled">
    <!-- Point Light -->
    <TresPointLight
      v-if="lightConfig.type === 'point'"
      :position="lightPosition"
      :color="lightConfig.color"
      :intensity="lightConfig.intensity"
      :distance="lightConfig.distance || 10"
      :decay="lightConfig.decay || 1"
    />

    <!-- Spotlight -->
    <TresSpotLight
      v-else-if="lightConfig.type === 'spot'"
      :position="lightPosition"
      :color="lightConfig.color"
      :intensity="lightConfig.intensity"
      :angle="lightConfig.angle || Math.PI / 6"
      :penumbra="lightConfig.penumbra || 0.3"
      :distance="lightConfig.distance || 15"
      :decay="lightConfig.decay || 1"
    />

    <!-- Directional Light -->
    <TresDirectionalLight
      v-else-if="lightConfig.type === 'directional'"
      :position="lightPosition"
      :color="lightConfig.color"
      :intensity="lightConfig.intensity"
    />

    <!-- Light Helper (Visual indicator) -->
    <TresMesh v-if="showHelper" :position="lightPosition">
      <TresSphereGeometry
        :args="[lightConfig.type === 'spot' ? 0.15 : 0.1, 8, 8]"
      />
      <TresMeshBasicMaterial :color="lightConfig.color" />
    </TresMesh>

    <!-- Target Helper for Spotlights -->
    <TresMesh
      v-if="showHelper && lightConfig.type === 'spot' && lightConfig.target"
      :position="targetPosition"
    >
      <TresSphereGeometry :args="[0.05, 6, 6]" />
      <TresMeshBasicMaterial
        :color="lightConfig.color"
        :opacity="0.5"
        :transparent="true"
      />
    </TresMesh>
  </TresGroup>
</template>

<script lang="ts" setup>
import { computed } from "vue";

interface LightConfig {
  id: string;
  name: string;
  type: "point" | "spot" | "directional";
  enabled: boolean;
  position: { x: number; y: number; z: number };
  color: string;
  intensity: number;
  distance?: number;
  decay?: number;
  // Spotlight specific
  angle?: number;
  penumbra?: number;
  target?: { x: number; y: number; z: number };
  // Directional light specific
  direction?: { x: number; y: number; z: number };
  // Animation properties
  animatable?: boolean;
  animationKeyframes?: Array<{
    progress: number;
    position?: { x: number; y: number; z: number };
    intensity?: number;
    color?: string;
  }>;
}

const props = defineProps<{
  lightConfig: LightConfig;
  showHelper?: boolean;
}>();

// Convert position object to array for Three.js
const lightPosition = computed(
  () =>
    [
      props.lightConfig.position.x,
      props.lightConfig.position.y,
      props.lightConfig.position.z,
    ] as [number, number, number]
);

// Calculate target position for spotlights
const targetPosition = computed(() => {
  if (props.lightConfig.target) {
    return [
      props.lightConfig.target.x,
      props.lightConfig.target.y,
      props.lightConfig.target.z,
    ] as [number, number, number];
  }
  // Default target at origin for spotlights
  return [0, 0, 0] as [number, number, number];
});
</script>

<style scoped>
/* Add any specific styles if needed */
</style>
