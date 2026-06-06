import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { gsap } from "gsap";
import type { CameraPose, Section } from "~/types/section";

// Hero ASCII ramp — the cell/font size sweep that happens while the very first
// (identity) section is on screen. Matches the original hero feel.
const ASCII_CELL_START = 45;
const ASCII_CELL_END = 9;
const ASCII_FONT_START = 15;
const ASCII_FONT_END = 44;

// Set-piece reveal window: fraction of a section's scroll range used to fade a
// set-piece in (and, symmetrically, out) so it blooms while the section is centered.
const REVEAL_FADE = 0.25;

const lerp = (a: number, b: number, t: number) => gsap.utils.interpolate(a, b, t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (v: number) => v * v * (3 - 2 * v);
const easeInOut = gsap.parseEase("power2.inOut"); // cached: camera settle

const FALLBACK_POSE: CameraPose = {
  position: { x: 0.06, y: 0.04, z: 0.51 },
  rotation: { x: -0.09, y: 0.13, z: 0.01 },
};

/**
 * Single source of truth for the scroll-driven 3D scene.
 *
 * This store holds only *shared state* (issue #4): the current scroll `progress`
 * and the section config. It owns NO requestAnimationFrame loop — scroll is read
 * by a GSAP ScrollTrigger (see `useScrollTimeline`) which writes `progress`, and
 * the camera is mutated imperatively inside the TresJS render loop (see Scene3D).
 * The keyframe interpolation below is the single interpolator reused for the
 * camera and set-piece reveal as the camera moves between sections.
 */
export const useSectionsStore = defineStore("sections", () => {
  // Shared state
  const enabled = ref(true);
  const progress = ref(0); // 0..1 across the whole scroll
  const sections = ref<Section[]>([]);

  const setSections = (next: Section[]) => {
    sections.value = next;
  };
  const setProgress = (p: number) => {
    progress.value = clamp01(p);
  };

  // Normalized cumulative boundaries derived from section weights — length n+1,
  // e.g. [0, 0.2, 0.45, …, 1]. boundaries[i]..boundaries[i+1] is section i's range.
  const boundaries = computed(() => {
    const weights = sections.value.map((s) => s.weight || 1);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const result = [0];
    let acc = 0;
    for (const w of weights) {
      acc += w;
      result.push(acc / total);
    }
    return result;
  });

  // The progress value at the *center* of each section — the camera "anchor" the
  // camera arrives at while that section is centered on screen.
  const anchors = computed(() =>
    sections.value.map((_, i) => (boundaries.value[i]! + boundaries.value[i + 1]!) / 2)
  );

  const activeIndex = computed(() => {
    const bs = boundaries.value;
    const p = progress.value;
    for (let i = 0; i < sections.value.length; i++) {
      if (p >= bs[i]! && p < bs[i + 1]!) return i;
    }
    return Math.max(0, sections.value.length - 1);
  });

  // Progress within the active section (0..1).
  const localProgress = computed(() => {
    const bs = boundaries.value;
    const i = activeIndex.value;
    const span = (bs[i + 1] ?? 1) - (bs[i] ?? 0) || 1;
    return clamp01((progress.value - (bs[i] ?? 0)) / span);
  });

  // Progress through the hero (section 0) — feeds the ASCII name assembly.
  const heroProgress = computed(() => {
    const end = boundaries.value[1] ?? 1;
    return clamp01(progress.value / (end || 1));
  });

  // ---- Single keyframe interpolator (camera) ----
  // Reused scratch pose so the per-frame camera read in the render loop allocates
  // nothing (issue #4). Callers must apply it immediately and not retain it.
  const scratchPose: CameraPose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  };
  const copyPose = (from: CameraPose): CameraPose => {
    scratchPose.position.x = from.position.x;
    scratchPose.position.y = from.position.y;
    scratchPose.position.z = from.position.z;
    scratchPose.rotation.x = from.rotation.x;
    scratchPose.rotation.y = from.rotation.y;
    scratchPose.rotation.z = from.rotation.z;
    return scratchPose;
  };

  const cameraAt = (p: number): CameraPose => {
    const cs = sections.value;
    if (!cs.length) return copyPose(FALLBACK_POSE);
    const an = anchors.value;
    if (p <= an[0]!) return copyPose(cs[0]!.camera);
    if (p >= an[an.length - 1]!) return copyPose(cs[cs.length - 1]!.camera);

    let i = 0;
    for (; i < an.length - 1; i++) {
      if (p >= an[i]! && p <= an[i + 1]!) break;
    }
    const t0 = an[i]!;
    const t1 = an[i + 1]!;
    const raw = (p - t0) / (t1 - t0 || 1);
    const t = easeInOut(raw); // smooth settle into each pose
    const a = cs[i]!.camera;
    const b = cs[i + 1]!.camera;
    scratchPose.position.x = lerp(a.position.x, b.position.x, t);
    scratchPose.position.y = lerp(a.position.y, b.position.y, t);
    scratchPose.position.z = lerp(a.position.z, b.position.z, t);
    scratchPose.rotation.x = lerp(a.rotation.x, b.rotation.x, t);
    scratchPose.rotation.y = lerp(a.rotation.y, b.rotation.y, t);
    scratchPose.rotation.z = lerp(a.rotation.z, b.rotation.z, t);
    return scratchPose;
  };

  // ASCII params as pure functions of progress (hero ramp, then locked at end).
  const asciiCellSize = computed(() =>
    Math.round(lerp(ASCII_CELL_START, ASCII_CELL_END, heroProgress.value))
  );
  const asciiFontSize = computed(() =>
    Math.round(lerp(ASCII_FONT_START, ASCII_FONT_END, heroProgress.value))
  );

  // Reveal (0..1) for the set-piece of section `index`: blooms in over the first
  // REVEAL_FADE of the section, holds, fades out over the last REVEAL_FADE.
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

  // Reveal (0..1) for sub-beat `subIndex` of `subCount` *within* section `index`
  // — used for the biography milestones' individual line backdrops, which bloom
  // one after another as you scroll through the (single) biography section.
  const subReveal = (index: number, subIndex: number, subCount: number) => {
    const bs = boundaries.value;
    const start = bs[index] ?? 0;
    const end = bs[index + 1] ?? 1;
    const span = (end - start) / (subCount || 1);
    const subStart = start + subIndex * span;
    const local = (progress.value - subStart) / (span || 1);
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
    sections,
    // mutations
    setSections,
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
    subReveal,
  };
});
