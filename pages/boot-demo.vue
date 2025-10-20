<template>
  <div class="relative h-screen">
    <BootScreen v-if="!bootState.bootCompleted" />

    <div
      v-else
      class="flex items-center justify-center h-screen bg-gray-900 text-white"
    >
      <div class="text-center space-y-4">
        <h1 class="text-4xl font-bold">Boot Complete! ✅</h1>
        <p class="text-gray-400">
          The boot screen system is working correctly.
        </p>
        <button
          @click="resetBoot"
          class="mt-8 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
        >
          Replay Boot Sequence
        </button>
        <div class="mt-4">
          <NuxtLink to="/" class="text-cyan-400 hover:underline">
            ← Back to Home
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const bootState = useBootStateStore();

// Reset boot state when component mounts to always show the boot screen
onMounted(() => {
  bootState.reset();
  // Mark scene as ready since boot-demo doesn't have a 3D scene to load
  bootState.markSceneReady();
});

const resetBoot = () => {
  bootState.reset();
  // Mark scene as ready again for the replay
  bootState.markSceneReady();
};

useSeoMeta({
  title: "Boot Screen Demo",
  description: "Test page for the DOS/BIOS boot screen system",
});
</script>
