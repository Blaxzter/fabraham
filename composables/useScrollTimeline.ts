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

/**
 * Put the DOCUMENT where a given progress value says it should be.
 *
 * Progress normally flows one way (scroll -> ScrollTrigger -> store), and
 * nothing else may write it, or the two disagree. Explore mode is the one
 * exception: page scroll is locked, so the scrubber drives the store directly
 * and this puts the document back in sync on the way out. Without it, leaving
 * explore mode snaps the scene back to wherever the page was actually parked.
 *
 * Must be called AFTER the mode is back to "scroll" (which restarts Lenis);
 * `immediate` so there is no smooth run from the old position.
 */
export const scrollToProgress = (p: number) => {
  if (!import.meta.client) return;
  const max = ScrollTrigger.maxScroll(window);
  const y = Math.max(0, Math.min(1, p)) * max;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
  ScrollTrigger.update();
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
 * The single ScrollTrigger maps document scroll → `sectionsStore.progress`; the
 * camera and everything else derive from that one value. ASCII cell/font size
 * are pushed to the SceneControl store reactively (scroll-driven, not 60fps).
 *
 * Call once from the component that owns the scrollable content lifecycle.
 */
export function useScrollTimeline() {
  const store = useSectionsStore();
  const sceneControl = useSceneControlStore();

  let ctx: ReturnType<typeof gsap.context> | null = null;
  let stopAscii: (() => void) | null = null;
  let stopRefresh: (() => void) | null = null;
  let stopOrbitLock: (() => void) | null = null;

  onMounted(() => {
    if (!import.meta.client) return;
    startSmoothScroll();

    ctx = gsap.context(() => {
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => store.setProgress(self.progress),
      });
    });

    // Push ASCII params reactively off progress (replaces the old per-frame writes).
    stopAscii = watch(
      () => store.progress,
      () => {
        sceneControl.cellSize = store.asciiCellSize;
        sceneControl.fontSize = store.asciiFontSize;
      },
      { immediate: true }
    );

    // The document height depends on the (async-loaded) sections; refresh the
    // trigger whenever the section count changes and on resize.
    stopRefresh = watch(
      () => store.sections.length,
      () => requestAnimationFrame(() => ScrollTrigger.refresh()),
      { immediate: true }
    );

    // In orbit (free-camera) dev mode, lock the page scroll so the wheel/touch
    // only drives OrbitControls (zoom/rotate) instead of also scrolling the page.
    // lenis.stop() is Lenis's scroll-lock (as used for modals); the canvas's own
    // wheel listener still reaches OrbitControls. Resume on return to scroll mode.
    stopOrbitLock = watch(
      () => sceneControl.cameraControlMode,
      (mode) => {
        if (mode === "orbit") lenis?.stop();
        else lenis?.start();
      },
      { immediate: true }
    );
  });

  onBeforeUnmount(() => {
    stopAscii?.();
    stopRefresh?.();
    stopOrbitLock?.();
    ctx?.revert(); // kills the ScrollTrigger created in this context
    ctx = null;
    stopSmoothScroll();
  });
}
