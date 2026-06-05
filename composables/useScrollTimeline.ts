import { onMounted, onBeforeUnmount, watch } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

// Module-level singleton: there is exactly one smooth-scroll instance per page,
// driven by GSAP's ticker (no standalone rAF loop) and synced to ScrollTrigger.
let lenis: Lenis | null = null;
let tickerFn: ((time: number) => void) | null = null;

const startSmoothScroll = () => {
  if (lenis) return;
  gsap.registerPlugin(ScrollTrigger);
  lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  // Lenis emits scroll → ScrollTrigger recomputes progress (cached layout).
  lenis.on("scroll", ScrollTrigger.update);
  // Drive Lenis from GSAP's single ticker instead of its own rAF loop.
  tickerFn = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);
};

const stopSmoothScroll = () => {
  if (tickerFn) {
    gsap.ticker.remove(tickerFn);
    tickerFn = null;
  }
  // Restore GSAP's documented default lag smoothing — startSmoothScroll disabled
  // it globally, and that must not leak to other pages after teardown.
  gsap.ticker.lagSmoothing(500, 33);
  lenis?.destroy();
  lenis = null;
};

/**
 * Owns the scroll → progress pipeline and its teardown (issue #4):
 * one Lenis + one ScrollTrigger, no per-frame layout reads, no leaked rAF.
 *
 * The single ScrollTrigger maps document scroll → `timelineStore.progress`; the
 * camera and everything else derive from that one value. ASCII cell/font size
 * are pushed to the SceneControl store reactively (scroll-driven, not 60fps).
 *
 * Call once from the component that owns the scrollable content lifecycle.
 */
export function useScrollTimeline() {
  const timeline = useTimelineStore();
  const sceneControl = useSceneControlStore();

  let ctx: ReturnType<typeof gsap.context> | null = null;
  let stopAscii: (() => void) | null = null;
  let stopRefresh: (() => void) | null = null;

  onMounted(() => {
    if (!import.meta.client) return;
    startSmoothScroll();

    ctx = gsap.context(() => {
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => timeline.setProgress(self.progress),
      });
    });

    // Push ASCII params reactively off progress (replaces the old per-frame writes).
    stopAscii = watch(
      () => timeline.progress,
      () => {
        sceneControl.cellSize = timeline.asciiCellSize;
        sceneControl.fontSize = timeline.asciiFontSize;
      },
      { immediate: true }
    );

    // The document height depends on the (async-loaded) chapters; refresh the
    // trigger whenever the chapter count changes and on resize.
    stopRefresh = watch(
      () => timeline.chapters.length,
      () => requestAnimationFrame(() => ScrollTrigger.refresh()),
      { immediate: true }
    );
  });

  onBeforeUnmount(() => {
    stopAscii?.();
    stopRefresh?.();
    ctx?.revert(); // kills the ScrollTrigger created in this context
    ctx = null;
    stopSmoothScroll();
  });
}
