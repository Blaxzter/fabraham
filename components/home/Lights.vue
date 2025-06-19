<template>
  <!-- Colored Point Lights -->
  <TresGroup v-if="store.enableColoredLights">
    <!-- Red Light - positioned to the right -->
    <TresPointLight
      v-if="store.redLight.enabled"
      :position="[3, 2, 1]"
      :color="store.redLight.color"
      :intensity="store.redLight.intensity"
      :distance="10"
      :decay="1"
    />
    <!-- Red Light Helper -->
    <TresMesh
      v-if="store.redLight.enabled && store.showLightHelpers"
      :position="[3, 2, 1]"
    >
      <TresSphereGeometry :args="[0.1, 8, 8]" />
      <TresMeshBasicMaterial :color="store.redLight.color" />
    </TresMesh>

    <!-- Green Light - positioned to the left -->
    <TresPointLight
      v-if="store.greenLight.enabled"
      :position="[-3, 2, 1]"
      :color="store.greenLight.color"
      :intensity="store.greenLight.intensity"
      :distance="10"
      :decay="1"
    />
    <!-- Green Light Helper -->
    <TresMesh
      v-if="store.greenLight.enabled && store.showLightHelpers"
      :position="[-3, 2, 1]"
    >
      <TresSphereGeometry :args="[0.1, 8, 8]" />
      <TresMeshBasicMaterial :color="store.greenLight.color" />
    </TresMesh>

    <!-- Blue Light - positioned behind -->
    <TresPointLight
      v-if="store.blueLight.enabled"
      :position="[0, 2, -3]"
      :color="store.blueLight.color"
      :intensity="store.blueLight.intensity"
      :distance="10"
      :decay="1"
    />
    <!-- Blue Light Helper -->
    <TresMesh
      v-if="store.blueLight.enabled && store.showLightHelpers"
      :position="[0, 2, -3]"
    >
      <TresSphereGeometry :args="[0.1, 8, 8]" />
      <TresMeshBasicMaterial :color="store.blueLight.color" />
    </TresMesh>

    <!-- Yellow Light - positioned in front -->
    <TresPointLight
      v-if="store.yellowLight.enabled"
      :position="[0, 1, 3]"
      :color="store.yellowLight.color"
      :intensity="store.yellowLight.intensity"
      :distance="8"
      :decay="1"
    />
    <!-- Yellow Light Helper -->
    <TresMesh
      v-if="store.yellowLight.enabled && store.showLightHelpers"
      :position="[0, 1, 3]"
    >
      <TresSphereGeometry :args="[0.1, 8, 8]" />
      <TresMeshBasicMaterial :color="store.yellowLight.color" />
    </TresMesh>

    <!-- Purple Light - positioned above -->
    <TresPointLight
      v-if="store.purpleLight.enabled"
      :position="[0, 4, 0]"
      :color="store.purpleLight.color"
      :intensity="store.purpleLight.intensity"
      :distance="10"
      :decay="1"
    />
    <!-- Purple Light Helper -->
    <TresMesh
      v-if="store.purpleLight.enabled && store.showLightHelpers"
      :position="[0, 4, 0]"
    >
      <TresSphereGeometry :args="[0.1, 8, 8]" />
      <TresMeshBasicMaterial :color="store.purpleLight.color" />
    </TresMesh>

    <!-- Dramatic Spotlight from above-right -->
    <TresSpotLight
      v-if="store.spotlight.enabled"
      :position="[4, 6, 2]"
      :color="store.spotlight.color"
      :intensity="store.spotlight.intensity"
      :angle="store.spotlight.angle"
      :penumbra="0.3"
      :distance="15"
      :decay="1"
    />
    <!-- Spotlight Helper -->
    <TresMesh
      v-if="store.spotlight.enabled && store.showLightHelpers"
      :position="[4, 6, 2]"
    >
      <TresSphereGeometry :args="[0.15, 8, 8]" />
      <TresMeshBasicMaterial :color="store.spotlight.color" />
    </TresMesh>
  </TresGroup>
</template>

<script lang="ts" setup>
import { useSceneControlStore } from "~/stores/SceneControl";
const store = useSceneControlStore();
</script>

<style></style>
