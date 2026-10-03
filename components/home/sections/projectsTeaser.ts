import { CatmullRomCurve3, Vector3 } from "three";
import { frameHalfAt } from "~/lib/frame";
import type { HeadKeyframe } from "~/types/section";

/**
 * The projects chapter's shared geometry.
 *
 * Same contract as `biography.ts`: the 3D half and the DOM half read their
 * numbers from ONE module, so the cards and the thing they are supposed to be
 * growing on can never drift apart. Here that matters more than usual — the
 * cards are positioned by projecting these very points through the live camera,
 * so a second copy of the curve would show up as cards floating off the vine.
 */

/**
 * The vine's path through the scene, in world units with the head at the origin
 * (`HEAD_HALF` in lib/frame.ts: half-extents 0.305 x 0.378, and 0.295 deep).
 *
 * TWO full wraps, generated rather than hand-placed.
 *
 * The first version was eleven hand-written control points that went round once,
 * and going round twice by hand is a different kind of problem: every point has
 * to agree with the one a turn above it or the coil reads as a tangle instead of
 * a helix. So the body of the path is a real helix — `COIL_RX`/`COIL_RZ` around
 * the head, descending from `COIL_Y0` to `COIL_Y1` over `TURNS_AROUND` turns —
 * with a hand-placed tail at each end to carry it off frame.
 *
 * The radii are the interesting numbers. They have to CLEAR the head (0.305 wide,
 * 0.295 deep) or the coil intersects the skull, and they have to stay inside the
 * frame at this chapter's lens (±0.90 wide at z=0, but only ±0.59 at the front of
 * the coil, which is 0.42 nearer the camera). 0.46 / 0.42 is the band between
 * those two, and it is not very wide — which is the point, because a coil much
 * bigger than the head stops reading as being *around* the head at all.
 *
 * Each turn: right side → across the FRONT → left side → round the BACK. The
 * back half is why `SceneSetPieces` stamps the head into the depth buffer and
 * draws this piece depth-tested against it; without that pass the coil is a flat
 * spiral pasted over the face (which is exactly what it was until the layer
 * tagging there was fixed).
 *
 * WHERE IT ENDS is the part that was rethought. The vine used to leave the way
 * it came — a second tail out to off-frame right, mirroring the entry. It read
 * as the plant losing interest: two wraps of careful business around the head
 * and then it wanders off, while the one thing the chapter is FOR (the way
 * through to the full timeline) hung somewhere else entirely with its own
 * invented runner holding it up.
 *
 * So the tail comes round the front one last quarter-turn and DESCENDS, and the
 * point it descends to is where the card hangs. The vine does not pass the card
 * on its way somewhere; the card is what it grew into, and the curtain of
 * hanging growth in `ProjectVine` falls from that same last node.
 */
export const TURNS_AROUND = 2;
const COIL_RX = 0.46;
const COIL_RZ = 0.42;
const COIL_Y0 = 0.3;
const COIL_Y1 = -0.34;
/** Control points per turn. Twelve is plenty for Catmull-Rom to hold a circle. */
const COIL_STEPS = 12;

const buildControl = (): [number, number, number][] => {
  const pts: [number, number, number][] = [
    // In from off-frame right, behind the shoulder line.
    [1.95, 0.52, -0.44],
    [1.18, 0.42, -0.27],
    [0.73, 0.34, -0.12],
  ];
  const n = TURNS_AROUND * COIL_STEPS;
  for (let i = 0; i <= n; i++) {
    const th = (i / COIL_STEPS) * Math.PI * 2;
    const k = i / n;
    pts.push([
      Math.cos(th) * COIL_RX,
      COIL_Y0 + (COIL_Y1 - COIL_Y0) * k,
      Math.sin(th) * COIL_RZ,
    ]);
  }
  // ...one last quarter-turn across the front, and then straight down. The final
  // pair is deliberately a short vertical drop: the card hangs off the end of
  // it, and a card hanging off a slanted stem reads as caught on the vine
  // rather than as grown on it.
  pts.push([0.42, -0.42, 0.26]);
  pts.push([0.2, -0.53, 0.42]);
  pts.push([0.0, -0.62, 0.46]);
  pts.push([0.0, -0.74, 0.44]);
  return pts;
};

const CONTROL: [number, number, number][] = buildControl();

/**
 * The chapter's camera distance. Exported because the registry pose and the
 * fit test below have to be the same number — the test asks "is there room for
 * a card here", and the answer depends entirely on how far back the lens is.
 */
export const PROJECTS_CAM_Z = 1.22;

/**
 * The widest a bud's whole assembly gets, in CSS pixels. Read by the fit test.
 *
 * Not the text plate any more — a bud is a VESSEL now (a husk, a pod, a bloom;
 * see `TEASERS`) with the plate hung off it, and the thing that has to fit in
 * the frame is the pair. Each vessel is authored inside this box, so one number
 * still answers "is there room here".
 */
export const CARD_WIDTH_PX = 236;

/**
 * How far down a bud card the vine actually holds it, in CSS pixels.
 *
 * The scene anchors a card by THIS point rather than by its centre, because a
 * vessel is drawn standing on its own foot and the foot is what the stem holds.
 * Anchoring by the middle would move the whole plant up or down the stem
 * whenever a project's spec line wrapped.
 *
 * It is the height of `.art` in BudCard.vue, and the two have to agree.
 */
export const BUD_ANCHOR_PX = 104;

/** Roughly how far a card hangs BELOW its anchor — the plate. Used by the fit test. */
export const BUD_DROP_PX = 104;

/**
 * What buds on the vine, in bud order — the project, and the VESSEL it grew as.
 *
 * CURATED, not "the four newest". The timeline at /projects is the complete,
 * ordered record and can be trusted to be even-handed; this is a shop window,
 * and it should show the ones that are worth stopping for. Newest-first would
 * currently hand a bud to a file-sync utility over the vectorizer.
 *
 * Slugs are content file stems (`content/projects/<slug>.md`). A slug with no
 * file is skipped rather than blowing up. Order matters: entry `i` grows at
 * `CARD_T[i]`, so the list is read in the order the vine reaches its buds.
 *
 * The vessel is the interesting half. Identical plaques hanging off a plant
 * are a dropdown menu with leaves drawn on it: the vine does all the work and
 * the projects do none of it. So each bud grows as a different ORGAN, and each
 * organ is the one that project would have grown —
 *
 *   husk  — a ribbed lantern that splits to show the thing inside it. The CFOP
 *           trainer's whole pitch is "open the case in a cube you can turn", so
 *           what is inside the husk is a real, scrambled, turning cube.
 *   pod   — a legume that unzips along its seam and lets its seeds out in a
 *           row. Episko minds a flock of agent sessions; the seeds ARE the
 *           sessions, one of them running, one waiting on you.
 *   bloom — petals that open. LogoLab turns a picture into curves, so the
 *           petals open as bezier skeletons — anchors, handles, the lot — and
 *           only fill in once they are out.
 *   pitcher — the one organ in botany that is a HOLE. Putty Party keeps score
 *           for mini-golf, so the lid lifts, the pin and its flag rise out of
 *           the cup, and a ball keeps rolling in.
 *
 * `BudVessel` is the contract with `BudCard.vue`, which draws them.
 */
export type BudVessel = "husk" | "pod" | "bloom" | "pitcher";

export interface Teaser {
  slug: string;
  vessel: BudVessel;
}

export const TEASERS: readonly Teaser[] = [
  { slug: "speeden-and-cuben", vessel: "husk" },
  { slug: "episko", vessel: "pod" },
  { slug: "logolab", vessel: "bloom" },
  { slug: "puttyparty", vessel: "pitcher" },
];

let curve: CatmullRomCurve3 | null = null;

/** The vine, built once. */
export const vineCurve = () => {
  if (!curve) {
    curve = new CatmullRomCurve3(
      CONTROL.map(([x, y, z]) => new Vector3(x, y, z)),
      false,
      "catmullrom",
      0.5
    );
  }
  return curve;
};

/**
 * How many stations the vine is sampled into.
 *
 * This is not just "enough to read as a curve". The stem is a ROPE — a core with
 * three strands wound around it (`TURNS` in ProjectVine) — and the sample count
 * sets the resolution of that helix; below about 20 samples per twist the
 * strands read as a zigzag rather than a braid.
 *
 * It is also the resolution of the parallel-transported frame every leaf,
 * tendril and branch is placed in. Raised with the second wrap: the path went
 * from 5.4 units to 8.7, so holding the same twist density costs proportionally
 * more stations. The cost is one static buffer built at module load, not
 * per-frame work.
 */
export const VINE_SAMPLES = 1280;

/**
 * Where along the vine a card buds, 0..1.
 *
 * Not hand-picked — found by scanning the curve for stations that satisfy all
 * three constraints at once, at 16:9, 16:10, 3:2 and 4:3:
 *
 *   1. `z > 0.10`, so the bud is on a FRONT pass. A bud on the back half is
 *      hidden by the very depth pass that makes the coil read as a coil, and
 *      its card would hang in space attached to nothing.
 *   2. clear of the head's silhouette (`HEAD_HALF` plus a margin), so a 196px
 *      card does not land on the face.
 *   3. room for that card inside the frame AT ITS OWN DEPTH — the front of the
 *      coil is 0.42 nearer the lens than the middle, where the frame is only
 *      ±0.59 wide instead of ±0.90.
 *
 * The scan returns exactly four viable windows, one per quarter-turn where the
 * vine comes round the front, and all four are used. They alternate sides
 * (right, left, right, left) and span both turns, so the second wrap is visibly
 * a second wrap and not a repeat of the first.
 *
 * The numbers moved when the tail was rebuilt to descend into the card, and NOT
 * because the buds did: `t` here is arc length, so shortening the curve from
 * 8.728 to 8.067 units re-scales every station on it. These three are the same
 * three POINTS as before — (0.410, 0.277, 0.184), (-0.413, 0.163, 0.184),
 * (0.367, -0.053, 0.252) — found again on the new parameterisation.
 *
 * The fourth is the middle of the last window (0.6785..0.7005), at
 * (-0.416, -0.158, 0.179): lower left, on the second turn's left-hand pass.
 */
export const CARD_T = [0.2197, 0.3441, 0.5745, 0.6895] as const;

/** Preallocated: these are read every frame by the projection. */
const buds = CARD_T.map((t) => vineCurve().getPointAt(t));
export const budAt = (i: number) => buds[i]!;

/**
 * Where the vine stops climbing and starts falling, 0..1 along it.
 *
 * Everything the chapter's last act is made of is measured from these two. The
 * descent is the stretch after `TAIL_T`; `hangPoint` is its end, which is both
 * the tip of the plant and the ring the card hangs from — they are the same
 * point on purpose, because that is the whole idea: the vine grew into the link.
 *
 * `TAIL_T` is not hand-tuned. It is where the helix stops and the hand-placed
 * descent takes over, measured off the curve so it follows the control points
 * if they are ever moved.
 */
const findTailStart = () => {
  const c = vineCurve();
  const end = new Vector3(
    Math.cos(TURNS_AROUND * Math.PI * 2) * COIL_RX,
    COIL_Y1,
    Math.sin(TURNS_AROUND * Math.PI * 2) * COIL_RZ
  );
  const p = new Vector3();
  let best = 0.88;
  let bd = Infinity;
  for (let i = 0; i <= 4000; i++) {
    const t = 0.6 + (i / 4000) * 0.4;
    const d = c.getPointAt(t, p).distanceToSquared(end);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
};

export const TAIL_T = findTailStart();
const hang = vineCurve().getPointAt(1);
/** The vine's last point — the node the card hangs from. */
export const hangPoint = () => hang;

/**
 * Can this viewport actually hold every card pinned to the vine?
 *
 * A card is a big object in this world: the frame here is only about 1.8 units
 * wide and the head takes the middle of it, so on anything much narrower than
 * a laptop the cards either overlap the face or leave the frame entirely. That
 * is not a tuning problem — a portrait phone's frame is less than half as wide
 * in world units while the card grows as a FRACTION of it.
 *
 * So the pinning is conditional, and the section falls back to reading as an
 * ordinary stacked list when the answer is no. Measured against the same lens
 * the scene renders with (`frameHalfAt`), which is why that helper exists.
 */
export const cardsFitFrame = (aspect: number, vpWidthPx: number) => {
  const vpHeightPx = vpWidthPx / (aspect || 1);
  return CARD_T.every((_, i) => {
    const p = budAt(i);
    const { w, h } = frameHalfAt(aspect, PROJECTS_CAM_Z - p.z);
    const halfCard = (CARD_WIDTH_PX / 2 / vpWidthPx) * 2 * w;
    // Vertically the card is LOPSIDED — the vessel stands above the anchor and
    // the plate hangs below it — so the two directions are measured separately.
    // The flat ±0.06 this used to carry was a stand-in for a card that was all
    // plate and no plant; a husk is nearly twice as tall as the plate under it,
    // and on a short laptop screen the old figure happily pinned a bud whose
    // lantern was half out of frame.
    const up = (BUD_ANCHOR_PX / vpHeightPx) * 2 * h;
    const down = (BUD_DROP_PX / vpHeightPx) * 2 * h;
    return (
      Math.abs(p.x) + halfCard < w * 0.97 &&
      p.y + up < h * 0.98 &&
      p.y - down > -h * 0.98
    );
  });
};

/**
 * The bridge between the scene and the DOM.
 *
 * The cards live in the page's DOM (real, readable, crawlable text) but are
 * positioned from inside the canvas: `ProjectVine` projects each bud through
 * the LIVE camera and writes the transform straight onto these nodes.
 *
 * Deliberately a plain module array rather than a store or a provide: this is
 * a per-frame write, and routing it through reactivity is exactly what the
 * scroll engine was refactored to stop doing. Reading the real camera (rather
 * than recomputing the pose from scroll) is also what keeps the cards attached
 * during explore mode, where a free camera overrides the scroll poses.
 */
export const cardEls: (HTMLElement | null)[] = CARD_T.map(() => null);

export const registerCard = (i: number, el: HTMLElement | null) => {
  cardEls[i] = el;
};

/**
 * The label hanging off the vine's last node, registered the same way a bud
 * card is.
 *
 * It is a link, so it is real DOM like the cards — but unlike them it is
 * anchored by its TOP: the eyelet at the top of the label has to land on the
 * stem it hangs from, not the label's middle, or it reads as a sticker over the
 * vine rather than as something suspended from it.
 */
export const labelEl: { el: HTMLElement | null } = { el: null };

export const registerLabel = (el: HTMLElement | null) => {
  labelEl.el = el;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/**
 * The chapter's two clocks.
 *
 * `vineDrawT` is how much of the VINE is drawn; `curtainT` is how far the
 * hanging growth that falls off its end has fallen. They are separate on
 * purpose, and the bug that made them separate is worth keeping written down:
 * with one clock, the curtain was scheduled at the very top of the `drawT`
 * range, which is the only place it can be — it hangs off the vine's LAST
 * point. There is no room up there. The boughs opened while the tip was still
 * a tenth of the curve short of the node they spring from, so the whole crown
 * hung in mid-air below a stem that had not arrived yet.
 *
 * So the acts are laid end to end instead, each with its own share of the
 * section's scroll:
 *
 *   0 → COIL_ENDS      the coil. 88.5% of the curve's arc length, and the four
 *                      cards bud along it. Walked at a steady rate: the buds are
 *                      spaced by arc length, so anything but a straight line
 *                      here bunches them.
 *   → STEM_ENDS        the descent. The last 11.5% of the curve — nothing in arc
 *                      terms, a whole beat in scroll terms, because it is where
 *                      the vine leaves the head and the camera goes after it.
 *   → CURTAIN_ENDS     the fall. The stem is finished; now the crown springs off
 *                      its end and the strands hang down from it.
 *
 * Everything after `CURTAIN_ENDS` is the hold — the chapter's only still frame,
 * and the one the visitor is meant to act in.
 *
 * The descent is SHORT, and it is short because of what the camera is doing
 * over the top of it. The camera starts down as the coil finishes and settles
 * as the curtain is falling; if the stem takes too long to land, the camera
 * arrives at an empty frame and waits there for the crown to appear. Six
 * hundredths of the section is enough to read the drop and not enough to leave
 * a hole in it.
 *
 * Three other things are timed against these numbers and have to move with
 * them: the camera keyframes in registry.ts (which descend during the descent
 * and climb back at the end), the head track below, and `weight` in registry.ts,
 * which is what turns these fractions into actual scroll.
 */
const COIL_ENDS = 0.48;
const STEM_ENDS = 0.54;
const CURTAIN_ENDS = 0.68;

export const vineDrawT = (localT: number) => {
  const t = clamp01(localT);
  if (t <= COIL_ENDS) return (t / COIL_ENDS) * TAIL_T;
  const k = clamp01((t - COIL_ENDS) / (STEM_ENDS - COIL_ENDS));
  // Eased over its last third only: the tip slows into the node it is going to
  // hang the card from, instead of arriving at full speed and stopping.
  const e = k < 0.66 ? k : 0.66 + 0.34 * easeOutCubic((k - 0.66) / 0.34);
  return TAIL_T + (1 - TAIL_T) * e;
};

/** How far the hanging growth has fallen, 0..1. Zero until the stem lands. */
export const curtainT = (localT: number) =>
  clamp01((clamp01(localT) - STEM_ENDS) / (CURTAIN_ENDS - STEM_ENDS));

/**
 * When the label has finished dropping, in `curtainT` units.
 *
 * Late, and after the curtain is well underway: the label is the last thing to
 * arrive, into growth that is already there to receive it.
 */
export const LABEL_OPEN = 0.92;

/** Where the growing tip is at section-local progress `localT`. */
export const vineTipAt = (localT: number, out = new Vector3()) =>
  vineCurve().getPointAt(clamp01(vineDrawT(localT)), out);

/**
 * The head watches the vine grow.
 *
 * Not a hand-authored swerve any more — the track is GENERATED by asking
 * `vineTipAt` where the growing tip is at each of `GAZE_KEYS` stations and
 * turning the head toward it. So the gaze cannot drift from the thing it is
 * watching: change the path, the twist, or the growth curve, and the head
 * follows automatically.
 *
 * Aimed from the tip's `x` alone, deliberately, rather than by a real look-at.
 * `atan2(x, z)` is the honest formula and it is unusable here: the vine passes
 * directly BEHIND the head twice, and there the angle jumps between +π and −π,
 * which is a head spinning round on its neck between two frames. Driving off
 * `x` through a `tanh` gives the one behaviour a neck can actually perform —
 * right at the right side, forward as the vine crosses the face, left at the
 * left side, and forward again as it goes round the back, where it has simply
 * lost sight of it. Twice, once per wrap.
 *
 * `GAZE_REACH` is the offset at which the turn is ~76% of the way to its limit,
 * so the head is already looking off-frame right at the start, waiting for the
 * vine to arrive.
 */
const TAU = Math.PI * 2;

/**
 * How far the head nods. Tracking the tip honestly would swing this ±34° at the
 * coil, which reads as the whole head bobbing; 0.62 keeps the cue and the clamp
 * stops the extremes.
 */
const GAZE_PITCH_SCALE = 0.55;
const GAZE_MAX_PITCH = 0.35;
/** How closely the played-back track must hold the true aim, in radians (~1.7°). */
const GAZE_TOL = 0.03;
/** A ceiling on the refinement, so the dev panel never gets an unusable list. */
const GAZE_MAX_KEYS = 64;
/** How long the head takes to pick up / put down the vertical part of the track. */
const GAZE_PITCH_IN = 0.04;
const GAZE_PITCH_OUT = 0.07;

/** Reused by the sampling loop below; the track is built once, at module load. */
const gazeScratch = new Vector3();

const smooth01 = (u: number) => {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
};

/**
 * The head notices the vine, follows it round exactly once, and gives up.
 *
 * Tracking from the top of the chapter was wrong, and obviously so once it was
 * on screen: at t=0 the tip is still off frame to the right, so the head opened
 * the chapter staring into the middle distance at nothing. It also never
 * stopped — two wraps meant two full turns, and the second one added nothing the
 * first had not already said.
 *
 * So the track has a beginning and an end, both picked from the geometry:
 *
 *   LOCK — the first station where the tip crosses the FRONT of the face
 *   (`x` through zero while `z > 0`). That instant is free: the aim there is
 *   dead ahead, which is exactly where the head already is, so tracking can
 *   start with no jump and no anticipatory swing. The vine passes in front of
 *   it and it follows — which is the reading we were after anyway.
 *
 *   RELEASE — exactly one turn of yaw later. Because a turn is a whole number
 *   of revolutions the head finishes facing dead ahead again, so letting go
 *   costs nothing either. It sits there while the vine completes its second
 *   wrap unwatched.
 *
 * Yaw is clamped to that single turn rather than gated, so nothing ever scales a
 * wound angle toward zero — that would BE the unwind this design avoids. Pitch
 * carries no winding, so it can be eased in at the lock and out at the release
 * like any ordinary channel.
 */
const buildGazeTrack = (): HeadKeyframe[] => {
  const N = 900;
  const rawYaw: number[] = [];
  const rawPitch: number[] = [];
  const xs: number[] = [];
  const zs: number[] = [];
  let wind = 0;
  let prev = 0;
  for (let i = 0; i <= N; i++) {
    const p = vineTipAt(i / N, gazeScratch);
    const a = Math.atan2(p.x, p.z);
    if (i > 0) {
      const d = a - prev;
      if (d > Math.PI) wind -= TAU;
      else if (d < -Math.PI) wind += TAU;
    }
    prev = a;
    rawYaw.push(a + wind);
    rawPitch.push(-Math.atan2(p.y, Math.hypot(p.x, p.z)));
    xs.push(p.x);
    zs.push(p.z);
  }

  let lock = 0;
  for (let i = 1; i <= N; i++) {
    if (zs[i]! > 0 && xs[i - 1]! > 0 && xs[i]! <= 0) {
      lock = i;
      break;
    }
  }
  let release = N;
  for (let i = lock; i <= N; i++) {
    if (rawYaw[lock]! - rawYaw[i]! >= TAU) {
      release = i;
      break;
    }
  }

  const clampPitch = (v: number) =>
    v < -GAZE_MAX_PITCH ? -GAZE_MAX_PITCH : v > GAZE_MAX_PITCH ? GAZE_MAX_PITCH : v;
  const inSpan = Math.max(1, N * GAZE_PITCH_IN);
  const outSpan = Math.max(1, N * GAZE_PITCH_OUT);
  const pitchAtRelease = clampPitch(rawPitch[release]! * GAZE_PITCH_SCALE);

  /**
   * ...and then it looks DOWN, and then it lets go.
   *
   * The track used to ease the pitch back to level after the release and leave
   * the head staring at the middle distance for the rest of the chapter — which
   * was right while nothing happened down there. The vine now leaves the head
   * entirely: it drops off the bottom of the coil into the hanging growth, and
   * the camera goes down after it. A head that ignores its own plant walking
   * out of frame is the tell that the two halves of this chapter were built at
   * different times.
   *
   * Aimed at the node, not at a hand-picked angle, so it follows the card if
   * the card moves. Only pitch: the descent ends on the CENTRE line, so there
   * is no yaw to add — which is also why the wound turn can still discharge
   * cleanly at t=1 below.
   *
   * And then it comes back to level. Not cosmetic: the camera climbs back to
   * the biography's own pose over this chapter's last quarter (see the camera
   * track in registry.ts), so whatever the head is doing at t=1 is the pose the
   * next chapter opens on. It has to be nothing.
   */
  const hp = hangPoint();
  const glancePitch = clampPitch(
    -Math.atan2(hp.y, Math.hypot(hp.x, hp.z)) * GAZE_PITCH_SCALE
  );
  // Where the tip reaches the node, and where the camera has finished climbing
  // back — both in the raw-progress units this loop walks.
  const glanceTo = Math.max(release + outSpan, Math.round(STEM_ENDS * N));
  const levelAt = Math.round(0.9 * N);

  const yaw: number[] = [];
  const pitch: number[] = [];
  for (let i = 0; i <= N; i++) {
    if (i <= lock) {
      yaw.push(0);
      pitch.push(0);
    } else if (i <= release) {
      // Decreasing, and held the moment a whole turn is done.
      yaw.push(Math.max(-TAU, rawYaw[i]! - rawYaw[lock]!));
      pitch.push(clampPitch(rawPitch[i]! * GAZE_PITCH_SCALE) * smooth01((i - lock) / inSpan));
    } else {
      yaw.push(-TAU);
      const down =
        pitchAtRelease +
        (glancePitch - pitchAtRelease) * smooth01((i - release) / (glanceTo - release));
      pitch.push(
        i <= glanceTo
          ? down
          : down * (1 - smooth01((i - glanceTo) / Math.max(1, levelAt - glanceTo)))
      );
    }
  }

  // Seeded with the structural stations, then refined wherever the straight line
  // between neighbours is furthest from the truth — in EITHER channel, because
  // the pitch does all of its work in stretches where the yaw is flat and would
  // otherwise get no keyframes at all.
  const marks = [0, lock, release, glanceTo, levelAt, N].filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
  while (marks.length < GAZE_MAX_KEYS) {
    let worst = 0;
    let worstAt = -1;
    for (let j = 0; j < marks.length - 1; j++) {
      const a = marks[j]!;
      const b = marks[j + 1]!;
      for (let i = a + 1; i < b; i++) {
        const k = (i - a) / (b - a);
        const err = Math.max(
          Math.abs(yaw[a]! + (yaw[b]! - yaw[a]!) * k - yaw[i]!),
          Math.abs(pitch[a]! + (pitch[b]! - pitch[a]!) * k - pitch[i]!)
        );
        if (err > worst) {
          worst = err;
          worstAt = i;
        }
      }
    }
    if (worstAt < 0 || worst <= GAZE_TOL) break;
    marks.push(worstAt);
    marks.sort((x, y) => x - y);
  }

  const keys: HeadKeyframe[] = marks.map((i) => ({
    t: i / N,
    // A little lean into the turn, from the tip's side of the frame.
    position: { x: 0.03 * Math.tanh(Math.sin(yaw[i]!) * 1.5), y: 0, z: 0 },
    rotation: { x: pitch[i]!, y: yaw[i]!, z: 0 },
    linear: true,
  }));

  // The discharge: same `t`, so the one wound turn steps back to its equivalent
  // without the sampler ever visiting the angles in between.
  const last = keys[keys.length - 1]!;
  keys.push({
    t: 1,
    position: { x: 0, y: 0, z: 0 },
    rotation: {
      x: last.rotation.x,
      y: last.rotation.y - TAU * Math.round(last.rotation.y / TAU),
      z: 0,
    },
    linear: true,
  });
  return keys;
};

export const projectsHeadKeyframes: HeadKeyframe[] = buildGazeTrack();
