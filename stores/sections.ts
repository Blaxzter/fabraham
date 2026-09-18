import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { gsap } from "gsap";
import type {
  CameraKeyframe,
  CameraPose,
  HeadKeyframe,
  Section,
  Vec3,
} from "~/types/section";

/** A sampled pose: the interpolated camera/head transform, plus the head's fade
 *  (always 1 for the camera, which has no such concept). */
export interface SampledPose extends CameraPose {
  opacity: number;
}

// The face's ASCII ramp — the cell/font size sweep that resolves the head from
// abstract blocks into a face.
//
// The CELL endpoints are the defaults for `asciiCellStart` / `asciiCellEnd`
// below, not the values themselves: that coarse→fine sweep is art direction
// rather than a constant. HeroAscii.vue registers both ends as tunables (dev
// panel → scenes) and writes them here, so they can be dialled against the live
// scene and saved to tuning.config.json.
const ASCII_CELL_START = 45;
const ASCII_CELL_END = 9;
const ASCII_FONT_START = 15;
const ASCII_FONT_END = 44;

/**
 * WHICH section the sweep runs across — and it is not the hero.
 *
 * It used to be a window inside the hero, and that was always one beat too many
 * for one section. The hero has to assemble a name out of a scattered field, and
 * the name is not readable until it is finished; the face resolving underneath it
 * competes for exactly the attention the name is asking for. Every attempt to fix
 * that by moving the window inside the hero trades one collision for another —
 * start it earlier and it fights the assembly, start it later and it has no room
 * to run before the hero is over.
 *
 * So the two beats get a section each. The hero is the NAME: the field stays
 * coarse and unreadable from top to bottom, and the only thing resolving is the
 * letters. The section after it is the FACE: the camera pulls back, the grid
 * resolves, and the key light kicks on part-way through (`spotlights.ts` already
 * put the "tada" here — the light half of this reveal has always lived in this
 * section; only the grid was somewhere else).
 *
 * `asciiRampStart`/`End` are now fractions of THAT section rather than of the
 * hero. Before it the ramp reads 0 (coarse), after it 1 (resolved), because the
 * section-local progress is clamped at both ends.
 */
const ASCII_RAMP_SECTION = "reveal";
const ASCII_RAMP_START = 0.1;
const ASCII_RAMP_END = 0.75;

// Set-piece reveal window: fraction of a section's scroll range used to fade a
// set-piece in (and, symmetrically, out) so it blooms while the section is centered.
const REVEAL_FADE = 0.25;
// The hand-off a HOLDING set-piece gets instead of that trailing fade (see
// `revealFor`): it runs at full strength to the very end of its own section and
// then clears across the boundary, in this fraction of its OWN span. Short on
// purpose — this is a piece leaving the stage for the next beat, not a slow
// dissolve, and at REVEAL_FADE it was still visible a third of the way into the
// section that follows.
const HANDOFF_FADE = 0.12;

// The finale's two hand-overs, both fractions of the CODA's scroll range (the
// section after contact), so they read as one swap rather than as two unrelated
// fades. See `tracking` and `orbiting` below.
//
// The release is the shorter of the two on purpose: the fly should be gone
// before the system that replaces it is fully up, or the coda spends its first
// screen with a burning ember and five planets competing for the same face.
const TRACK_RELEASE = 0.3;
/**
 * Where the planets are fully up — and, because the spotlight spine imports it,
 * where the scroll rig has finished getting out of their way.
 *
 * Exported for exactly that: `components/home/sections/spotlights.ts` anchors the
 * coda keyframes that fade the finale's green key/fill/rim down to a neutral
 * floor at this same `t`, so the two halves of the swap cannot drift apart. Move
 * this and the rig moves with it.
 */
export const ORBIT_RISE = 0.45;

// Vertical layout of the biography milestone cluster, shared by BiographySection
// (where it places the cards/nodes/connector) and `subReveal` below (where each
// milestone's set-piece blooms). Sharing one formula keeps the 3D backdrop
// aligned with its card even after the headline spacing was added. Values are
// fractions of the (tall) biography section.
// Where the cluster sits inside its (tall) section. Both are fractions of the
// section, so they hold their shape at any `weight` — but the LEAD-IN is real
// scroll: at weight 7 the old 0.13 pad meant a full viewport of headline and
// bare connector before the first card arrived. Trimmed to 0.08 and the range
// widened to match, so the extra height the reweight bought goes into the gaps
// BETWEEN cards rather than into dead air at either end.
export const BIO_TOP_PAD = 0.08; // clear space under the sticky headline
export const BIO_RANGE = 0.88; // vertical span the cluster occupies
export const bioMilestoneCenter = (j: number, n: number) =>
  BIO_TOP_PAD + ((j + 0.6) / (n + 0.2)) * BIO_RANGE;
/**
 * Half a milestone's ANCHOR window: the span a milestone-pinned keyframe's local
 * `t` (0..1) is resolved across. Exactly half the spacing, so consecutive
 * windows tile without overlapping — which they must not do, because the head's
 * generated gaze track samples the middle `GAZE_TRACK` of each one and the
 * combined track has to stay sorted in `t` (see sections/biography.ts).
 */
export const bioMilestoneHalfWindow = (n: number) =>
  (BIO_RANGE / (n + 0.2)) * 0.5;

/**
 * How much wider a milestone's SET-PIECE window is than its anchor window.
 *
 * These were the same number until the chapter was stretched (weight 4 → 7).
 * Tiling exactly means a backdrop's bloom reaches zero at precisely the point
 * the next one starts from zero, so there is an instant where NEITHER is drawn.
 * At the old spacing that instant was ~480px of scroll and passed unnoticed; at
 * the new one it is a near-empty viewport, which is the opposite of the reason
 * the chapter was stretched in the first place.
 *
 * 1.35 overlaps the windows by about a third of a spacing: between two cards
 * both neighbours sit around half lit, so the frame is never empty and neither
 * piece dominates. Pushing it higher hands the gap over to a full double
 * exposure — and the two busiest milestones carry TWO set-pieces each, so 1.5
 * already put four motifs on screen at once. It also hands each piece a third
 * more scroll to assemble across, so the draw-on finishes just after its card
 * passes centre and then HOLDS while the card drifts away, which is when there
 * is finally room to look at it.
 *
 * Kept separate from the anchor window on purpose: widening that one would
 * squeeze the gap the head swings across between cards from 40% of a spacing to
 * 10%, and the swerve would snap instead of swing.
 */
export const BIO_PIECE_SPAN = 1.35;
export const bioMilestonePieceHalfWindow = (n: number) =>
  bioMilestoneHalfWindow(n) * BIO_PIECE_SPAN;

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
// The head's resting yaw, in FACE-ON SPACE: 0 is looking straight down the lens,
// positive is screen-right. So this is a slight turn to the right — the
// three-quarter resting profile. The model's own crookedness is corrected once in
// Scene3D (`faceYaw`) and is not this file's problem.
const DEFAULT_HEAD_YAW = 0.28;
const HEAD_REST_POSE: HeadKeyframe = {
  t: 0.5,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: DEFAULT_HEAD_YAW, z: 0 },
  opacity: 1,
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
  // Spread first so keyframe-kind extras (the head's `opacity`) survive the
  // clone, then deep-copy the vectors so panel edits never touch the registry.
  const cloneKfs = <T extends CameraKeyframe>(kfs: T[]): T[] =>
    kfs.map((k) => ({
      ...k,
      t: k.t ?? 0.5,
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
  const headKeyframes = ref<Record<string, HeadKeyframe[]>>({});
  // Tracks GENERATED at runtime (the biography gaze — see
  // components/home/sections/biography.ts, written via `setHeadKeyframes`). They
  // can't live on the registry spine because they derive from content that only
  // exists at runtime, so they act as that section's baseline instead: "reset" in
  // the dev panel restores the generated track, not the bare resting pose.
  const generatedHeadKeyframes = ref<Record<string, HeadKeyframe[]>>({});
  const seedHeadKf = (s: Section): HeadKeyframe[] => {
    const gen = generatedHeadKeyframes.value[s.id];
    if (gen && gen.length) return cloneKfs<HeadKeyframe>(gen);
    return cloneKfs<HeadKeyframe>(
      s.headKeyframes && s.headKeyframes.length ? s.headKeyframes : [HEAD_REST_POSE]
    );
  };

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

  /**
   * Progress through a named section, 0..1, clamped outside it.
   *
   * Clamped is the useful part: a beat anchored to a section reads 0 everywhere
   * before it and 1 everywhere after, so a sweep driven by this holds both of its
   * endpoints for the whole rest of the page without anyone writing that down. It
   * takes an id rather than an index so it survives sections being inserted or
   * reordered, the same reasoning as the anchored keyframes below.
   */
  const progressInSection = (id: string) => {
    const i = sections.value.findIndex((s) => s.id === id);
    if (i < 0) return 0;
    const b = boundaries.value;
    const start = b[i] ?? 0;
    const span = (b[i + 1] ?? 1) - start || 1;
    return clamp01((progress.value - start) / span);
  };

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
  const scratchPose: SampledPose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, opacity: 1 };
  const scratchHeadPose: SampledPose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, opacity: 1 };
  const copyPoseInto = (
    from: { position: Vec3; rotation: Vec3; opacity?: number },
    scratch: SampledPose
  ): SampledPose => {
    scratch.position.x = from.position.x;
    scratch.position.y = from.position.y;
    scratch.position.z = from.position.z;
    scratch.rotation.x = from.rotation.x;
    scratch.rotation.y = from.rotation.y;
    scratch.rotation.z = from.rotation.z;
    scratch.opacity = from.opacity ?? 1;
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
  type PoseEntry = { at: number; position: Vec3; rotation: Vec3; opacity: number };
  const buildPoseTrack = (
    map: Record<string, HeadKeyframe[]>,
    fallback: (s: Section) => HeadKeyframe
  ): PoseEntry[] => {
    const out: PoseEntry[] = [];
    sections.value.forEach((s, i) => {
      const edited = map[s.id];
      const kfs = edited && edited.length ? edited : [fallback(s)];
      for (const k of kfs) {
        out.push({
          at: resolveAtIndex(i, k.t, k.milestone),
          position: k.position,
          rotation: k.rotation,
          // Absent on camera keyframes, and on head keyframes that don't fade.
          opacity: k.opacity ?? 1,
        });
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
  const samplePose = (tr: PoseEntry[], p: number, scratch: SampledPose): SampledPose => {
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
    // Linear, NOT eased: a fade wants a straight ramp, and easing it would make
    // the head linger at the edges of its own cut.
    scratch.opacity = lerp(a.opacity, b.opacity, raw);
    return scratch;
  };

  const cameraAt = (p: number): SampledPose => samplePose(cameraTrack.value, p, scratchPose);
  // Head base pose (position offset + rotation + fade). Scene3D blends this
  // rotation with the finale "addressing" turn + cursor parallax, applies the
  // position, and drives the head's material opacity from `opacity`.
  const headAt = (p: number): SampledPose => samplePose(headTrack.value, p, scratchHeadPose);

  // Camera + head keyframe editing (dev panel, scenes tab). Mutate the editable
  // map; the track computed (hence camera/headAt) reacts, so the scene updates live.
  const addPoseKeyframe = (
    map: Record<string, HeadKeyframe[]>,
    sectionId: string,
    kf: HeadKeyframe
  ) => {
    (map[sectionId] ??= []).push({
      ...kf,
      t: kf.t ?? 0.5,
      position: { x: kf.position.x, y: kf.position.y, z: kf.position.z },
      rotation: { x: kf.rotation.x, y: kf.rotation.y, z: kf.rotation.z },
    });
  };
  const removePoseKeyframe = (map: Record<string, HeadKeyframe[]>, sectionId: string, index: number) => {
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

  // Replace a section's whole head track. Used by the runtime GENERATORS (the
  // biography gaze, derived from the loaded milestones — see
  // `useBiographyChoreography`), which is why it also records the track as that
  // section's reset baseline. The caller is responsible for calling this only when
  // its inputs actually changed: it overwrites, so calling it every tick would
  // wipe live dev-panel edits.
  const setHeadKeyframes = (sectionId: string, kfs: HeadKeyframe[]) => {
    generatedHeadKeyframes.value[sectionId] = cloneKfs<HeadKeyframe>(kfs);
    headKeyframes.value[sectionId] = cloneKfs<HeadKeyframe>(kfs);
  };

  const addHeadKeyframe = (sectionId: string, kf: HeadKeyframe) =>
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
  // The endpoints are live (see the note on the constants above); the ramp
  // between them stays here, because this store owns scroll.
  const asciiCellStart = ref(ASCII_CELL_START);
  const asciiCellEnd = ref(ASCII_CELL_END);
  const asciiRampStart = ref(ASCII_RAMP_START);
  const asciiRampEnd = ref(ASCII_RAMP_END);

  /** How far into the reveal section the face's sweep is allowed to look. Named
   *  so the one place that decides WHERE the reveal lives is the constant. */
  const revealProgress = computed(() => progressInSection(ASCII_RAMP_SECTION));

  /** Where the face is within its own sweep: 0 = coarse, 1 = fully resolved.
   *  Smoothstepped, so starting the window late doesn't snap into motion. */
  const asciiRamp = computed(() => {
    const from = asciiRampStart.value;
    const span = asciiRampEnd.value - from || 1;
    return smoothstep(clamp01((revealProgress.value - from) / span));
  });

  const asciiCellSize = computed(() =>
    Math.round(lerp(asciiCellStart.value, asciiCellEnd.value, asciiRamp.value))
  );
  // Follows the same window: the glyph inside a cell growing while the cell
  // itself is held would read as the grid breathing rather than resolving.
  const asciiFontSize = computed(() =>
    Math.round(lerp(ASCII_FONT_START, ASCII_FONT_END, asciiRamp.value))
  );

  // Reveal (0..1) for the set-piece of section `index`: blooms in over the first
  // REVEAL_FADE of the section, holds, then either fades out over the last
  // REVEAL_FADE or (if it is holding) clears across the boundary instead.
  const revealFor = (index: number) => {
    const bs = boundaries.value;
    const start = bs[index] ?? 0;
    const end = bs[index + 1] ?? 1;
    const span = end - start || 1;
    const local = (progress.value - start) / span;
    const fadeIn = clamp01(local / REVEAL_FADE);
    // Two different endings, and which one a piece gets depends on whether
    // anything is coming to replace it.
    //
    // NOTHING AFTER IT (the finale's signal rings): the ordinary trailing fade is
    // wrong. Contact's card is PINNED — on screen for its whole section — so
    // draining its backdrop over the last quarter of that section empties the
    // frame while the visitor is still reading it. Such a piece runs at full
    // strength to the end of its own section and then clears quickly across the
    // boundary, so it stops for the coda instead of following it in.
    //
    // SOMETHING AFTER IT (the skills field, handing over to the finale): the
    // trailing fade is exactly right — the stage has to be clear before the next
    // piece arrives.
    //
    // Note `local` is deliberately unclamped: past its own section it exceeds 1,
    // which is what lets the hand-off happen on the far side of the boundary. When
    // the holding section really is last, progress stops at local === 1 and the
    // piece is still at full — the page can bottom out without it draining away.
    const hold = sections.value
      .slice(index + 1)
      .every((s) => !s.setPiece || s.setPiece.length === 0);
    const fadeOut = hold
      ? clamp01((1 + HANDOFF_FADE - local) / HANDOFF_FADE)
      : clamp01((1 - local) / REVEAL_FADE);
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
    // The PIECE window, which is wider than the anchor window — see BIO_PIECE_SPAN.
    const half = (bioMilestonePieceHalfWindow(subCount) || 0.0001) * range;
    const local = (progress.value - (center - half)) / (2 * half);
    const fadeIn = clamp01(local / REVEAL_FADE);
    const fadeOut = clamp01((1 - local) / REVEAL_FADE);
    return smoothstep(Math.max(0, Math.min(fadeIn, fadeOut)));
  };

  // How strongly the head should "address" the visitor (0..1). Zero until the
  // contact beat, where it ramps to 1 over the first 60% of that section's scroll
  // range and then HOLDS for everything after it. Scene3D reads this in its render
  // loop to swing the head from its resting profile to facing — and then tracking
  // — the cursor (the deliberate end-of-page beat), imperatively, with no extra
  // rAF or layout read (issue #4).
  //
  // Found by TYPE, not by position. This used to require contact to be the very
  // last section, which silently switched the whole beat off the moment anything
  // was appended after it (the outro coda). The head would simply stop turning,
  // with nothing to point at as the cause.
  const addressing = computed(() => {
    const i = sections.value.findIndex((s) => s.type === "contact");
    if (i < 0) return 0;
    const bs = boundaries.value;
    const start = bs[i] ?? 0;
    const end = bs[i + 1] ?? 1;
    const local = (progress.value - start) / (end - start || 1);
    return smoothstep(clamp01(local / 0.6));
  });

  /**
   * How much of the head's gaze is on the CURSOR (0..1) — and, with it, whether
   * there is a fly out there to look at.
   *
   * This used to be `addressing` itself, and the two are not one thing. The TURN
   * is a posture the finale puts the head into and everything after it inherits:
   * the coda is still asking the visitor for something, and a head that looks
   * away while it does that reads as having lost interest. The TRACKING is an
   * interaction, and it belongs to the terminal — it is the visitor being
   * noticed at the moment they are being invited to type.
   *
   * Carried past that beat it also collides with the coda, whose whole image is
   * a system of coloured lights circling the head (`orbiting` below, and
   * `Planets.vue`): a face lit by five moving sources does not also need to be
   * flinching at the mouse, and the fly's embers sit in front of the one thing
   * the coda is composed around.
   *
   * So it rides `addressing` up, holds for the whole contact section, and is
   * released across the opening of whatever follows — the orb burns out as the
   * planets rise. With nothing after contact it simply IS `addressing`, so the
   * beat survives the coda being removed.
   */
  const tracking = computed(() => {
    const a = addressing.value;
    if (a <= 0) return 0;
    const i = sections.value.findIndex((s) => s.type === "contact");
    if (i < 0 || i + 1 >= sections.value.length) return a;
    const bs = boundaries.value;
    const start = bs[i + 1] ?? 1; // the coda's opening
    const end = bs[i + 2] ?? 1;
    const local = (progress.value - start) / (end - start || 1);
    return a * (1 - smoothstep(clamp01(local / TRACK_RELEASE)));
  });

  /**
   * How far up the coda's orbiting lights are (0..1) — see `Planets.vue`.
   *
   * Found by TYPE rather than by position, for the same reason `addressing` is:
   * "the last section" is a fact about the current registry, not about the beat.
   * It rises over the opening of the outro and then holds, so the system is fully
   * lit while the invitation is on screen and stays that way as the page bottoms
   * out.
   */
  const orbiting = computed(() => {
    const i = sections.value.findIndex((s) => s.type === "outro");
    if (i < 0) return 0;
    const bs = boundaries.value;
    const start = bs[i] ?? 0;
    const end = bs[i + 1] ?? 1;
    const local = (progress.value - start) / (end - start || 1);
    return smoothstep(clamp01(local / ORBIT_RISE));
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
    setHeadKeyframes,
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
    progressInSection,
    revealProgress,
    asciiCellStart,
    asciiCellEnd,
    asciiRampStart,
    asciiRampEnd,
    asciiRamp,
    asciiCellSize,
    asciiFontSize,
    addressing,
    tracking,
    orbiting,
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
