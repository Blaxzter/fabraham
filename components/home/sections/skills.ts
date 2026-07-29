import type { CameraKeyframe, HeadKeyframe } from "~/types/section";
import type { SpotKeyframe } from "~/types/spotlights";

// The "skills" chapter: four cluster cards stream across a pinned stage from
// right to left, the head turns to follow each one, and the key light swings
// with the gaze.
//
// This module is plain TS (no Vue / three imports) so the registry, the
// spotlight spine and the section component can all read the SAME formulas —
// the pattern the biography uses (`bioMilestoneCenter` lives in the store and is
// shared by BiographySection and `subReveal`, which is why the cards and their
// 3D backdrops never drift apart).
//
// The point of sharing here: a card's horizontal position is a pure function of
// scroll progress, so the head's gaze is too. "The head looks at the cards" is
// therefore just head keyframes GENERATED from the card layout — no tracking
// code, no DOM measurement, nothing per-frame (issue #4). Add or remove a
// cluster and the gaze, the light and the cards all re-derive together.

export interface SkillChip {
  label: string;
  /** Basename in `public/setpieces/logos/`. Omitted where no mark exists
   *  (Alembic, "RAG · embeddings") — those chips are simply text. */
  logo?: string;
}

export interface SkillCluster {
  id: string;
  label: string;
  chips: SkillChip[];
}

/**
 * The marks StackLogos draws behind the head for a cluster — DERIVED from its
 * chips rather than listed separately, so the glyph in a chip and the line art
 * in the backdrop can never drift apart.
 */
export const clusterLogos = (c: SkillCluster): string[] =>
  c.chips.map((x) => x.logo).filter((x): x is string => !!x);

/**
 * Chips only, deliberately shallow — this is a glance, not a résumé. Groupings
 * and contents come from the current CV, cross-checked against what the public
 * GitHub work is actually written in.
 */
export const SKILL_CLUSTERS: SkillCluster[] = [
  {
    id: "backend",
    label: "Backend",
    chips: [
      { label: "Python", logo: "python" },
      { label: "FastAPI", logo: "fastapi" },
      { label: "async SQLAlchemy", logo: "sqlalchemy" },
      { label: "PostgreSQL", logo: "postgresql" },
      { label: "Alembic" },
    ],
  },
  {
    id: "frontend",
    label: "Frontend",
    chips: [
      { label: "TypeScript", logo: "typescript" },
      { label: "Vue 3", logo: "vuedotjs" },
      { label: "Nuxt", logo: "nuxt" },
      { label: "Tailwind", logo: "tailwindcss" },
      { label: "Three.js", logo: "threedotjs" },
    ],
  },
  {
    id: "ai",
    label: "AI / LLM",
    chips: [
      { label: "PydanticAI", logo: "pydantic" },
      { label: "Azure OpenAI", logo: "openai" },
      { label: "Vertex · Gemini", logo: "googlegemini" },
      { label: "RAG · embeddings" },
      { label: "PyTorch", logo: "pytorch" },
    ],
  },
  {
    id: "infra",
    label: "Infra",
    chips: [
      { label: "Docker", logo: "docker" },
      { label: "Traefik", logo: "traefikproxy" },
      { label: "GitHub Actions", logo: "githubactions" },
      { label: "Azure", logo: "microsoftazure" },
      { label: "GCP", logo: "googlecloud" },
    ],
  },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const v3 = (x: number, y: number, z: number) => ({ x, y, z });

// ---------------------------------------------------------------------------
// Layout: where each card sits in the section's scroll range
// ---------------------------------------------------------------------------
// Same shape as the biography cluster's maths: fractions of the (tall) section.

/**
 * Where the conveyor starts, as a fraction of the section's scroll range.
 * Deliberately not ~0: `progress` is normalized over (scrollHeight − viewport)
 * while the DOM sections tile the full scrollHeight, so a section's *pinned*
 * window sits later in its own progress range than you'd expect. These two
 * numbers place all four cards inside the window where the stage is actually
 * stuck to the viewport (the same class of offset the biography cluster's
 * BIO_TOP_PAD / BIO_RANGE absorb).
 */
export const SKILLS_TOP_PAD = 0.22;
/** Span of the section's scroll range the card conveyor occupies. */
export const SKILLS_RANGE = 0.72;
/** Half a card's travel window, as a factor of the per-card spacing. Slightly
 *  over 0.5 so consecutive windows overlap a little: one card is still leaving
 *  as the next enters, which is what makes it read as a conveyor. */
const HALF_FACTOR = 0.58;
/** The middle share of a card's run that the head follows (0..1 of the window).
 *  The remainder of the beat is the flick back to the right for the next card. */
const GAZE_TRACK = 0.62;

/** Section-local position (0..1) at which card `i` is dead centre on stage. */
export const skillCenter = (i: number, n: number) =>
  SKILLS_TOP_PAD + ((i + 0.5) / (n || 1)) * SKILLS_RANGE;

/** Half of a card's travel window, in section-local units. */
export const skillHalfWindow = (n: number) => (SKILLS_RANGE / (n || 1)) * HALF_FACTOR;

/** How far card `i` has crossed the stage at section-local position `frac`:
 *  0 = just off the right edge, 0.5 = centred, 1 = just off the left edge. */
export const skillTravel = (i: number, n: number, frac: number) => {
  const half = skillHalfWindow(n) || 0.0001;
  return clamp01((frac - (skillCenter(i, n) - half)) / (2 * half));
};

/** How far off-stage (vw) a card sits at the ends of its run — far enough that it
 *  is never seen popping in at the viewport edge. */
export const SKILL_TRAVEL_EDGE = 64;

/** A card's horizontal offset from centre (vw) at travel `u`. The single source
 *  for where a card IS — the DOM reads it to place the card, the gaze generator
 *  reads it to work out where the head should be looking, and the 3D rail reads
 *  it to flare the gate the card is passing. */
export const skillX = (u: number) => SKILL_TRAVEL_EDGE - 2 * SKILL_TRAVEL_EDGE * u;

/** Section-local position of a card at travel `u` (inverse of `skillTravel`). */
export const skillFracAt = (i: number, n: number, u: number) =>
  skillCenter(i, n) + (u - 0.5) * 2 * skillHalfWindow(n);

// ---------------------------------------------------------------------------
// The gaze
// ---------------------------------------------------------------------------
// Sign conventions, both taken from how Scene3D drives the head:
//   rotation.y > 0 → looking screen-RIGHT (the finale's `addressYaw: 0.45`
//     turns the head toward the CLI card on the right);
//   rotation.x > 0 → looking DOWN. The cursor-follow adds
//     `mousePosition.y * maxPitch`, and `mousePosition.y` is
//     `clientY / innerHeight * 2 - 1` — screen space, positive at the BOTTOM.
// The cards fly across the upper half of the stage, so tracking them needs a
// NEGATIVE pitch.

/**
 * The head doesn't watch from the middle — it RIDES the conveyor, sweeping
 * right→left with each card and clearing the frame entirely at both ends. The
 * head is about half a world unit wide and the frame's half-width at its depth
 * is ~1.1, so it needs to reach past ~1.6 to be genuinely gone; at the ends of
 * a card's tracked run (`GAZE_TRACK`) this puts it around ±1.8.
 */
export const HEAD_TRAVEL_X = 2.9;
/** How far the head rises over a card's run — matching the descent the logo row
 *  and the DOM cards read. */
const HEAD_RISE_Y = 0.12;

/** The head's world x at travel `u`. Exported so the DOM beam's apex can sit on
 *  the head as it moves, instead of staying pinned to the middle of the frame. */
export const skillHeadX = (u: number) => (skillX(u) / SKILL_TRAVEL_EDGE) * HEAD_TRAVEL_X;

/** World-x → screen-vw at roughly the head's depth, for the DOM beam apex. */
export const HEAD_WORLD_TO_VW = 45;

/** Widest head turn, radians (~35°) — past this it stops reading as a head. */
const GAZE_MAX_YAW = 0.62;
/**
 * Where a card sits in world x (at the head's depth) per unit of its normalised
 * travel. Cards run to ±64vw and the frame's half-width at that depth is ~1.1
 * world units for 50vw, so a card at full travel is ~1.41 out.
 */
const CARD_WORLD_SCALE = 1.41;
/** Relative offset (world units, card minus head) at which the turn saturates.
 *  Scaled to the head's travel so the sweep spans the pass instead of pinning
 *  at full yaw for most of it. */
const GAZE_REF_WORLD = 0.95;
/** Upward tilt when a card is directly overhead. Negative = looking up. */
const GAZE_PITCH_UP = -0.13;
/** How many poses per card. Two is not enough: `samplePose` eases every pair
 *  with `power2.inOut`, so a two-pose sweep races through the middle while the
 *  card crosses at a constant rate — the head lurches instead of tracking.
 *  Sampling the card's real position several times makes the eased track follow
 *  it closely. */
const GAZE_SAMPLES = 7;
/** Fade profile across those samples: out at both ends of a pass, solid through
 *  the middle. The zeros are what let the head cut rather than fly back — with
 *  both sides of the gap between cards at 0, the return trip is invisible. */
const GAZE_FADE = [0, 0.85, 1, 1, 1, 0.85, 0];
/** The head's shipped resting yaw (stores/sections.ts DEFAULT_HEAD_YAW) — the
 *  pose it arrives from and returns to, so the chapter joins seamlessly. */
const REST_YAW = -0.44;

/**
 * Where the head must point to be looking at a card at travel `u`.
 *
 * Derived from the RELATIVE offset between card and head, not from the card's
 * absolute position — because the head is moving too. That one detail keeps the
 * gaze honest at any `HEAD_TRAVEL_X`: while the head is slower than the card the
 * card overtakes it and the head sweeps right→left; once the head outruns the
 * card (as it does now, travelling far enough to leave frame) the sign flips on
 * its own and the head looks BACK over its shoulder at the card it is passing.
 */
const gazeAt = (u: number) => {
  const norm = skillX(u) / SKILL_TRAVEL_EDGE; // -1..1 across the stage
  const rel = norm * (CARD_WORLD_SCALE - HEAD_TRAVEL_X);
  const k = Math.max(-1, Math.min(1, rel / GAZE_REF_WORLD));
  return {
    yaw: GAZE_MAX_YAW * k,
    // Tilt up most when the card is overhead, less when it is off to a side.
    pitch: GAZE_PITCH_UP * (0.6 + 0.4 * (1 - Math.abs(k))),
  };
};

/** The stretch of a card's run the head actually follows, leaving the rest of
 *  the beat to flick back to the right for the next card. */
const trackedU = (s: number) =>
  (1 - GAZE_TRACK) / 2 + (s / (GAZE_SAMPLES - 1)) * GAZE_TRACK;

const headKf = (
  t: number,
  yaw: number,
  pitch = 0,
  x = 0,
  y = 0,
  opacity = 1
): HeadKeyframe => ({
  t,
  position: v3(x, y, 0),
  rotation: v3(pitch, yaw, 0),
  opacity,
});

/**
 * The head's per-scene track: rest → ride across with card 0, watching it → cut
 * away → reappear on the right with card 1 → … → rest. Each card contributes
 * `GAZE_SAMPLES` poses read straight off its real position, so the head both
 * travels the conveyor and genuinely tracks the card it is carrying.
 *
 * The head still has to *travel* from far-left back to far-right between cards —
 * a pose track can only interpolate — but `GAZE_FADE` takes it to 0 at both ends
 * of a pass, so that return trip happens unseen. Each card gets a clean entrance
 * instead of a head visibly flying backwards across the frame.
 */
export const skillsHeadKeyframes = (): HeadKeyframe[] => {
  const n = SKILL_CLUSTERS.length;
  // Hold SOLID at the section boundary before fading. A track interpolates
  // across section borders, so starting this chapter at opacity 0 would bleed
  // the fade backwards — the head would dissolve through the last stretch of the
  // biography. Pin it opaque at the very start, then fade out inside this
  // section as it drifts off to the right to meet the first card.
  const kfs: HeadKeyframe[] = [
    headKf(0.005, REST_YAW, 0, 0, 0, 1),
    headKf(0.16, REST_YAW * 0.5, 0, HEAD_TRAVEL_X * 0.45, 0, 0),
  ];
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < GAZE_SAMPLES; s++) {
      const u = trackedU(s);
      const g = gazeAt(u);
      kfs.push(
        headKf(
          skillFracAt(i, n, u),
          g.yaw,
          g.pitch,
          skillHeadX(u),
          (u - 0.5) * HEAD_RISE_Y,
          GAZE_FADE[s] ?? 1
        )
      );
    }
  }
  // Settle at 0.98, not 1.0: a keyframe at exactly t:1 lands on a
  // right-exclusive section boundary. Back to centre, solid, for the contact
  // hand-off — the finale needs a head to address the terminal with.
  kfs.push(headKf(0.98, REST_YAW, 0, 0, 0, 1));
  return kfs;
};

/**
 * A slow dolly that arrives from the biography and eases toward the finale's
 * panned-right pose. Pulled back (high z) and lifted (high y, near-level
 * rotation) so the head sits SMALL and LOW in frame — the cards stream across
 * the upper half and the turning head stays readable underneath them instead of
 * being covered.
 */
export const skillsCameraKeyframes = (): CameraKeyframe[] => [
  { t: 0, position: v3(0.0, 0.13, 1.74), rotation: v3(-0.01, 0.0, 0.0) },
  { t: 0.5, position: v3(0.04, 0.14, 1.66), rotation: v3(-0.02, 0.01, 0.0) },
  { t: 0.98, position: v3(0.18, 0.09, 1.7), rotation: v3(-0.03, 0.0, 0.0) },
];

// ---------------------------------------------------------------------------
// The key light, swinging with the gaze
// ---------------------------------------------------------------------------
// Duplicated rather than imported from spotlights.ts: that module imports THIS
// one, and a cycle would leave the const undefined at evaluation time.
/** Roughly the centre of the face, head-local (see spotlights.ts `FACE`). */
const FACE = v3(0, 0.06, 0.12);

const SPOT_X = 0.85; // how far the key swings either side of the head
const SPOT_COLOR = "#ffb454";

/**
 * Key-light keyframes for this chapter, sampled on exactly the same beats as the
 * gaze — so the head is always lit from the side the card is on and the light
 * swings with the turn instead of drifting against it. Spread into the key track
 * in spotlights.ts.
 */
export const skillsSpotKeyframes = (): SpotKeyframe[] => {
  const n = SKILL_CLUSTERS.length;
  const base = {
    section: "skills",
    target: FACE,
    intensity: 15,
    color: SPOT_COLOR,
    angle: 0.48,
    penumbra: 0.45,
  } as const;
  const kfs: SpotKeyframe[] = [];
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < GAZE_SAMPLES; s++) {
      const u = trackedU(s);
      // Which side the card is on, relative to the stage centre.
      const k = Math.max(-1, Math.min(1, skillX(u) / SKILL_TRAVEL_EDGE));
      kfs.push({
        ...base,
        t: skillFracAt(i, n, u),
        // Follows the card across, and lifts as it passes overhead. Offset by
        // the head's own travel too — the head rides the conveyor now, and a
        // light left behind at centre would rake it from the side and then
        // from behind as it drifts away.
        position: v3(
          SPOT_X * k + skillHeadX(u),
          0.5 + 0.12 * (1 - Math.abs(k)),
          0.8
        ),
        // A gentle throb only while the card is centre stage.
        ...(s === (GAZE_SAMPLES - 1) / 2
          ? { effect: { type: "pulse", amount: 0.18, speed: 1.1 } as const }
          : {}),
      });
    }
  }
  return kfs;
};
