import type { HeadKeyframe } from "~/types/section";
import type { SpotKeyframe } from "~/types/spotlights";
import { bioMilestoneCenter, bioMilestoneHalfWindow } from "~/stores/sections";

// The "biography" chapter: milestone cards hang off a vertical timeline,
// alternating left/right of centre, and drift up past the head as you scroll.
// The head SWERVES to the side OPPOSITE the card that is currently centred and
// TURNS to look back at it, and the key light swings onto the card's side so the
// turned face is lit from where the card is.
//
// Like ./skills.ts, this module is the ONE place the chapter's layout formula
// lives; everything else is GENERATED from it:
//
//   bioCardAnchors()          → BiographySection.vue places the DOM nodes + cards
//   biographyHeadKeyframes()  → sections store, `headKeyframes.biography`
//   biographySpotKeyframes()  → spotlights store, the `key` + `fill` tracks
//
// so "the head looks at the cards" needs no tracking code, no DOM measurement and
// nothing per-frame (issue #4) — and adding a milestone re-derives the cards, the
// gaze and the light together. It is the same one-formula-many-consumers trick
// the vertical layout already plays with `bioMilestoneCenter` (imported below
// rather than duplicated: that formula is shared with the store's `subReveal` and
// its milestone anchor resolver, so it has to stay where all three can reach it).
//
// UNLIKE skills, the card count is NOT known at module-eval time — the milestones
// come from the @nuxt/content collection, and their side/accent from frontmatter.
// So these generators run at RUNTIME from the loaded list and are written into the
// editable stores by `useBiographyChoreography()` (composables/useSections.ts);
// see there for the "only when the content actually changed" guard that keeps them
// from clobbering live dev-panel edits.

/**
 * The milestone fields the choreography reads. Declared locally (rather than
 * importing `BiographyMilestone`) so this module stays independent of the content
 * schema — `BiographyMilestone` satisfies it structurally.
 */
export interface BioCardInput {
  side?: "left" | "right" | "auto";
  accent?: string;
  offset?: { x?: number; y?: number };
}

/**
 * Where one milestone sits: `ax` across the viewport (percent), `ay` down the
 * (tall) biography section (percent of its height), and which side of the
 * timeline its card hangs on (-1 = left, +1 = right).
 */
export interface BioCardAnchor {
  ax: number;
  ay: number;
  sideSign: number;
}

const clamp11 = (v: number) => Math.max(-1, Math.min(1, v));
const v3 = (x: number, y: number, z: number) => ({ x, y, z });

// ---------------------------------------------------------------------------
// Layout: where each card sits
// ---------------------------------------------------------------------------

/** How far off centre a milestone's node sits (vw). */
const SIDE_X = 16;
/** Deterministic organic jitter, so the cluster reads hand-placed, not gridded.
 *  Horizontal in vw, vertical in percent of the (tall) section. */
const JITTER_X = 4;
const JITTER_Y = 1.5;

/** Which side of the timeline card `i` hangs on. `auto` alternates. */
export const bioSideSign = (side: BioCardInput["side"], i: number) =>
  side === "left" ? -1 : side === "right" ? 1 : i % 2 === 0 ? -1 : 1;

/**
 * The cluster's layout — the single source for where a milestone IS. The DOM
 * reads it to place the node, the card and the connector spline; the generators
 * below read it to work out where the head should swerve and look, and which side
 * to light from. One formula, so the cards and the gaze can never drift apart.
 */
export const bioCardAnchors = (cards: BioCardInput[]): BioCardAnchor[] => {
  const n = cards.length || 1;
  return cards.map((m, i) => {
    const sideSign = bioSideSign(m.side, i);
    const jitterX = (((i * 37) % 11) - 5) / 5; // -1..1
    const jitterY = (((i * 53) % 7) - 3) / 3; // -1..1
    return {
      ax: 50 + sideSign * SIDE_X + jitterX * JITTER_X + (m.offset?.x ?? 0),
      // Vertical anchor comes from the SHARED milestone layout, so a card, its 3D
      // set-piece bloom (`subReveal`) and every milestone-anchored keyframe all
      // land on the same scroll position.
      ay: bioMilestoneCenter(i, n) * 100 + jitterY * JITTER_Y + (m.offset?.y ?? 0),
      sideSign,
    };
  });
};

// ---------------------------------------------------------------------------
// Framing: the bridge between the DOM cards and the 3D head
// ---------------------------------------------------------------------------

/**
 * How this chapter is framed on the page. Both numbers derive from the live
 * section weights (registry.ts), so they are passed in at runtime rather than
 * baked in — reweighting a section re-derives the gaze with everything else.
 */
export interface BioFraming {
  /** Absolute scroll progress where the biography section starts. */
  start: number;
  /** The section's share of the whole scroll (its boundary span). */
  span: number;
  /** The document's height in viewport heights — i.e. the sum of every section's
   *  `weight`, since SectionHost gives each section `weight * 100vh`. */
  pageVh: number;
}

// The cards are DOM and the head is 3D, so the gaze needs exactly one bridge:
// where a card is ON SCREEN at the scroll position we are placing a keyframe at.
// That has a closed form.
//
// Progress is normalised over (document − one viewport), so
// `scrollTop = p * (pageVh − 1)` viewport-heights; and because every section is
// `weight * 100vh` tall, card j's document position is `pageVh * anchorP(j)`
// viewport-heights — its milestone anchor is literally the fraction of the page it
// sits at. Therefore (0 = top of the viewport, 1 = bottom):
//
//   screenY(p) = pageVh*anchorP − p*(pageVh − 1)
//              = anchorP + (anchorP − p) * (pageVh − 1)
//
// Two consequences, and both drive the numbers below:
//
//   • At its own beat (p == anchorP) a card sits `anchorP` down the viewport. With
//     the shipped weights that is ~28%..48% — i.e. ABOVE the head, which is
//     centred. `rotation.x > 0` looks DOWN, so tracking them wants a NEGATIVE
//     pitch (the last card creeps just below centre, and the formula flips the
//     sign on its own).
//   • Across its own window a card sweeps ~25% of the viewport upward, because the
//     page scrolls almost exactly as fast as the card rises. That is why the head
//     needs SEVERAL poses per card rather than one: `samplePose` eases every
//     adjacent pair with `power2.inOut`, so a single pose per card would leave the
//     head permanently mid-swing, and a two-pose one would race through the middle
//     of a motion that is linear in scroll. Sampling the card's real position lets
//     the eased track hold while a card dwells and put the swing in the gap.

/** Half the visible frame at the head, in world units. Scene3D's camera is a 45°
 *  (vertical) perspective and this chapter parks it at z ≈ 1.3 (registry.ts), so
 *  half-height = tan(22.5°) * 1.3 ≈ 0.54. Height is aspect-independent; the width
 *  assumes a wide (≈16:9) viewport, the same simplification skills.ts makes. */
const FRAME_HALF_H = 0.54;
const FRAME_HALF_W = 0.96;

/** The card body hangs OUTWARD from its node (`min(22rem, 38vw)` wide, 14px clear
 *  of the anchor — see BiographyCard.vue), so its visual centre is roughly this
 *  much further from the middle than the dot the connector passes through. The
 *  head should look at the card, not at the dot. */
const CARD_REACH_VW = 12;

/** World x of card `j`'s body centre, at the head's depth. */
const cardWorldX = (a: BioCardAnchor) =>
  ((a.ax - 50 + a.sideSign * CARD_REACH_VW) / 50) * FRAME_HALF_W;

/** World y of card `j` at gaze sample `u` of its own window — the screen-position
 *  identity above, mapped through the frame. Positive = above the head. */
const cardWorldY = (
  j: number,
  n: number,
  u: number,
  a: BioCardAnchor,
  frame: BioFraming
) => {
  const center = bioMilestoneCenter(j, n);
  const anchorP = frame.start + center * frame.span;
  // How far the scroll is from the card's own beat at sample `u`, and hence how
  // far the card has drifted up the viewport by then.
  const drift =
    (u - 0.5) * 2 * bioMilestoneHalfWindow(n) * frame.span * (frame.pageVh - 1);
  // The card's own jitter / frontmatter offset, converted from percent-of-section
  // into viewport heights (the section is `span * pageVh` viewports tall).
  const own = (a.ay / 100 - center) * frame.span * frame.pageVh;
  const screenY = anchorP - drift + own;
  return (1 - 2 * screenY) * FRAME_HALF_H;
};

// ---------------------------------------------------------------------------
// The swerve and the gaze
// ---------------------------------------------------------------------------
// Sign conventions, both taken from how Scene3D drives the head, and NOT
// symmetrical:
//   rotation.y > 0 → looking screen-RIGHT, and yaw 0 is FACE-ON (the model's own
//     crookedness is corrected once in Scene3D via `faceYaw`, so author around 0;
//     the finale's addressing pose turns
//     the head toward the CLI card on the right);
//   rotation.x > 0 → looking DOWN (the cursor-follow adds `mousePosition.y *
//     maxPitch`, and `mousePosition.y` is screen space, positive at the BOTTOM).

/**
 * How far the head swerves to the side OPPOSITE the centred card (world units).
 * The frame's half-width here is ~0.96 and the head is about half a world unit
 * wide, so ±0.46 pushes it decisively off-centre — clear of the card, which is on
 * the other side — while keeping the whole head in frame even on a 4:3 viewport.
 * Unlike the skills conveyor this chapter never cuts the head away: it holds
 * `opacity: 1` throughout and simply slides.
 */
export const HEAD_SWERVE_X = 0.46;

/** Widest head turn, radians (~35°) — past this it stops reading as a head. */
const GAZE_MAX_YAW = 0.62;
/** Relative offset (world units, card minus head) at which the turn saturates.
 *  The cards land ~0.95–1.07 out once the head has swerved away from them, so
 *  this keeps every card near — but never at — full yaw. */
const GAZE_REF_WORLD = 1.15;
/** Widest pitch, and the height at which it saturates. Small: the cards are only
 *  a few tenths above the head, and a big pitch reads as a nod, not a glance. */
const GAZE_MAX_PITCH = 0.14;
const GAZE_PITCH_REF_WORLD = 0.5;
/** The head's shipped resting yaw (stores/sections.ts DEFAULT_HEAD_YAW) — the pose
 *  it arrives from and returns to, so the interlude before and the skills chapter
 *  after both join seamlessly. */
const REST_YAW = 0.28;
/** How many poses per card (see the derivation above for why one or two is not
 *  enough). Fewer than the skills conveyor's 7: there the card crosses the whole
 *  stage during its beat, here it only creeps upward, so five samples already
 *  track it to within a fraction of a degree. */
const GAZE_SAMPLES = 5;
/** The middle share of a card's window the head actually dwells on it (0..1 of the
 *  window). The remainder is the swing across to the next card — 60/40 reads as
 *  "settle, look, turn" rather than a continuous sway. */
const GAZE_TRACK = 0.6;

/** Within-card position (0..1) of gaze sample `s`. */
const trackedU = (s: number) =>
  (1 - GAZE_TRACK) / 2 + (s / (GAZE_SAMPLES - 1)) * GAZE_TRACK;

/**
 * Where the head must point to be looking at a card at (cardX, cardY) from headX.
 *
 * Derived from the RELATIVE offset between card and head, not the card's absolute
 * position — because the head has moved too, and it moved AWAY from the card. The
 * turn it needs is therefore bigger than the card's own offset from centre, and
 * stays correct at any `HEAD_SWERVE_X`. Same reasoning as skills.ts's `gazeAt`.
 */
const gazeAt = (cardX: number, cardY: number, headX: number) => ({
  yaw: GAZE_MAX_YAW * clamp11((cardX - headX) / GAZE_REF_WORLD),
  // The head holds y = 0 through this chapter, so the card's world y IS the
  // relative offset. Negated: above the head → look UP → negative rotation.x.
  pitch: -GAZE_MAX_PITCH * clamp11(cardY / GAZE_PITCH_REF_WORLD),
});

const headKf = (
  t: number,
  x: number,
  yaw: number,
  pitch: number,
  milestone?: number
): HeadKeyframe => ({
  t,
  milestone,
  position: v3(x, 0, 0),
  rotation: v3(pitch, yaw, 0),
  // No fade anywhere in this chapter — the head stays in frame the whole way, so
  // there is never a return trip that has to happen unseen (contrast skills).
  opacity: 1,
});

/**
 * The head's track for this chapter: rest → swerve right and look back left at
 * card 0 → swing across to card 1 on the other side → … → rest.
 *
 * Card-anchored (`milestone`), not section-anchored, so every beat rides its card
 * as cards are added or removed — and so the dev panel's scenes tab shows which
 * card each keyframe belongs to.
 */
export const biographyHeadKeyframes = (
  cards: BioCardInput[],
  frame: BioFraming
): HeadKeyframe[] => {
  const anchors = bioCardAnchors(cards);
  const n = anchors.length;
  // Arrive from the interlude in the resting pose and leave for the skills chapter
  // in it. Not t:0 / t:1 — a section boundary is right-EXCLUSIVE in the store (see
  // `resolveAt` / `activeIndex`), so a keyframe at exactly 1 lands in the NEXT
  // section; 0.005/0.98 pin the pose inside this one.
  const kfs: HeadKeyframe[] = [headKf(0.005, 0, REST_YAW, 0)];
  for (let j = 0; j < n; j++) {
    const a = anchors[j]!;
    // Opposite the card: card on the left (-1) → head slides right (+x) and yaws
    // left (negative) to look back at it.
    const headX = -a.sideSign * HEAD_SWERVE_X;
    const cardX = cardWorldX(a);
    for (let s = 0; s < GAZE_SAMPLES; s++) {
      const u = trackedU(s);
      const g = gazeAt(cardX, cardWorldY(j, n, u, a, frame), headX);
      kfs.push(headKf(u, headX, g.yaw, g.pitch, j));
    }
  }
  kfs.push(headKf(0.98, 0, REST_YAW, 0));
  return kfs;
};

// ---------------------------------------------------------------------------
// The lights, on the same beats
// ---------------------------------------------------------------------------
// Duplicated rather than imported from spotlights.ts to keep the dependency
// one-way (spotlights.ts is the spine; this module generates into it).
/** Roughly the centre of the face, head-local (see spotlights.ts `FACE`). */
const FACE = v3(0, 0.06, 0.12);

/** The chapter's blue accent (registry.ts `biography.accent`). */
const KEY_COLOR = "#9ad1ff";
const FILL_COLOR = "#cfe6ff";
/** How much of the ACTIVE milestone's own frontmatter accent is mixed into the key
 *  light — a per-card nudge WITHIN the blue family, not a colour change.
 *  Deliberately shallow: half the accents are warm (#ffd479, #ff6b6b) and warm
 *  averaged with blue in sRGB passes straight through neutral grey, so a 0.3 mix
 *  visibly muddies the key on those beats while a 0.18 one only cools/warms it.
 *  The full accent still reads on the card itself, which is where it belongs. */
const KEY_ACCENT_MIX = 0.18;

/** Where the key sits relative to the head, on the CARD's side — so the face,
 *  already turned that way, is lit from the front rather than raked from behind.
 *  Expressed relative to the head, not to the world, because the head itself is
 *  sliding half a unit each beat. (Skills has no equivalent term any more — its
 *  head stays put, so `skillsSpotKeyframes` can swing the key about the origin.) */
const KEY_OFFSET_X = 1.25;
const KEY_Y = 0.45;
const KEY_Z = 0.7;
const KEY_INTENSITY = 12;

/** The fill counters it from past the head, on the side the head swerved to, so
 *  the shadow side never goes fully black as the key crosses over. */
const FILL_OFFSET_X = 0.3;
const FILL_Y = 0.3;
const FILL_Z = 0.78;
const FILL_INTENSITY = 6;

/**
 * Which gaze samples the lights get: the two ends of a card's dwell plus its
 * centre. A light needs fewer beats than the gaze because its pose has no
 * within-card dependence — it aims at a head-LOCAL target the rig re-resolves
 * against the head's live matrix every frame, so it only has to HOLD while a card
 * dwells and swing in the gap. Bracketing the dwell is exactly what does that.
 */
const SPOT_SAMPLES = [0, (GAZE_SAMPLES - 1) / 2, GAZE_SAMPLES - 1];

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Blend `t` of `b` into `a`, in plain sRGB. Good enough for a tint nudge — and it
 *  has to be plain TS here (no three.Color), since this module is imported by the
 *  spine, not by the canvas. */
const mixHex = (a: string, b: string | undefined, t: number): string => {
  const ca = hexToRgb(a);
  const cb = b ? hexToRgb(b) : null;
  if (!ca || !cb || t <= 0) return a;
  const ch = (i: number) =>
    Math.max(0, Math.min(255, Math.round(ca[i]! + (cb[i]! - ca[i]!) * t)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
};

/**
 * Key + fill keyframes for this chapter, on the same card anchors as the gaze — so
 * the head is always lit from the side its card is on and the light swings with
 * the turn instead of drifting against it. Written into the `key` / `fill` tracks
 * at runtime (see `useBiographyChoreography`), replacing the hand-placed biography
 * beats that used to live in spotlights.ts.
 */
export const biographySpotKeyframes = (
  cards: BioCardInput[]
): { key: SpotKeyframe[]; fill: SpotKeyframe[] } => {
  const anchors = bioCardAnchors(cards);
  const key: SpotKeyframe[] = [];
  const fill: SpotKeyframe[] = [];
  anchors.forEach((a, j) => {
    const headX = -a.sideSign * HEAD_SWERVE_X;
    const color = mixHex(KEY_COLOR, cards[j]?.accent, KEY_ACCENT_MIX);
    for (const s of SPOT_SAMPLES) {
      const t = trackedU(s);
      const centred = s === (GAZE_SAMPLES - 1) / 2;
      key.push({
        section: "biography",
        milestone: j,
        t,
        position: v3(headX + a.sideSign * KEY_OFFSET_X, KEY_Y, KEY_Z),
        target: FACE,
        intensity: KEY_INTENSITY,
        color,
        angle: 0.5,
        penumbra: 0.45,
        // A gentle scan only while the card is centred — the chapter's original
        // "the light visits the cards" flavour, without fighting the swing.
        ...(centred
          ? { effect: { type: "sweep", amount: 0.12, speed: 0.8 } as const }
          : {}),
      });
      fill.push({
        section: "biography",
        milestone: j,
        t,
        position: v3(headX - a.sideSign * FILL_OFFSET_X, FILL_Y, FILL_Z),
        target: FACE,
        intensity: FILL_INTENSITY,
        color: FILL_COLOR,
        angle: 0.6,
        penumbra: 0.7,
      });
    }
  });
  return { key, fill };
};
