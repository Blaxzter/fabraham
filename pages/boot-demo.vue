<template>
  <!-- Black behind the set: this page has no scene for the room to clear to. -->
  <div class="relative h-screen bg-black">
    <BootScreen v-if="!bootState.bootCompleted" />

    <div v-else class="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div class="text-center space-y-4">
        <h1 class="text-4xl font-bold">Boot Complete! ✅</h1>
        <p class="text-gray-400">The boot screen system is working correctly.</p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <button
            class="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
            @click="arm"
          >
            Replay boot
          </button>
        </div>
        <div class="mt-4">
          <NuxtLink to="/" class="text-cyan-400 hover:underline"> ← Back to Home </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const bootState = useBootStateStore();

// No model to load here, so the memory test counts on its own clock.
const arm = () => {
  bootState.reset();
  bootState.markSceneReady();
};

onMounted(arm);

useSeoMeta({
  title: "Boot Screen Demo",
  description: "Test page for the DOS/BIOS boot screen system",
});
</script>
