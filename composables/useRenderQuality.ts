import { computed, effectScope, ref, shallowRef, watch } from "vue";
import { useDevicePixelRatio, useWindowSize } from "@vueuse/core";

/**
 * How hard the scene may work on this device.
 *
 * Three things decide it, in this order:
 *
 *   1. What the GPU is. Probed once, with a throwaway context: a real GPU, a
 *      SOFTWARE rasteriser (the browser's "use graphics acceleration" switch is
 *      off, or the driver is blocklisted, and WebGL is being drawn on the CPU),
 *      or no WebGL at all. Software is ~50x slower per pixel than even a weak
 *      GPU, so it gets its own tier rather than a step down from the normal one.
 *   2. What the visitor asked for on /setup (`graphics`): "auto" is the above,
 *      "high" and "low" pin it.
 *   3. How it actually runs. `RenderGovernor` watches the frame pacing and, on a
 *      GPU that cannot keep up, steps the pixel ratio down (`stepDown`). Only
 *      ever down, and only on "auto".
 *
 * What a tier changes is RESOLUTION and optional detail, never the composition:
 * the same cameras, the same pieces, the same timing. The one thing that does
 * move is the ASCII grid, whose cells are a fixed number of device pixels, so
 * at a lower pixel ratio there are fewer, larger characters. That is on
 * purpose: shrinking the cells instead would keep the density and turn every
 * character into a smudge, and legible characters are the look.
 *
 * SSR-safe the same way `usePreferences` is: module-level refs with neutral
 * defaults, and the probe runs on the client at first use. `webgl` reads true
 * until then, so nothing rendered on the server may branch on it; gate it
 * behind an `onMounted` flag (see the note on `reducedMotion` in the docs).
 */
export type QualityTier = "high" | "low" | "minimal";

interface TierSettings {
  /** Most device pixels the canvas may have; the pixel ratio is cut to fit. */
  pixelBudget: number;
  /** Render loop cap. */
  fps: number;
  /**
   * Lit-pass texels across one ASCII cell (see HeroAscii). The ASCII pass reads
   * the scene once per cell, so this is how much finer than the grid the scene
   * is rendered: 3 keeps the sample in the middle third of its cell, which is
   * what a full-resolution render gave; 2 averages the whole cell.
   */
  sceneTexels: number;
  /** MSAA samples on that buffer. */
  sceneSamples: number;
  /** MSAA on the canvas itself, for the crisp line overlay. Fixed at creation. */
  antialias: boolean;
  /** Share of the optional particles (the skills shards) that are drawn. */
  density: number;
}

const TIERS: Record<QualityTier, TierSettings> = {
  high: { pixelBudget: Infinity, fps: 60, sceneTexels: 3, sceneSamples: 4, antialias: true, density: 1 },
  // A real GPU, asked to go easy: about 1080p worth of pixels at most.
  low: { pixelBudget: 1_600_000, fps: 60, sceneTexels: 2, sceneSamples: 0, antialias: false, density: 0.6 },
  // A software rasteriser. Every pixel is CPU time, and so is every pixel the
  // page composites over the canvas, so the budget is small and the cap is 30:
  // an even 30 reads better than a frame rate wandering between 20 and 45.
  minimal: { pixelBudget: 420_000, fps: 30, sceneTexels: 2, sceneSamples: 0, antialias: false, density: 0.4 },
};

/**
 * The governor's ladder. Each step scales the pixel ratio; the step past the
 * last one halves the frame rate instead, for a device still behind at half
 * resolution.
 */
const DPR_STEPS = [1, 0.75, 0.5];
const MAX_LEVEL = DPR_STEPS.length;
const MIN_DPR = 0.4;
const SLOW_FPS = 30;

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render|warp/i;
const LEVEL_KEY = "fab:gfx-level";

interface GpuProbe {
  webgl: boolean;
  software: boolean;
  renderer: string;
}

const probeGpu = (): GpuProbe => {
  const context = (strict: boolean) => {
    try {
      return document
        .createElement("canvas")
        .getContext("webgl2", { failIfMajorPerformanceCaveat: strict }) as WebGL2RenderingContext | null;
    } catch {
      return null;
    }
  };
  // `failIfMajorPerformanceCaveat` is the standard question for "is this going
  // to be a software renderer"; the renderer string covers the browsers that
  // answer it loosely.
  let gl = context(true);
  const caveat = !gl;
  if (!gl) gl = context(false);
  // No WebGL at all is the same machine one step further on: nothing here is
  // GPU-accelerated, so the page's own compositing wants the low tier too.
  if (!gl) return { webgl: false, software: true, renderer: "" };
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
  // Contexts are a limited resource and this one has told us what it knows.
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return { webgl: true, software: caveat || SOFTWARE_RENDERER.test(renderer), renderer };
};

const gpu = shallowRef<GpuProbe>({ webgl: true, software: false, renderer: "" });
const level = ref(0);
let initialized = false;

const init = () => {
  initialized = true;
  gpu.value = probeGpu();
  // The rung the governor settled on earlier in this visit, so a reload or a
  // trip to a project page and back does not replay the slow start.
  try {
    const saved = Number(sessionStorage.getItem(LEVEL_KEY));
    if (saved > 0 && saved <= MAX_LEVEL) level.value = Math.floor(saved);
  } catch {
    /* blocked storage: start from the top */
  }
};

const build = () => {
  const { graphics } = usePreferences();
  const { pixelRatio } = useDevicePixelRatio();
  const { width, height } = useWindowSize();

  // The ladder belongs to "auto": a pinned quality starts from its own top.
  if (graphics.value !== "auto") level.value = 0;

  const tier = computed<QualityTier>(() => {
    if (graphics.value === "high") return "high";
    if (gpu.value.software) return "minimal";
    return graphics.value === "low" ? "low" : "high";
  });
  const settings = computed(() => TIERS[tier.value]);

  /** The governor only runs when nobody has pinned the quality. */
  const adaptive = computed(() => graphics.value === "auto" && gpu.value.webgl && level.value < MAX_LEVEL);

  const dpr = computed(() => {
    const system = pixelRatio.value || 1;
    const budget = settings.value.pixelBudget;
    const cssPixels = width.value * height.value;
    // No budget, or no window to measure yet: the display's own ratio.
    const fit = Number.isFinite(budget) && cssPixels > 0 ? Math.sqrt(budget / cssPixels) : system;
    const stepped = Math.min(system, fit) * DPR_STEPS[Math.min(level.value, DPR_STEPS.length - 1)]!;
    // Two decimals: the budget moves with every pixel of a window resize, and
    // each new ratio reallocates the canvas and every buffer behind it.
    return Math.round(Math.max(Math.min(MIN_DPR, system), stepped) * 100) / 100;
  });

  /**
   * The canvas' pixel ratio as a share of the display's own: 1 at full
   * quality, less once a tier or the governor has cut it. For anything sized in
   * DEVICE pixels that should keep its size on screen (the dots, see
   * `setDotScale`).
   */
  const renderScale = computed(() => dpr.value / (pixelRatio.value || 1));

  const fps = computed(() => (level.value >= MAX_LEVEL ? Math.min(SLOW_FPS, settings.value.fps) : settings.value.fps));

  if (import.meta.client) {
    // A CSS hook for the DOM's share of the cost: with the GPU off the page is
    // composited on the CPU too, and a backdrop blur there costs more than the
    // scene does (see tailwind.css and boot.css).
    watch(tier, (t) => document.documentElement.classList.toggle("gfx-low", t !== "high"), {
      immediate: true,
    });
    watch(graphics, () => (level.value = 0));
    watch(level, (l) => {
      try {
        sessionStorage.setItem(LEVEL_KEY, String(l));
      } catch {
        /* blocked storage: the governor just finds its level again next time */
      }
    });
  }

  return {
    /** False when no WebGL2 context can be created: there is no scene to mount. */
    webgl: computed(() => gpu.value.webgl),
    software: computed(() => gpu.value.software),
    tier,
    dpr,
    renderScale,
    fps,
    sceneTexels: computed(() => settings.value.sceneTexels),
    sceneSamples: computed(() => settings.value.sceneSamples),
    antialias: computed(() => settings.value.antialias),
    density: computed(() => settings.value.density),
    level,
    adaptive,
    /** One rung down the ladder. Returns false at the bottom. */
    stepDown: () => {
      if (level.value >= MAX_LEVEL) return false;
      level.value++;
      return true;
    },
    /** Back up one rung: the governor undoing a step that bought nothing. */
    stepUp: () => {
      if (level.value > 0) level.value--;
    },
  };
};

// Built once and shared. In a detached scope: the window listeners and watchers
// above would otherwise belong to whichever component asked first, and stop
// updating for everyone else the moment it unmounted.
let shared: ReturnType<typeof build> | null = null;

export function useRenderQuality() {
  if (import.meta.client && !initialized) init();
  return (shared ??= effectScope(true).run(build)!);
}
