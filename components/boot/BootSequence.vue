<template>
  <div ref="containerRef" class="space-y-0.5 overflow-auto">
    <BootLine v-for="(line, index) in visibleLines" :key="index">
      <component :is="getLineWithActiveState(line, index)" />
    </BootLine>
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent, cloneVNode } from "vue";

const emit = defineEmits<{
  complete: [];
  easterEgg: [];
  bootMenu: [];
}>();

const containerRef = ref<HTMLElement | null>(null);
const visibleLines = ref<any[]>([]);
const activeLineIndex = ref(-1); // Track which line currently has the cursor
let bootTimeline: gsap.core.Timeline | null = null;

// Function to add isActive prop to VNode
const getLineWithActiveState = (line: any, index: number) => {
  const vnode = typeof line === "function" ? line() : line;
  // Add isActive prop to all VNodes (non-component elements like <br> will ignore it)
  if (vnode && typeof vnode.type !== "string") {
    // It's a component, not a native element
    return cloneVNode(vnode, { isActive: index === activeLineIndex.value });
  }
  return vnode;
};

// ===== DEBUG CONFIGURATION =====
// Global speed multiplier - adjust to make entire boot faster/slower
const SPEED_MULTIPLIER = 0.4; // 0.5 = 2x faster, 2.0 = 2x slower

// Disable auto-boot to home screen (stays at end of boot sequence)
const DISABLE_AUTO_BOOT = false; // Set to true for debugging

// Disable "press any key to skip" functionality
const DISABLE_SKIP = true; // Set to true to force watching full boot sequence

// Random delay configuration
const ENABLE_RANDOM_DELAYS = true; // Add randomness to delays for realism
const RANDOM_DELAY_MIN = -0.1; // Minimum random adjustment (seconds)
const RANDOM_DELAY_MAX = 0.3; // Maximum random adjustment (seconds)
// ===============================

// Resolve the BootText component for use in h()
const BootTextComponent = resolveComponent("BootText");

// Generate random delay variation
const getRandomDelay = (baseDelay: number): number => {
  if (!ENABLE_RANDOM_DELAYS) return baseDelay;
  const randomAdjustment =
    Math.random() * (RANDOM_DELAY_MAX - RANDOM_DELAY_MIN) + RANDOM_DELAY_MIN;
  return Math.max(0, baseDelay + randomAdjustment); // Ensure non-negative
};

// Boot sequence messages with timing delays (in seconds after previous message)
// Format: { message: () => VNode, delay: number }
const bootMessages = [
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "FABRAHAM BIOS v3.14.2025",
        color: "cyan",
        bold: true,
      }),
    delay: 0,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Copyright (C) 2025, Fabraham Systems",
        color: "white",
      }),
    delay: 0.1,
  },
  { message: () => h("br"), delay: 0.3 },

  // Hardware detection - slower
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Detecting hardware configuration...",
        color: "white",
      }),
    delay: 0.5,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "CPU: Neural Processing Unit @4.2GHz [OK]",
        color: "green",
      }),
    delay: 0.4,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "GPU: WebGL Rendering Engine v2.0 [OK]",
        color: "green",
      }),
    delay: 0.3,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Memory: 32GB DDR5-6000 [OK]",
        color: "green",
      }),
    delay: 0.3,
  },
  { message: () => h("br"), delay: 0.2 },

  // Memory test - fast
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Testing system memory...",
        color: "white",
      }),
    delay: 0.3,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Testing: 16MB",
        color: "white",
      }),
    delay: 0.05,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Testing: 512MB",
        color: "white",
      }),
    delay: 0.05,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Testing: 4GB",
        color: "white",
      }),
    delay: 0.05,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Testing: 16GB",
        color: "white",
      }),
    delay: 0.05,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Testing: 32GB [OK]",
        color: "green",
      }),
    delay: 0.05,
  },
  { message: () => h("br"), delay: 0.2 },

  // Loading components - medium speed
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Loading system components...",
        color: "white",
      }),
    delay: 0.4,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Vue.js Framework",
        color: "green",
      }),
    delay: 0.15,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Nuxt.js Runtime",
        color: "green",
      }),
    delay: 0.15,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Three.js Engine",
        color: "green",
      }),
    delay: 0.15,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → GSAP Animation Library",
        color: "green",
      }),
    delay: 0.15,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → TresJS Integration",
        color: "green",
      }),
    delay: 0.15,
  },
  { message: () => h("br"), delay: 0.2 },

  // Initializing - slower for 3D stuff
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Initializing 3D Environment...",
        color: "cyan",
      }),
    delay: 0.5,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Setting up WebGL context",
        color: "white",
      }),
    delay: 0.3,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Loading GLTF models",
        color: "white",
      }),
    delay: 0.6,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Compiling shaders",
        color: "white",
      }),
    delay: 0.4,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Initializing post-processing",
        color: "white",
      }),
    delay: 0.3,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Setting up lighting",
        color: "white",
      }),
    delay: 0.2,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Configuring camera",
        color: "white",
      }),
    delay: 0.2,
  },
  { message: () => h("br"), delay: 0.3 },

  // Final checks - medium
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Running system diagnostics...",
        color: "white",
      }),
    delay: 0.4,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Render pipeline: OK",
        color: "green",
      }),
    delay: 0.2,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Animation system: OK",
        color: "green",
      }),
    delay: 0.2,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "  → Asset loader: OK",
        color: "green",
      }),
    delay: 0.2,
  },
  { message: () => h("br"), delay: 0.3 },

  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "All systems operational.",
        color: "green",
        bold: true,
      }),
    delay: 0.5,
  },
  {
    message: () =>
      h(BootTextComponent, {
        animate: true,
        text: "Booting to home screen...",
        color: "cyan",
      }),
    delay: 0.8,
  },
];

const { gsap } = useGsap();

onMounted(() => {
  if (import.meta.client) {
    animateBootSequence();

    // Add keyboard listener (check for DELETE key)
    if (!DISABLE_SKIP) {
      window.addEventListener("keydown", handleKeydown);
      // Allow skipping with click
      window.addEventListener("click", () => skipBootSequence());
    } else {
      // Even with skip disabled, still listen for DEL/F10
      window.addEventListener("keydown", handleSpecialKeys);
    }
  }
});

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener("keydown", handleKeydown);
    window.removeEventListener("keydown", handleSpecialKeys);
    window.removeEventListener("click", () => skipBootSequence());
  }
});

const handleKeydown = (e: KeyboardEvent) => {
  skipBootSequence(e);
};

const handleSpecialKeys = (e: KeyboardEvent) => {
  // Only handle DEL and F10 when skip is disabled
  if (e.key === "Delete" || e.key === "F10") {
    skipBootSequence(e);
  }
};

const skipBootSequence = (e?: KeyboardEvent) => {
  // Check for DELETE key - easter egg (BIOS)
  if (e?.key === "Delete") {
    if (bootTimeline) {
      bootTimeline.kill();
    }
    emit("easterEgg");
    return;
  }

  // Check for F10 key - boot menu
  if (e?.key === "F10") {
    if (bootTimeline) {
      bootTimeline.kill();
    }
    emit("bootMenu");
    return;
  }

  // Normal skip behavior (any other key)
  if (bootTimeline) {
    bootTimeline.progress(1); // Jump to end
  }
};

const animateBootSequence = () => {
  bootTimeline = gsap.timeline({
    onComplete: () => {
      // Only emit complete if auto-boot is enabled
      if (!DISABLE_AUTO_BOOT) {
        console.log("🎬 Boot sequence complete - emitting complete event");
        emit("complete");
      } else {
        console.log("⏸️ Boot sequence complete - auto-boot disabled");
      }
      // If auto-boot disabled, sequence just stops at the end
    },
  });

  // Add each line with variable timing for realism
  let cumulativeDelay = 0;
  bootMessages.forEach(({ message, delay }, messageIndex) => {
    // Apply random variation to delay for more realistic timing
    const randomizedDelay = getRandomDelay(delay);
    cumulativeDelay += randomizedDelay * SPEED_MULTIPLIER; // Apply global speed multiplier
    bootTimeline!.call(
      () => {
        visibleLines.value.push(message);
        // Update active line index (only for BootText components, not <br>)
        activeLineIndex.value = visibleLines.value.length - 1;

        // Auto-scroll to bottom
        nextTick(() => {
          if (containerRef.value) {
            containerRef.value.scrollTop = containerRef.value.scrollHeight;
          }
        });
      },
      [],
      cumulativeDelay
    );
  });
};
</script>
