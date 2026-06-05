import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { gsap } from "gsap";
import type { CameraPose, TimelineChapter } from "~/types/timeline";

// Hero ASCII ramp — the cell/font size sweep that happens while the very first
// (identity) chapter is on screen. Matches the original hero feel.
const ASCII_CELL_START = 45;
const ASCII_CELL_END = 9;
const ASCII_FONT_START = 15;
const ASCII_FONT_END = 44;

// Set-piece reveal window: fraction of a chapter's scroll range used to fade a
// set-piece in (and, symmetrically, out) so it blooms while the chapter is centered.
const REVEAL_FADE = 0.25;

const lerp = (a: number, b: number, t: number) => gsap.utils.interpolate(a, b, t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (v: number) => v * v * (3 - 2 * v);

const FALLBACK_POSE: CameraPose = {
  position: { x: 0.06, y: 0.04, z: 0.51 },
  rotation: { x: -0.09, y: 0.13, z: 0.01 },
};

/**
 * Single source of truth for the scroll-driven 3D timeline.
 *
 * This store holds only *shared state* (issue #4): the current scroll `progress`
 * and the chapter config. It owns NO requestAnimationFrame loop — scroll is read
 * by a GSAP ScrollTrigger (see `useScrollTimeline`) which writes `progress`, and
 * the camera is mutated imperatively inside the TresJS render loop (see Scene3D).
 * The keyframe interpolation below is the single interpolator reused for the
 * camera, ASCII params and set-piece reveal.
 */
export const useTimelineStore = defineStore("timeline", () => {
  // Shared state
  const enabled = ref(true);
  const progress = ref(0); // 0..1 across the whole scroll
  const chapters = ref<TimelineChapter[]>([]);

  const setChapters = (next: TimelineChapter[]) => {
    chapters.value = next;
  };
  const setProgress = (p: number) => {
    progress.value = clamp01(p);
  };

  // Normalized cumulative boundaries derived from chapter weights — length n+1,
  // e.g. [0, 0.2, 0.45, …, 1]. boundaries[i]..boundaries[i+1] is chapter i's range.
  const boundaries = computed(() => {
    const weights = chapters.value.map((c) => c.weight || 1);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const result = [0];
    let acc = 0;
    for (const w of weights) {
      acc += w;
      result.push(acc / total);
    }
    return result;
  });

  // The progress value at the *center* of each chapter — the camera "anchor" the
  // camera arrives at while that chapter is centered on screen.
  const anchors = computed(() =>
    chapters.value.map((_, i) => (boundaries.value[i]! + boundaries.value[i + 1]!) / 2)
  );

  const activeIndex = computed(() => {
    const bs = boundaries.value;
    const p = progress.value;
    for (let i = 0; i < chapters.value.length; i++) {
      if (p >= bs[i]! && p < bs[i + 1]!) return i;
    }
    return Math.max(0, chapters.value.length - 1);
  });

  // Progress within the active chapter (0..1).
  const localProgress = computed(() => {
    const bs = boundaries.value;
    const i = activeIndex.value;
    const span = (bs[i + 1] ?? 1) - (bs[i] ?? 0) || 1;
    return clamp01((progress.value - (bs[i] ?? 0)) / span);
  });

  // Progress through the hero (chapter 0) — feeds the ASCII name assembly.
  const heroProgress = computed(() => {
    const end = boundaries.value[1] ?? 1;
    return clamp01(progress.value / (end || 1));
  });

  // ---- Single keyframe interpolator (camera) ----
  const cameraAt = (p: number): CameraPose => {
    const cs = chapters.value;
    if (!cs.length) return FALLBACK_POSE;
    const an = anchors.value;
    if (p <= an[0]!) return cs[0]!.camera;
    if (p >= an[an.length - 1]!) return cs[cs.length - 1]!.camera;

    let i = 0;
    for (; i < an.length - 1; i++) {
      if (p >= an[i]! && p <= an[i + 1]!) break;
    }
    const t0 = an[i]!;
    const t1 = an[i + 1]!;
    const raw = (p - t0) / (t1 - t0 || 1);
    const t = gsap.parseEase("power2.inOut")(raw); // smooth settle into each pose
    const a = cs[i]!.camera;
    const b = cs[i + 1]!.camera;
    return {
      position: {
        x: lerp(a.position.x, b.position.x, t),
        y: lerp(a.position.y, b.position.y, t),
        z: lerp(a.position.z, b.position.z, t),
      },
      rotation: {
        x: lerp(a.rotation.x, b.rotation.x, t),
        y: lerp(a.rotation.y, b.rotation.y, t),
        z: lerp(a.rotation.z, b.rotation.z, t),
      },
    };
  };

  // ASCII params as pure functions of progress (hero ramp, then locked at end).
  const asciiCellSize = computed(() =>
    Math.round(lerp(ASCII_CELL_START, ASCII_CELL_END, heroProgress.value))
  );
  const asciiFontSize = computed(() =>
    Math.round(lerp(ASCII_FONT_START, ASCII_FONT_END, heroProgress.value))
  );

  // Reveal (0..1) for the set-piece of chapter `index`: blooms in over the first
  // REVEAL_FADE of the chapter, holds, fades out over the last REVEAL_FADE.
  const revealFor = (index: number) => {
    const bs = boundaries.value;
    const start = bs[index] ?? 0;
    const end = bs[index + 1] ?? 1;
    const span = end - start || 1;
    const local = (progress.value - start) / span;
    const fadeIn = clamp01(local / REVEAL_FADE);
    const fadeOut = clamp01((1 - local) / REVEAL_FADE);
    return smoothstep(Math.max(0, Math.min(fadeIn, fadeOut)));
  };

  const enable = () => {
    enabled.value = true;
  };
  const disable = () => {
    enabled.value = false;
  };

  return {
    // state
    enabled,
    progress,
    chapters,
    // mutations
    setChapters,
    setProgress,
    enable,
    disable,
    // derived
    boundaries,
    anchors,
    activeIndex,
    localProgress,
    heroProgress,
    asciiCellSize,
    asciiFontSize,
    // helpers
    cameraAt,
    revealFor,
  };
});
