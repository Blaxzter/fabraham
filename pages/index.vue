<template>
  <div class="relative">
    <!-- Fixed 3D Scene Background -->
    <div class="fixed inset-0 w-full h-screen">
      <HomeScene3D />
    </div>

    <!-- Scrollable Content Component -->
    <HomeScrollableContent />
  </div>
</template>

<script setup>
import { useSmoothScroll } from "~/composables/useSmoothScroll";

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
