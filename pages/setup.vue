<template>
  <div class="relative">
    <!-- Controls Panel -->
    <HomeControlsPanel />

    <!-- Fixed 3D Scene Background -->
    <div class="fixed inset-0 w-full h-screen">
      <HomeScene3D />
    </div>

    <!-- Scrollable Content Component -->
    <HomeScrollableContent v-if="store.cameraControlMode !== 'orbit'" />
  </div>
</template>

<script setup lang="ts">
import { useSmoothScroll } from "~/composables/useSmoothScroll";
import { useSceneControlStore } from "~/stores/SceneControl";

const store = useSceneControlStore();

// Initialize smooth scroll system
const _smoothScroll = useSmoothScroll();

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
