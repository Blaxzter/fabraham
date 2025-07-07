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
