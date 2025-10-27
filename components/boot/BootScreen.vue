<template>
  <div
    ref="screenRef"
    class="fixed inset-0 z-50 bg-black text-green-400 overflow-hidden flex items-center justify-center boot-screen screen-flicker"
  >
    <!-- Comprehensive CRT Effect Layer -->
    <BootCrtEffect />

    <!-- Content Container -->
    <div
      class="relative w-full h-full max-w-4xl max-h-screen p-8 overflow-hidden"
      :class="{ 'pb-20': bootState.phase === 'booting' }"
    >
      <!-- Boot Sequence Phase -->
      <div
        v-if="bootState.phase === 'booting'"
        ref="bootSequenceRef"
        class="h-full"
      >
        <BootSequence
          @complete="onBootSequenceComplete"
          @easter-egg="onEasterEgg"
          @boot-menu="onBootMenuRequested"
        />
      </div>

      <!-- Easter Egg Phase -->
      <div v-else-if="bootState.phase === 'easter-egg'" ref="easterEggRef">
        <BootEasterEgg
          @exit="onEasterEggExit"
          @continue="onEasterEggContinue"
        />
      </div>

      <!-- Menu Phase -->
      <div v-else-if="bootState.phase === 'menu'" ref="menuRef">
        <BootMenu @select="onMenuSelect" />
      </div>

      <!-- Loading Scene Phase - Minimal, scene should be ready soon -->
      <div
        v-else-if="bootState.phase === 'loading-scene'"
        class="flex items-center justify-center min-h-[60vh]"
      >
        <div class="text-xs">
          <BootText text="..." color="green" />
        </div>
      </div>
    </div>

    <!-- Sticky footer with key hints (only during boot sequence) -->
    <div
      v-if="bootState.phase === 'booting'"
      class="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-700 p-3 text-xs"
    >
      <div class="max-w-4xl mx-auto flex justify-between items-center">
        <BootText text="DEL: BIOS Setup" color="white" />
        <BootText text="F10: Boot Menu" color="white" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const bootState = useBootStateStore();
const router = useRouter();
const screenRef = ref<HTMLElement | null>(null);
const bootSequenceRef = ref<HTMLElement | null>(null);
const easterEggRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);

const { gsap } = useGsap();

// Start boot sequence after mount
onMounted(() => {
  if (import.meta.client) {
    setTimeout(() => {
      bootState.setPhase("booting");
    }, 100);
  }
});

const onBootSequenceComplete = () => {
  console.log("✅ Boot sequence complete event received!");
  console.log("Scene ready?", bootState.sceneReady);

  // Check if scene is already ready
  if (bootState.sceneReady) {
    // Scene loaded during boot - fade out immediately
    console.log("→ Scene ready, fading out immediately");
    fadeOutBootScreen();
  } else {
    // Scene still loading - show minimal loading state
    console.log("→ Scene not ready, showing loading screen");
    bootState.setPhase("loading-scene");

    // Wait for scene to be ready before transitioning
    const unwatch = watch(
      () => bootState.sceneReady,
      (isReady) => {
        if (isReady) {
          console.log("→ Scene became ready, fading out");
          unwatch();
          fadeOutBootScreen();
        }
      }
    );
  }
};

const onBootMenuRequested = async () => {
  // F10 pressed - show boot menu
  if (bootSequenceRef.value) {
    await gsap.to(bootSequenceRef.value, {
      opacity: 0,
      duration: 0.3,
    });
  }
  bootState.setPhase("menu");
};

const onEasterEgg = async () => {
  // Fade out boot sequence
  if (bootSequenceRef.value) {
    await gsap.to(bootSequenceRef.value, {
      opacity: 0,
      duration: 0.3,
    });
  }
  bootState.setPhase("easter-egg");
};

const onEasterEggExit = async () => {
  // Return to boot sequence
  if (easterEggRef.value) {
    await gsap.to(easterEggRef.value, {
      opacity: 0,
      duration: 0.3,
    });
  }
  bootState.setPhase("booting");
};

const onEasterEggContinue = async () => {
  // Skip to menu
  if (easterEggRef.value) {
    await gsap.to(easterEggRef.value, {
      opacity: 0,
      duration: 0.3,
    });
  }
  bootState.setPhase("menu");
};

const onMenuSelect = async (route: string) => {
  // Fade out menu
  if (menuRef.value) {
    await gsap.to(menuRef.value, {
      opacity: 0,
      duration: 0.3,
    });
  }

  // If going to home, show loading and wait for scene
  if (route === "/") {
    if (bootState.sceneReady) {
      fadeOutBootScreen();
    } else {
      bootState.setPhase("loading-scene");

      // Wait for scene to be ready before transitioning
      const unwatch = watch(
        () => bootState.sceneReady,
        (isReady) => {
          if (isReady) {
            unwatch();
            fadeOutBootScreen();
          }
        }
      );
    }
  } else {
    // For other routes, navigate immediately
    await navigateTo(route);
    fadeOutBootScreen();
  }
};

const fadeOutBootScreen = async () => {
  console.log("🌅 Starting fade out animation...");
  if (screenRef.value) {
    await gsap.to(screenRef.value, {
      opacity: 0,
      duration: 1,
      ease: "power2.inOut",
      onComplete: () => {
        console.log("✨ Fade complete - calling completeBootSequence()");
        bootState.completeBootSequence();
        console.log("✅ bootCompleted is now:", bootState.bootCompleted);
      },
    });
  }
};
</script>

<style scoped>
.bg-gradient-radial {
  background: radial-gradient(circle, transparent 0%, rgba(0, 0, 0, 0.3) 100%);
}
</style>
