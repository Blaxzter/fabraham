<template>
  <div class="relative">
    <!-- Controls Panel -->
    <HomeControlsPanel />

    <!-- Fixed 3D Scene Background -->
    <div class="fixed inset-0 w-full h-screen">
      <HomeScene3D />
    </div>

    <!-- Scrollable Content Component -->
    <HomeScrollableContent v-if="cameraControlMode !== 'orbit'" />
  </div>
</template>

<script setup lang="ts">
const { cameraControlMode } = storeToRefs(useSceneControlStore());

// Meta data
useSeoMeta({
  title: "CS Portfolio | Computer Science Projects",
  description:
    "Explore my computer science portfolio featuring web development, machine learning, and blockchain projects.",
  ogTitle: "CS Portfolio | Computer Science Projects",
  ogDescription:
    "Explore my computer science portfolio featuring web development, machine learning, and blockchain projects.",
  ogType: "website",
});
</script>
