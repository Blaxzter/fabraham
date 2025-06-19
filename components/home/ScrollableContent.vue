<script setup lang="ts">
import { onMounted } from "vue";
import AsciiTextAnimation from "./AsciiTextAnimation.vue";
import { useScrollAnimations } from "~/composables/useScrollAnimations";

// Use the centralized scroll animations composable
const { scrollProgress, startAnimationLoop } = useScrollAnimations();

onMounted(() => {
  if (import.meta.client) {
    startAnimationLoop();
  }
});
</script>

<template>
  <!-- ASCII Text Animation Section (2 viewport heights) -->
  <div class="relative z-10">
    <!-- ASCII Animation Viewport -->
    <section class="h-[200vh]">
      <AsciiTextAnimation :scroll-progress="scrollProgress" />
    </section>
  </div>

  <!-- Some white space for the scroll effect to kick in -->
  <div class="h-[500vh]" />

  <!-- Regular Content Sections (start after ASCII animation) -->
  <div class="relative z-10">
    <!-- Section 1: Introduction -->
    <section class="h-screen flex items-center justify-center bg-transparent">
      <div
        class="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm max-w-2xl"
      >
        <h1 class="text-4xl font-bold mb-4">Welcome to My World</h1>
        <p class="text-lg opacity-80 mb-4">
          Full-stack developer passionate about creating digital experiences
        </p>
        <p class="text-sm opacity-60">Camera: Start Position</p>
      </div>
    </section>

    <!-- Section 2: Skills -->
    <section class="h-screen flex items-center justify-center bg-transparent">
      <div
        class="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm max-w-2xl"
      >
        <h2 class="text-3xl font-bold mb-4">Technology Stack</h2>
        <p class="text-lg opacity-80 mb-4">
          From frontend frameworks to backend architecture, I build scalable
          solutions
        </p>
        <p class="text-sm opacity-60">Camera: Middle Position</p>
      </div>
    </section>

    <!-- Section 3: Experience -->
    <section class="h-screen flex items-center justify-center bg-transparent">
      <div
        class="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm max-w-2xl"
      >
        <h2 class="text-3xl font-bold mb-4">Experience</h2>
        <p class="text-lg opacity-80 mb-4">
          Years of crafting code and solving complex problems
        </p>
        <p class="text-sm opacity-60">Camera: End Position</p>
      </div>
    </section>

    <!-- Section 4: Contact -->
    <section class="h-screen flex items-center justify-center bg-transparent">
      <div
        class="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm max-w-2xl"
      >
        <h2 class="text-3xl font-bold mb-4">Let's Connect</h2>
        <p class="text-lg opacity-80 mb-4">Ready to bring your ideas to life</p>
        <p class="text-sm opacity-60">Use the controls panel to explore more</p>
      </div>
    </section>
  </div>
</template>
