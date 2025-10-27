<template>
  <div class="relative">
    <!-- Boot Screen -->
    <BootScreen v-if="!bootState.bootCompleted" />

    <!-- Fixed 3D Scene Background - Start loading during boot sequence -->
    <div
      v-if="shouldLoadScene"
      class="fixed inset-0 w-full h-screen pointer-events-none"
    >
      <HomeScene3D />
    </div>

    <!-- Scrollable Content Component - Only show after boot complete -->
    <HomeScrollableContent v-if="bootState.bootCompleted" />
  </div>
</template>

<script setup>
const bootState = useBootStateStore();

// Start loading scene when boot sequence starts (loads in background)
const shouldLoadScene = computed(() => {
  return (
    bootState.phase === "booting" ||
    bootState.phase === "loading-scene" ||
    bootState.bootCompleted
  );
});

// Meta data
useSeoMeta({
  title: "Fabraham",
  description:
    "Explore my computer science portfolio featuring web development, machine learning, and blockchain projects.",
  ogTitle: "Fabraham",
  ogDescription:
    "Explore my computer science portfolio featuring web development, machine learning, and blockchain projects.",
  ogType: "website",
});
</script>
