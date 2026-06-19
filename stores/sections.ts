import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { gsap } from "gsap";
import type { CameraKeyframe, CameraPose, Section, Vec3 } from "~/types/section";

// Hero ASCII ramp — the cell/font size sweep that happens while the very first
// (identity) section is on screen. Matches the original hero feel.
const ASCII_CELL_START = 45;
const ASCII_CELL_END = 9;
const ASCII_FONT_START = 15;
const ASCII_FONT_END = 44;

// Set-piece reveal window: fraction of a section's scroll range used to fade a
// set-piece in (and, symmetrically, out) so it blooms while the section is centered.
const REVEAL_FADE = 0.25;

// Vertical layout of the biography milestone cluster, shared by BiographySection
// (where it places the cards/nodes/connector) and `subReveal` below (where each
// milestone's set-piece blooms). Sharing one formula keeps the 3D backdrop
// aligned with its card even after the headline spacing was added. Values are
// fractions of the (tall) biography section.
export const BIO_TOP_PAD = 0.13; // clear space under the sticky headline
export const BIO_RANGE = 0.83; // vertical span the cluster occupies
export const bioMilestoneCenter = (j: number, n: number) =>
  BIO_TOP_PAD + ((j + 0.6) / (n + 0.2)) * BIO_RANGE;
export const bioMilestoneHalfWindow = (n: number) =>
  (BIO_RANGE / (n + 0.2)) * 0.5;

const lerp = (a: number, b: number, t: number) => gsap.utils.interpolate(a, b, t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (v: number) => v * v * (3 - 2 * v);
const easeInOut = gsap.parseEase("power2.inOut"); // cached: camera settle

const FALLBACK_POSE: CameraPose = {
  position: { x: 0.06, y: 0.04, z: 0.51 },
  rotation: { x: -0.09, y: 0.13, z: 0.01 },
};

// The head's default resting pose when a section has no head keyframes: no
// translation, looking into its own data (the shipped resting yaw). Seeds the
// editable head keyframes so the head reads exactly as before until tuned.
const DEFAULT_HEAD_YAW = -0.44;
const HEAD_REST_POSE = {
  t: 0.5,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: DEFAULT_HEAD_YAW, z: 0 },
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

  // A one-shot "signal sent" pulse. The contact CLI bumps this on each command;
  // the finale SignalField edge-detects the change and fires a bright ring that
  // converges on the head — the transmission the visitor just sent, received.
  const pulseSeq = ref(0);
  const emitPulse = () => {
    pulseSeq.value++;
  };

  // Screen-space anchor (NDC, -1..1) of the contact terminal card, published by
  // ContactSection (via useElementBounding). SignalField projects it into 3D so
  // the finale's signal emits from the card's real on-screen position
  // (viewport/scroll-aware) instead of a fixed world point. null when unmounted.
  const contactAnchor = ref<{ x: number; y: number } | null>(null);
  const setContactAnchor = (a: { x: number; y: number } | null) => {
    contactAnchor.value = a;
  };

  // Biography card count (synced from the @nuxt/content collection, see
  // SceneSetPieces). Feeds milestone-anchored keyframes (camera + spotlights).
  const milestoneCount = ref(0);

  // Editable camera keyframes per section id (the live, dev-panel-editable copy,
  // seeded from the registry spine). The registry values stay the read-only
  // source of truth on `sections` (so "reset" can return to them); cameraTrack
  // reads THIS map, so edits in the scenes tab move the camera live. Like the
  // spotlights, edits aren't persisted — they reset on reload.
  const cloneKfs = (kfs: CameraKeyframe[]): CameraKeyframe[] =>
    kfs.map((k) => ({
      t: k.t ?? 0.5,
      milestone: k.milestone,
      position: { x: k.position.x, y: k.position.y, z: k.position.z },
      rotation: { x: k.rotation.x, y: k.rotation.y, z: k.rotation.z },
    }));

  const cameraKeyframes = ref<Record<string, CameraKeyframe[]>>({});
  const seedCameraKf = (s: Section): CameraKeyframe[] =>
    cloneKfs(
      s.cameraKeyframes && s.cameraKeyframes.length
        ? s.cameraKeyframes
        : [{ t: 0.5, position: s.camera.position, rotation: s.camera.rotation }]
    );

  // Editable head keyframes (position offset + rotation), same model as the
  // camera. Default: a single resting pose (no translation, resting yaw), so the
  // head reads exactly as before until a scene's keyframes are tuned.
  const headKeyframes = ref<Record<string, CameraKeyframe[]>>({});
  const seedHeadKf = (s: Section): CameraKeyframe[] =>
    cloneKfs(s.headKeyframes && s.headKeyframes.length ? s.headKeyframes : [HEAD_REST_POSE]);

  const setSections = (next: Section[]) => {
    sections.value = next;
    // Seed editable camera/head keyframes for any section we haven't seen (don't
    // clobber in-session edits if this re-runs, e.g. on HMR).
    for (const s of next) {
      if (!cameraKeyframes.value[s.id]) cameraKeyframes.value[s.id] = seedCameraKf(s);
      if (!headKeyframes.value[s.id]) headKeyframes.value[s.id] = seedHeadKf(s);
    }
  };
  const setProgress = (p: number) => {
    progress.value = clamp01(p);
  };
  const setMilestoneCount = (n: number) => {
    milestoneCount.value = Math.max(0, Math.floor(n) || 0);
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

  // ---- Anchored-keyframe resolver (shared by camera + spotlights) ----
  // Resolve a (section, local t, optional milestone) anchor to absolute scroll
  // progress, derived from the live layout — so a keyframe rides its section even
  // as sections are inserted/reordered/reweighted (and biography keyframes ride
  // their card as cards are added/removed). This is why the camera never breaks
  // on a section insert; spotlights now share the exact same model.
  const resolveAtIndex = (i: number, t = 0.5, milestone?: number | null): number => {
    const b = boundaries.value;
    if (i < 0 || b.length < 2) return clamp01(t); // unknown section → treat t as absolute
    const start = b[i]!;
    const span = (b[i + 1]! - start) || 1;
    const tt = clamp01(t);
    if (milestone != null && sections.value[i]?.type === "biography") {
      const n = milestoneCount.value || 1;
      // A milestone index past the current card count lands on the LAST card
      // (graceful when cards are removed) rather than off the end of the section.
      const j = Math.max(0, Math.min(milestone, n - 1));
      const center = bioMilestoneCenter(j, n);
      const half = bioMilestoneHalfWindow(n);
      return start + clamp01(center + (tt - 0.5) * 2 * half) * span;
    }
    return start + tt * span;
  };
  const resolveAt = (a: { section: string; t?: number; milestone?: number }): number =>
    resolveAtIndex(
      sections.value.findIndex((s) => s.id === a.section),
      a.t,
      a.milestone
    );

  // Inverse: which section (+ biography card) + local t does an absolute progress
  // fall in? Used by the dev panel to capture a keyframe at the current scroll.
  // Right-exclusive on internal boundaries (inclusive only on the last segment so
  // p===1 resolves) — matches activeIndex, so a value on a boundary maps to the
  // same section the rest of the store treats as active. Inside biography it picks
  // the nearest card and expresses `t` within that card's window, so the result
  // round-trips through resolveAt.
  const anchorAt = (p: number): { section: string; t: number; milestone?: number } => {
    const b = boundaries.value;
    const list = sections.value;
    for (let i = 0; i < list.length; i++) {
      const last = i === list.length - 1;
      if (p >= b[i]! && (last ? p <= b[i + 1]! : p < b[i + 1]!)) {
        const start = b[i]!;
        const span = (b[i + 1]! - start) || 1;
        const localFrac = clamp01((p - start) / span);
        if (list[i]!.type === "biography" && milestoneCount.value > 0) {
          const n = milestoneCount.value;
          let j = 0;
          let bestD = Infinity;
          for (let k = 0; k < n; k++) {
            const d = Math.abs(bioMilestoneCenter(k, n) - localFrac);
            if (d < bestD) {
              bestD = d;
              j = k;
            }
          }
          const center = bioMilestoneCenter(j, n);
          const half = bioMilestoneHalfWindow(n) || 0.0001;
          return { section: list[i]!.id, t: clamp01(0.5 + (localFrac - center) / (2 * half)), milestone: j };
        }
        return { section: list[i]!.id, t: localFrac };
      }
    }
    return { section: list[list.length - 1]?.id ?? "", t: 1 };
  };

  // ---- Biography "position in section" <-> (card, within-card t) transform ----
  // The biography scene's keyframes anchor to a card (milestone) for resilience,
  // but the dev panel edits a single "position across the section" value (so it
  // matches the scroll). These convert between them.
  // forward: (card, within-card t) -> section-local fraction 0..1. A keyframe with
  // NO milestone is a whole-section anchor (matching resolveAt), so its `t` already
  // IS the section fraction — don't window it into a card.
  const bioFrac = (milestone: number | undefined, t: number | undefined): number => {
    const tt = clamp01(t ?? 0.5);
    if (milestone == null) return tt;
    const n = milestoneCount.value || 1;
    const j = Math.max(0, Math.min(milestone, n - 1));
    return clamp01(bioMilestoneCenter(j, n) + (tt - 0.5) * 2 * bioMilestoneHalfWindow(n));
  };
  // inverse: section-local fraction -> nearest card + within-card t (so it rides
  // that card as cards are added/removed).
  const bioAnchorFromFrac = (frac: number): { milestone: number; t: number } => {
    const n = milestoneCount.value || 1;
    let j = 0;
    let bestD = Infinity;
    for (let k = 0; k < n; k++) {
      const d = Math.abs(bioMilestoneCenter(k, n) - frac);
      if (d < bestD) {
        bestD = d;
        j = k;
      }
    }
    const half = bioMilestoneHalfWindow(n) || 0.0001;
    return { milestone: j, t: clamp01(0.5 + (frac - bioMilestoneCenter(j, n)) / (2 * half)) };
  };
  // The 0..1 position within a section the current scroll sits at (0.5 if the
  // scroll is outside it) — for "add keyframe at the current scroll".
  const localFracAt = (sectionId: string, p: number): number => {
    const i = sections.value.findIndex((s) => s.id === sectionId);
    const b = boundaries.value;
    if (i < 0 || b.length < 2) return 0.5;
    if (p >= b[i]! && p <= b[i + 1]!) return clamp01((p - b[i]!) / ((b[i + 1]! - b[i]!) || 1));
    return 0.5;
  };

  // ---- Anchored pose track (shared by camera + head) ----
  // Reused scratch poses so the per-frame reads in the render loop allocate
  // nothing (issue #4); camera + head get separate scratch so they don't clobber.
  const scratchPose: CameraPose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  const scratchHeadPose: CameraPose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  const copyPoseInto = (from: { position: Vec3; rotation: Vec3 }, scratch: CameraPose): CameraPose => {
    scratch.position.x = from.position.x;
    scratch.position.y = from.position.y;
    scratch.position.z = from.position.z;
    scratch.rotation.x = from.rotation.x;
    scratch.rotation.y = from.rotation.y;
    scratch.rotation.z = from.rotation.z;
    return scratch;
  };

  // Build an anchored-keyframe TRACK for a pose map: each section contributes one
  // keyframe at its centre (t:0.5) by default, or its edited keyframes when set.
  // Each is resolved to absolute progress and sorted. With one pose per section
  // this is identical to the old centre-to-centre interpolation; with several it
  // flows through them. Recomputes only when the layout/poses change — never per
  // frame. position/rotation are kept as live REFERENCES (not copied): the
  // computed only reads k.t/k.milestone (for `at`), so a position/rotation slider
  // edit does NOT recompute it — but the per-frame sampler reads these refs every
  // frame, so the camera/head still update live (zero per-frame allocation).
  type PoseEntry = { at: number; position: Vec3; rotation: Vec3 };
  const buildPoseTrack = (
    map: Record<string, CameraKeyframe[]>,
    fallback: (s: Section) => CameraKeyframe
  ): PoseEntry[] => {
    const out: PoseEntry[] = [];
    sections.value.forEach((s, i) => {
      const edited = map[s.id];
      const kfs = edited && edited.length ? edited : [fallback(s)];
      for (const k of kfs) {
        out.push({ at: resolveAtIndex(i, k.t, k.milestone), position: k.position, rotation: k.rotation });
      }
    });
    out.sort((a, b) => a.at - b.at);
    return out;
  };
  const cameraTrack = computed<PoseEntry[]>(() =>
    buildPoseTrack(cameraKeyframes.value, (s) => ({
      t: 0.5,
      position: s.camera.position,
      rotation: s.camera.rotation,
    }))
  );
  const headTrack = computed<PoseEntry[]>(() =>
    buildPoseTrack(headKeyframes.value, () => HEAD_REST_POSE)
  );

  // Sample a pose track at progress p into `scratch` (eased, allocation-free).
  const samplePose = (tr: PoseEntry[], p: number, scratch: CameraPose): CameraPose => {
    if (!tr.length) return copyPoseInto(FALLBACK_POSE, scratch);
    if (p <= tr[0]!.at) return copyPoseInto(tr[0]!, scratch);
    if (p >= tr[tr.length - 1]!.at) return copyPoseInto(tr[tr.length - 1]!, scratch);
    let i = 0;
    for (; i < tr.length - 1; i++) {
      if (p >= tr[i]!.at && p <= tr[i + 1]!.at) break;
    }
    const raw = (p - tr[i]!.at) / (tr[i + 1]!.at - tr[i]!.at || 1);
    const t = easeInOut(raw); // smooth settle into each pose
    const a = tr[i]!;
    const b = tr[i + 1]!;
    scratch.position.x = lerp(a.position.x, b.position.x, t);
    scratch.position.y = lerp(a.position.y, b.position.y, t);
    scratch.position.z = lerp(a.position.z, b.position.z, t);
    scratch.rotation.x = lerp(a.rotation.x, b.rotation.x, t);
    scratch.rotation.y = lerp(a.rotation.y, b.rotation.y, t);
    scratch.rotation.z = lerp(a.rotation.z, b.rotation.z, t);
    return scratch;
  };

  const cameraAt = (p: number): CameraPose => samplePose(cameraTrack.value, p, scratchPose);
  // Head base pose (position offset + rotation). Scene3D blends this rotation with
  // the finale "addressing" turn + cursor parallax; the position drives the head.
  const headAt = (p: number): CameraPose => samplePose(headTrack.value, p, scratchHeadPose);

  // Camera + head keyframe editing (dev panel, scenes tab). Mutate the editable
  // map; the track computed (hence camera/headAt) reacts, so the scene updates live.
  const addPoseKeyframe = (
    map: Record<string, CameraKeyframe[]>,
    sectionId: string,
    kf: CameraKeyframe
  ) => {
    (map[sectionId] ??= []).push({
      t: kf.t ?? 0.5,
      milestone: kf.milestone,
      position: { x: kf.position.x, y: kf.position.y, z: kf.position.z },
      rotation: { x: kf.rotation.x, y: kf.rotation.y, z: kf.rotation.z },
    });
  };
  const removePoseKeyframe = (map: Record<string, CameraKeyframe[]>, sectionId: string, index: number) => {
    const arr = map[sectionId];
    if (arr && arr.length > 1) arr.splice(index, 1);
  };

  const addCameraKeyframe = (sectionId: string, kf: CameraKeyframe) =>
    addPoseKeyframe(cameraKeyframes.value, sectionId, kf);
  const removeCameraKeyframe = (sectionId: string, index: number) =>
    removePoseKeyframe(cameraKeyframes.value, sectionId, index);
  const resetCameraKeyframes = (sectionId: string) => {
    const s = sections.value.find((x) => x.id === sectionId);
    if (s) cameraKeyframes.value[sectionId] = seedCameraKf(s);
  };
  const exportCameraKeyframes = (sectionId: string) =>
    JSON.stringify(cameraKeyframes.value[sectionId] ?? [], null, 2);

  const addHeadKeyframe = (sectionId: string, kf: CameraKeyframe) =>
    addPoseKeyframe(headKeyframes.value, sectionId, kf);
  const removeHeadKeyframe = (sectionId: string, index: number) =>
    removePoseKeyframe(headKeyframes.value, sectionId, index);
  const resetHeadKeyframes = (sectionId: string) => {
    const s = sections.value.find((x) => x.id === sectionId);
    if (s) headKeyframes.value[sectionId] = seedHeadKf(s);
  };
  const exportHeadKeyframes = (sectionId: string) =>
    JSON.stringify(headKeyframes.value[sectionId] ?? [], null, 2);

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
    // The final section has nothing after it — hold its set-piece once revealed
    // (don't fade it back out as the page bottoms out, so the finale's signal
    // keeps pulsing while the visitor reads/interacts with the contact card).
    const isLast = index >= sections.value.length - 1;
    const fadeOut = isLast ? 1 : clamp01((1 - local) / REVEAL_FADE);
    return smoothstep(Math.max(0, Math.min(fadeIn, fadeOut)));
  };

  // Reveal (0..1) for sub-beat `subIndex` of `subCount` *within* section `index`
  // — used for the biography milestones' individual line backdrops, which bloom
  // one after another as you scroll through the (single) biography section.
  const subReveal = (index: number, subIndex: number, subCount: number) => {
    const bs = boundaries.value;
    const start = bs[index] ?? 0;
    const end = bs[index + 1] ?? 1;
    const range = end - start || 1;
    // Bloom centered on the milestone card's position (same layout the cards
    // use) so the set-piece tracks its card, not an evenly-divided sub-beat.
    const center = start + bioMilestoneCenter(subIndex, subCount) * range;
    const half = (bioMilestoneHalfWindow(subCount) || 0.0001) * range;
    const local = (progress.value - (center - half)) / (2 * half);
    const fadeIn = clamp01(local / REVEAL_FADE);
    const fadeOut = clamp01((1 - local) / REVEAL_FADE);
    return smoothstep(Math.max(0, Math.min(fadeIn, fadeOut)));
  };

  // How strongly the head should "address" the visitor (0..1). Zero everywhere
  // except the final section when it is the contact beat, where it ramps to 1
  // over the first 60% of the section's scroll range. Scene3D reads this in its
  // render loop to swing the head from its resting profile to facing — and then
  // tracking — the cursor (the deliberate end-of-page beat), imperatively, with
  // no extra rAF or layout read (issue #4).
  const addressing = computed(() => {
    const n = sections.value.length;
    if (!n || sections.value[n - 1]?.type !== "contact") return 0;
    const bs = boundaries.value;
    const start = bs[n - 1] ?? 0;
    const end = bs[n] ?? 1;
    const local = (progress.value - start) / (end - start || 1);
    return smoothstep(clamp01(local / 0.6));
  });

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
    milestoneCount,
    cameraKeyframes,
    headKeyframes,
    pulseSeq,
    contactAnchor,
    // mutations
    setSections,
    setProgress,
    setMilestoneCount,
    addCameraKeyframe,
    removeCameraKeyframe,
    resetCameraKeyframes,
    exportCameraKeyframes,
    addHeadKeyframe,
    removeHeadKeyframe,
    resetHeadKeyframes,
    exportHeadKeyframes,
    emitPulse,
    setContactAnchor,
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
    addressing,
    // helpers
    cameraAt,
    headAt,
    resolveAt,
    anchorAt,
    bioFrac,
    bioAnchorFromFrac,
    localFracAt,
    revealFor,
    subReveal,
  };
});
