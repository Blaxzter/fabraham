import type { CameraKeyframe, HeadKeyframe } from "~/types/section";
import type { SpotKeyframe } from "~/types/spotlights";

// The "skills" chapter: four cluster cards FLY AT YOU and past into the depth —
// each one arrives larger than life right on top of the viewer, then recedes
// along the line of sight and is swallowed by the face waiting for it in the
// background. The head watches each one come in and settles square to camera as
// it lands; the key light swings round with it.
//
// This module is plain TS (no Vue / three imports) so the registry, the
// spotlight spine and the section component can all read the SAME formulas —
// the pattern the biography uses (`bioMilestoneCenter` lives in the store and is
// shared by BiographySection and `subReveal`, which is why the cards and their
// 3D backdrops never drift apart).
//
// The point of sharing here: a card's position in space is a pure function of
// scroll progress, so the head's gaze is too. "The head watches the cards
// arrive" is therefore just head keyframes GENERATED from the card layout — no
// tracking code, no DOM measurement, nothing per-frame (issue #4). Add or remove
// a cluster and the gaze, the light and the cards all re-derive together.

export interface SkillChip {
  label: string;
  /** Basename in `public/setpieces/logos/`. Omitted where no mark exists
   *  (Alembic, "RAG · embeddings") — those chips are simply text. */
  logo?: string;
}

export interface SkillCluster {
  id: string;
  label: string;
  /** The cluster's own hue. Every layer of the chapter reads it: the DOM card's
   *  rim and chips, the light cone under it, the key and rim spots on the head,
   *  and the extruded marks flying past in 3D. One colour per cluster, so the
   *  whole frame changes register as each one arrives. */
  accent: string;
  chips: SkillChip[];
}

/**
 * The marks StackFlight flies past the head for a cluster — DERIVED from its
 * chips rather than listed separately, so the glyph in a chip and the extruded
 * mark in the backdrop can never drift apart.
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
    accent: "#ffb454",
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
    accent: "#5fe3a1",
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
    accent: "#7fe3ff",
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
    accent: "#b79bff",
    chips: [
      { label: "Docker", logo: "docker" },
      { label: "Traefik", logo: "traefikproxy" },
      { label: "GitHub Actions", logo: "githubactions" },
      { label: "Azure", logo: "microsoftazure" },
      { label: "GCP", logo: "googlecloud" },
    ],
  },
];

/**
 * Cluster `i`'s hue, safe for any index.
 *
 * The four are ordered AROUND THE WHEEL on purpose — amber → mint → ice → violet
 * — because the key light interpolates between consecutive clusters, and sRGB
 * interpolation between two hues far apart passes straight through neutral grey
 * (see the lighting note in docs/scroll-3d-architecture.md). Keeping the steps
 * short, plus the dark beat `skillsSpotKeyframes` puts between clusters, is what
 * stops the head going grey on every hand-off.
 */
export const skillAccent = (i: number) =>
  SKILL_CLUSTERS[((i % SKILL_CLUSTERS.length) + SKILL_CLUSTERS.length) % SKILL_CLUSTERS.length]!
    .accent;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp11 = (v: number) => Math.max(-1, Math.min(1, v));
const smoothstep = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const v3 = (x: number, y: number, z: number) => ({ x, y, z });

// ---------------------------------------------------------------------------
// Layout: when each card flies, and how far down its flight it has got
// ---------------------------------------------------------------------------
// Same shape as the biography cluster's maths: fractions of the (tall) section.

/**
 * Where the flight path starts, as a fraction of the section's scroll range.
 * Deliberately not ~0: `progress` is normalized over (scrollHeight − viewport)
 * while the DOM sections tile the full scrollHeight, so a section's *pinned*
 * window sits later in its own progress range than you'd expect. These two
 * numbers place all four cards inside the window where the stage is actually
 * stuck to the viewport (the same class of offset the biography cluster's
 * BIO_TOP_PAD / BIO_RANGE absorb).
 */
export const SKILLS_TOP_PAD = 0.22;
/** Span of the section's scroll range the four flights occupy. */
export const SKILLS_RANGE = 0.72;
/** Half a card's flight window, as a factor of the per-card spacing. Comfortably
 *  over 0.5 so consecutive windows OVERLAP: one card is still receding into the
 *  face while the next is already arriving over your shoulder, which is what makes
 *  the chapter read as a continuous run rather than four separate events.
 *
 *  Raising it is the lever for "the cards should follow each other faster"; the
 *  ceiling is `GAZE_TRACK` below, which needs a gap left between one card's last
 *  gaze sample and the next card's first. */
const HALF_FACTOR = 0.64;
/** The middle share of a card's flight the head follows (0..1 of the window).
 *  The remainder of the beat is the swing across to meet the next card. Keep it
 *  under ~0.86: past that the tail of one card's samples would land LATER in the
 *  section than the head of the next card's, and a pose track must stay sorted. */
const GAZE_TRACK = 0.7;

/** Section-local position (0..1) at which card `i` is at life size on the mark. */
export const skillCenter = (i: number, n: number) =>
  SKILLS_TOP_PAD + ((i + 0.5) / (n || 1)) * SKILLS_RANGE;

/** Half of a card's flight window, in section-local units. */
export const skillHalfWindow = (n: number) => (SKILLS_RANGE / (n || 1)) * HALF_FACTOR;

/** How far card `i` has flown at section-local position `frac`:
 *  0 = right on top of the viewer, 1 = swallowed by the face in the background. */
export const skillTravel = (i: number, n: number, frac: number) => {
  const half = skillHalfWindow(n) || 0.0001;
  return clamp01((frac - (skillCenter(i, n) - half)) / (2 * half));
};

/** Section-local position of a card at travel `u` (inverse of `skillTravel`). */
export const skillFracAt = (i: number, n: number, u: number) =>
  skillCenter(i, n) + (u - 0.5) * 2 * skillHalfWindow(n);

// ---------------------------------------------------------------------------
// The flight path itself
// ---------------------------------------------------------------------------
// The motion is pure DEPTH. A card keeps ONE fixed position in the stage's plane
// for its whole run and only its `translateZ` changes; the browser's perspective
// does the rest. A card at z → −∞ converges on the stage's `perspective-origin`
// (parked on the face), and a card at z → +perspective blows up and sails off
// past the edge of the frame. So "out of the screen at you, then away into the
// face" is one number per card per tick, and the convergence is exact rather
// than a path someone had to draw.
//
// Which means everything downstream only needs the card's APPARENT SIZE and the
// direction it came in on: the projected offset from the vanishing point is just
// `home × scale`. That is what `skillOffset` returns, and what the gaze, the key
// light, the DOM beam and the 3D backdrop are all derived from.

/** Apparent size at the near end of a run — big enough that the card is part off
 *  frame and unreadable, which is what makes it read as passing you. */
export const SKILL_NEAR_SCALE = 2.5;
/** …and at the far end, by which point it is a chip of light on the face. */
export const SKILL_FAR_SCALE = 0.18;

/**
 * A card's apparent size at travel `u`. EXPONENTIAL, not linear: something
 * receding at a steady rate halves in apparent size over equal steps of depth,
 * so a geometric ramp is the one that reads as constant velocity. A linear ramp
 * on `translateZ` instead races through the near half (where apparent size
 * changes fastest) and crawls through the far half — the card would flick past
 * the readable window and then hang about as a dot.
 */
export const skillScale = (u: number) =>
  SKILL_NEAR_SCALE * Math.pow(SKILL_FAR_SCALE / SKILL_NEAR_SCALE, clamp01(u));

/** The `translateZ` (px) that produces apparent size `s` under `perspective` px.
 *  The inverse of the browser's own `scale = p / (p − z)`, so the size the rest
 *  of this module reasons about is exactly the size on screen — whatever the
 *  perspective happens to be tuned to. */
export const skillTranslateZ = (s: number, perspective: number) =>
  perspective * (1 - 1 / s);

/** How "in your face" a card is: 1 at the near end, 0 once it is past life size
 *  and merely receding. Drives the things that should only happen up close — the
 *  depth-of-field blur, the turn toward the viewer, the head's flinch. */
export const skillNearness = (s: number) => clamp01((s - 1) / (SKILL_NEAR_SCALE - 1));

/** The direction each card flies in on, as a unit-ish vector out of the
 *  vanishing point. All four are ABOVE the face (negative y): the head sits low
 *  in frame this chapter and the cards have to clear it on the way in, or the
 *  thing they are flying into is hidden behind them for the whole run. Sides
 *  alternate so the head's turn has a rhythm instead of a drift. */
const SKILL_DIRS = [
  { x: -0.92, y: -0.82 },
  { x: 0.98, y: -0.66 },
  { x: -0.8, y: -1.0 },
  { x: 0.9, y: -0.58 },
] as const;

/** How far off the vanishing point a card sits at life size (vw / vh). Wide
 *  enough that the near end of the flight is genuinely off frame, and tall
 *  enough that the readable stretch of it stays clear of the head it is aimed
 *  at — every card converges ON the face, so a shallow bearing spends its whole
 *  run on top of the thing it is arriving at. */
export const SKILL_HOME_RADIUS = { x: 23, y: 28 };

/** The direction card `i` flies in on — used where only the bearing matters (the
 *  angle a card is turned at, which way the head looks). */
export const skillDir = (i: number) => SKILL_DIRS[i % SKILL_DIRS.length]!;

/** Where card `i` sits at life size, as an offset from the vanishing point in
 *  vw / vh. This is the card's FIXED position in the stage plane — the one the
 *  DOM writes once per card and never animates. */
export const skillHome = (i: number) => {
  const d = skillDir(i);
  return { x: d.x * SKILL_HOME_RADIUS.x, y: d.y * SKILL_HOME_RADIUS.y };
};

/** Where card `i` actually IS on screen at travel `u`: its projected offset from
 *  the vanishing point (vw / vh) plus its apparent size. The single source for
 *  where a card is — the gaze generator reads it to work out where the head
 *  should be looking, the key light reads it to pick a side, the DOM beam aims
 *  at it, and the 3D backdrop flares under it. */
export const skillOffset = (i: number, u: number) => {
  const h = skillHome(i);
  const s = skillScale(u);
  return { x: h.x * s, y: h.y * s, s };
};

/** The beat a card is on the mark: past the near blur, at life size, not yet
 *  dissolving into the face. Not 0.5 — the geometric ramp passes life size
 *  early, and that crossing is the moment worth lighting. */
export const SKILL_FOCUS = 0.38;
const FOCUS_HALF = 0.34;

/** "How lit is this card" — 0 at the ends of its run, 1 on the mark. */
export const skillLit = (u: number) =>
  smoothstep(clamp01(1 - Math.abs(u - SKILL_FOCUS) / FOCUS_HALF));

// ---------------------------------------------------------------------------
// The gaze
// ---------------------------------------------------------------------------
// Sign conventions, both taken from how Scene3D drives the head:
//   rotation.y > 0 → looking screen-RIGHT (the finale's `addressYaw: 0.45`
//     turns the head toward the CLI card on the right);
//   rotation.x > 0 → looking DOWN. The cursor-follow adds
//     `mousePosition.y * maxPitch`, and `mousePosition.y` is
//     `clientY / innerHeight * 2 - 1` — screen space, positive at the BOTTOM.
// The cards come in from above, so tracking one needs a NEGATIVE pitch.
//
// Both are in FACE-ON SPACE: yaw 0 looks straight down the lens. The model itself
// is authored turned ~41 degrees, but that is corrected once in Scene3D
// (`faceYaw`), so nothing here has to know or care. Author gazes around 0.

/** Widest turn either side of face-on, radians (~23°). Deliberately modest: the
 *  cards alternate sides, so whatever this is, the head swings TWICE it between
 *  consecutive cards. At 0.62 that was a 71° whip across the narrow gap between
 *  windows, and it read as the head snapping left-right rather than watching. */
const GAZE_MAX_YAW = 0.4;
/** Projected offset (vw / vh) at which the turn and the tilt saturate. Wide
 *  enough that a card only reaches full yaw at the very start of its run — at 26
 *  nearly every card pinned the turn at maximum for most of its pass, which is
 *  the other half of why the head looked like it was snapping between poses. */
const GAZE_REF_VW = 38;
const GAZE_REF_VH = 30;
/** Tilt when a card is high overhead. Negative = looking up. */
const GAZE_PITCH_UP = -0.17;
/** How many poses per card. Two is not enough: `samplePose` eases every pair
 *  with `power2.inOut`, so a two-pose sweep races through the middle while the
 *  card flies in at a steady rate — the head lurches instead of tracking.
 *  Sampling the card's real position several times makes the eased track follow
 *  it closely. */
const GAZE_SAMPLES = 7;
/** The head's shipped resting yaw (stores/sections.ts DEFAULT_HEAD_YAW) — the
 *  pose it arrives from and returns to, so the chapter joins seamlessly. */
const REST_YAW = 0.28;
/** A weight shift toward the card, world units. Deliberately small: the face is
 *  the vanishing point the cards converge on, and that point is a FIXED spot on
 *  screen, so the head may lean but must not travel. It also adds to the
 *  left-right read, so it comes down whenever the yaw swing does. */
const HEAD_SWAY_X = 0.05;
/** How far the head pulls back from a card that is right on top of it. The
 *  flinch is the thing that says the card is between you and it. */
const HEAD_RECOIL_Z = 0.07;

/**
 * Where the head must point, and sit, to be meeting card `i` at travel `u`.
 *
 * Derived from the card's PROJECTED offset — the same number that decides where
 * the card is drawn — so the gaze is honest for free: turned and tilted up while
 * the card is large and off to one side, easing back to face-on as it shrinks
 * onto the face. Every card therefore ends its run with the head looking straight
 * down the lens, which is the beat: it catches the thing thrown at it.
 */
const gazeAt = (i: number, u: number) => {
  const o = skillOffset(i, u);
  const k = clamp11(o.x / GAZE_REF_VW);
  const up = clamp01(-o.y / GAZE_REF_VH);
  return {
    k,
    up,
    near: skillNearness(o.s),
    yaw: GAZE_MAX_YAW * k,
    pitch: GAZE_PITCH_UP * up,
  };
};

/** The stretch of a card's flight the head actually follows, leaving the rest of
 *  the beat to swing across and meet the next one. */
const trackedU = (s: number) => (1 - GAZE_TRACK) / 2 + (s / (GAZE_SAMPLES - 1)) * GAZE_TRACK;

/** The sample index nearest the focus beat — the one that gets the light's throb. */
const FOCUS_SAMPLE = Math.max(
  0,
  Math.min(
    GAZE_SAMPLES - 1,
    Math.round(((SKILL_FOCUS - (1 - GAZE_TRACK) / 2) / GAZE_TRACK) * (GAZE_SAMPLES - 1))
  )
);

const headKf = (t: number, yaw: number): HeadKeyframe => ({
  t,
  position: v3(0, 0, 0),
  rotation: v3(0, yaw, 0),
  opacity: 1,
});

/**
 * The head's per-scene track: rest → meet card 0 as it comes in over your
 * shoulder and follow it down onto itself → swing across to meet card 1 → … →
 * rest. Each card contributes `GAZE_SAMPLES` poses read straight off its real
 * position, so the head genuinely tracks the thing flying at it.
 *
 * Unlike the conveyor this replaces, the track never fades the head out. It used
 * to have to: the head rode across the frame with each card and had to be
 * invisible while it flew back for the next one. Now the head is the
 * DESTINATION — it stays put, stays visible, and leans rather than travels.
 */
export const skillsHeadKeyframes = (): HeadKeyframe[] => {
  const n = SKILL_CLUSTERS.length;
  const kfs: HeadKeyframe[] = [headKf(0.005, REST_YAW)];
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < GAZE_SAMPLES; s++) {
      const u = trackedU(s);
      const g = gazeAt(i, u);
      kfs.push({
        t: skillFracAt(i, n, u),
        position: v3(HEAD_SWAY_X * g.k, 0, -HEAD_RECOIL_Z * g.near),
        rotation: v3(g.pitch, g.yaw, 0),
        opacity: 1,
      });
    }
  }
  // Settle at 0.98, not 1.0: a keyframe at exactly t:1 lands on a
  // right-exclusive section boundary. Back to centre for the contact hand-off —
  // the finale needs a head to address the terminal with.
  kfs.push(headKf(0.98, REST_YAW));
  return kfs;
};

/**
 * A near-static hold, then the pan that hands off to the finale.
 *
 * Held on purpose. The cards converge on a FIXED point on screen (the stage's
 * `perspective-origin`, parked on the face), so a camera move that shifts the
 * head sideways or changes its size pulls the face off the point its own cards
 * are aiming at. Pulled back (high z) and lifted (high y) so the head sits small
 * and low and the cards have the upper half of the frame to come in through; the
 * pan to the right waits until 0.88, by which time the last card has landed.
 *
 * Pulled back further (1.74 → 2.15) once the hero and the reveal got a close
 * frame each. This chapter is a FIELD — a cloud of tools with a head somewhere in
 * it — and at the old distance the cloud was cropped on every edge and the head
 * was big enough to be the subject, which is the wrong way round for the one
 * section that is about breadth. It also gives back the contrast the sequence
 * needs: the face fills the frame at the reveal, and here the same head is one
 * object among many.
 */
export const skillsCameraKeyframes = (): CameraKeyframe[] => [
  { t: 0, position: v3(0.0, 0.13, 2.15), rotation: v3(-0.01, 0.0, 0.0) },
  { t: 0.88, position: v3(0.0, 0.13, 2.13), rotation: v3(-0.01, 0.0, 0.0) },
  { t: 0.98, position: v3(0.18, 0.09, 2.11), rotation: v3(-0.03, 0.0, 0.0) },
];

// ---------------------------------------------------------------------------
// The key light, swinging with the gaze
// ---------------------------------------------------------------------------
// Duplicated rather than imported from spotlights.ts: that module imports THIS
// one, and a cycle would leave the const undefined at evaluation time.
/** Roughly the centre of the face, head-local (see spotlights.ts `FACE`). */
const FACE = v3(0, 0.06, 0.12);

const SPOT_X = 0.85; // how far the key swings either side of the head
/** Intensity the key drops to on a hand-off, and where in the gap the two dark
 *  keyframes sit. */
const HANDOFF_INTENSITY = 2;
const HANDOFF_AT = [0.32, 0.68];

/** First and last beat of a cluster's gaze run, in section-local units. */
const clusterSpan = (i: number, n: number) => ({
  from: skillFracAt(i, n, trackedU(0)),
  to: skillFracAt(i, n, trackedU(GAZE_SAMPLES - 1)),
});

/**
 * Key-light keyframes for this chapter, sampled on exactly the same beats as the
 * gaze — so the head is lit from the side the incoming card is on, and the light
 * comes round with the turn instead of drifting against it. As a card lands the
 * key swings to the front with it, which is what makes the arrival read as an
 * arrival. Spread into the key track in spotlights.ts.
 *
 * Each cluster is lit in ITS OWN COLOUR, and every hand-off gets a DARK BEAT: two
 * low-intensity keyframes in the gap, the first still on the outgoing hue and the
 * second already on the incoming one. The whole hue change therefore happens
 * between them, at intensity 2, where nobody can see it go through grey — which
 * is exactly what sRGB interpolation across the wheel does. Without this the head
 * washes out to neutral on every card change. It also earns its keep as a beat:
 * the key re-strikes for each cluster instead of sliding continuously.
 */
export const skillsSpotKeyframes = (): SpotKeyframe[] => {
  const n = SKILL_CLUSTERS.length;
  const base = {
    section: "skills",
    target: FACE,
    angle: 0.48,
    penumbra: 0.45,
  } as const;
  const kfs: SpotKeyframe[] = [];
  for (let i = 0; i < n; i++) {
    const color = skillAccent(i);
    if (i > 0) {
      const gap = { from: clusterSpan(i - 1, n).to, to: clusterSpan(i, n).from };
      const span = gap.to - gap.from;
      kfs.push(
        {
          ...base,
          t: gap.from + span * HANDOFF_AT[0]!,
          position: v3(SPOT_X * 0.4, 0.5, 0.8),
          intensity: HANDOFF_INTENSITY,
          color: skillAccent(i - 1),
        },
        {
          ...base,
          t: gap.from + span * HANDOFF_AT[1]!,
          position: v3(-SPOT_X * 0.4, 0.5, 0.8),
          intensity: HANDOFF_INTENSITY,
          color,
        }
      );
    }
    for (let s = 0; s < GAZE_SAMPLES; s++) {
      const u = trackedU(s);
      const g = gazeAt(i, u);
      kfs.push({
        ...base,
        t: skillFracAt(i, n, u),
        // Rakes from the card's side while the card is still out there and high,
        // and drops to a frontal key as it comes down onto the face.
        position: v3(SPOT_X * g.k, 0.34 + 0.3 * g.up, 0.8),
        intensity: 15,
        color,
        // A gentle throb only on the beat the card is on the mark.
        ...(s === FOCUS_SAMPLE
          ? { effect: { type: "pulse", amount: 0.18, speed: 1.1 } as const }
          : {}),
      });
    }
  }
  return kfs;
};

/**
 * Rim keyframes on the same beats: the edge light behind the head takes the
 * cluster's hue too, so the silhouette changes register with everything else.
 * One keyframe per cluster (the rim has no reason to swing), with the same dark
 * hand-off beat for the same reason.
 */
export const skillsRimKeyframes = (): SpotKeyframe[] => {
  const n = SKILL_CLUSTERS.length;
  const base = {
    section: "skills",
    target: FACE,
    angle: 0.55,
    penumbra: 0.6,
  } as const;
  const kfs: SpotKeyframe[] = [];
  for (let i = 0; i < n; i++) {
    const span = clusterSpan(i, n);
    if (i > 0) {
      const gapFrom = clusterSpan(i - 1, n).to;
      const width = span.from - gapFrom;
      kfs.push(
        {
          ...base,
          t: gapFrom + width * HANDOFF_AT[0]!,
          position: v3(0.1, 0.92, -0.68),
          intensity: 2,
          color: skillAccent(i - 1),
        },
        {
          ...base,
          t: gapFrom + width * HANDOFF_AT[1]!,
          position: v3(-0.1, 0.92, -0.68),
          intensity: 2,
          color: skillAccent(i),
        }
      );
    }
    kfs.push({
      ...base,
      t: skillFracAt(i, n, SKILL_FOCUS),
      // Alternates side with the cluster, so the silhouette is not rimmed from
      // the same edge four times running.
      position: v3(i % 2 === 0 ? 0.16 : -0.16, 0.95, -0.7),
      intensity: 10,
      color: skillAccent(i),
      effect: { type: "colorCycle", amount: 0.08, speed: 0.3 } as const,
    });
  }
  return kfs;
};
