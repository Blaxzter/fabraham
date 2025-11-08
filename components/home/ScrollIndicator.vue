<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

// Props to control visibility
interface Props {
  scrollProgress?: number;
  fadeOutThreshold?: number; // At what scroll progress should it fade out (0-1)
}

const props = withDefaults(defineProps<Props>(), {
  scrollProgress: 0,
  fadeOutThreshold: 0.1,
});

// Calculate opacity based on scroll progress
const opacity = computed(() => {
  if (props.scrollProgress >= props.fadeOutThreshold) {
    return 0;
  }
  return 1 - props.scrollProgress / props.fadeOutThreshold;
});

// Visibility control
const isVisible = computed(() => opacity.value > 0);
</script>

<template>
  <div v-if="isVisible" class="scroll-indicator" :style="{ opacity: opacity }">
    <div class="arrow-container">
      <pre class="ascii-arrow">
   |
   |
   |
  \|/
   V
      </pre>
      <p class="scroll-text">SCROLL</p>
    </div>
  </div>
</template>

<style scoped>
.scroll-indicator {
  position: fixed;
  bottom: 40px;
  left: 5%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
  transition: opacity 0.3s ease-out;
}

.arrow-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: bounce 2s ease-in-out infinite;
}

.ascii-arrow {
  font-family: "Courier New", monospace;
  font-size: 1.2rem;
  line-height: 1.2;
  color: white;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.8),
    0 0 20px rgba(255, 255, 255, 0.4);
  margin-bottom: -1rem;
  padding: 0;
}

.scroll-text {
  font-family: "Courier New", monospace;
  font-size: 0.875rem;
  letter-spacing: 0.2em;
  color: white;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.8),
    0 0 20px rgba(255, 255, 255, 0.4);
  margin-top: 0.1rem;
  margin-left: 0.8rem;
  font-weight: 600;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .scroll-indicator {
    bottom: 30px;
  }

  .ascii-arrow {
    font-size: 1rem;
  }

  .scroll-text {
    font-size: 0.75rem;
  }
}
</style>
