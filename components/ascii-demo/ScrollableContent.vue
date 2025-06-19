<script setup lang="ts">
// No additional props or setup needed for now
// All content is static sections with text
</script>

<template>
  <!-- Scrollable Content -->
  <div class="relative z-10">
    <!-- Section 1: Start Position -->
    <section class="h-screen flex items-center justify-center bg-transparent">
      <div
        class="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm"
      >
        <h1 class="text-4xl font-bold mb-4">ASCII Demo</h1>
        <p class="text-lg opacity-80">
          Scroll to experience the camera animation
        </p>
        <p class="text-sm mt-2 opacity-60">Camera: Start Position</p>
      </div>
    </section>

    <!-- Section 2: Zoom Out -->
    <section class="h-screen flex items-center justify-center bg-transparent">
      <div
        class="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm"
      >
        <h2 class="text-3xl font-bold mb-4">Zooming Out</h2>
        <p class="text-lg opacity-80">
          The camera is pulling back to reveal more of the scene
        </p>
        <p class="text-sm mt-2 opacity-60">Camera: Middle Position</p>
      </div>
    </section>

    <!-- Section 3: Side View -->
    <section class="h-screen flex items-center justify-center bg-transparent">
      <div
        class="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm"
      >
        <h2 class="text-3xl font-bold mb-4">Side Perspective</h2>
        <p class="text-lg opacity-80">
          Moving to a side angle for a different view
        </p>
        <p class="text-sm mt-2 opacity-60">Camera: End Position</p>
      </div>
    </section>

    <!-- Additional content for more scroll -->
    <section class="h-screen flex items-center justify-center bg-transparent">
      <div
        class="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm"
      >
        <h2 class="text-3xl font-bold mb-4">End of Journey</h2>
        <p class="text-lg opacity-80">The camera animation is complete</p>
        <p class="text-sm mt-2 opacity-60">
          Use the controls panel to switch to orbit mode
        </p>
      </div>
    </section>
  </div>
</template>
