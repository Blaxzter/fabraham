import { ref, onMounted, onUnmounted } from "vue";
import Lenis from "lenis";

export function useSmoothScroll() {
  const lenis = ref<Lenis | null>(null);
  const isEnabled = ref(true);

  // Initialize Lenis smooth scrolling
  const initLenis = () => {
    lenis.value = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Custom easing
    });

    // Start the animation loop
    const raf = (time: number) => {
      lenis.value?.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  };

  // Control functions
  const enable = () => {
    isEnabled.value = true;
    lenis.value?.start();
  };

  const disable = () => {
    isEnabled.value = false;
    lenis.value?.stop();
  };

  const scrollTo = (
    target: string | number | HTMLElement,
    options?: Record<string, unknown>
  ) => {
    lenis.value?.scrollTo(target, options);
  };

  // Lifecycle
  onMounted(() => {
    if (import.meta.client) {
      initLenis();
    }
  });

  onUnmounted(() => {
    lenis.value?.destroy();
  });

  return {
    lenis,
    isEnabled,
    enable,
    disable,
    scrollTo,
  };
}
