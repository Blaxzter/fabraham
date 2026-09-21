<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watchEffect } from "vue";
import { useWindowSize } from "@vueuse/core";
import { useLoop, useTresContext } from "@tresjs/core";
import { CatmullRomCurve3, Vector3 } from "three";
import type { Camera, Group } from "three";
import {
  approach,
  clamp01,
  createDots,
  createFatLines,
  drawFatFraction,
  mulberry32,
  setDotScale,
  smoothstep,
  type SetPieceProps,
} from "./lineArt";
import {
  buildLeafShape,
  LEAF_FLOATS,
  LEAF_SEGMENTS,
  writeLeaf,
  type LeafShape,
} from "./foliage";
import {
  BUD_ANCHOR_PX,
  budAt,
  CARD_T,
  cardEls,
  curtainT,
  hangPoint,
  LABEL_OPEN,
  labelEl,
  PROJECTS_CAM_Z,
  VINE_SAMPLES,
  vineCurve,
  vineDrawT,
} from "../sections/projectsTeaser";

/**
 * The projects chapter's backdrop: a vine that comes in off-frame right, coils
 * once around the head, and leaves — budding a card at each of three points.
 *
 * Structurally this is `Lattice` with a curve instead of a cloud: the same
 * line-art vocabulary, the same `cardProgress`-driven assembly, and the same
 * depth-occluded layer (registered in `SceneSetPieces`), which is what lets the
 * head actually hide the stretch that passes behind it.
 *
 * It also does one thing no other set-piece does: it POSITIONS DOM. The three
 * cards are real HTML in the page, and this component projects each bud through
 * the live camera every frame and writes the transform onto them. Reading the
 * real camera rather than re-deriving the pose from scroll is deliberate — it
 * keeps the cards welded to the vine in explore mode, where a free camera
 * overrides the scroll poses entirely.
 *
 * What it is made of, and why each part is there
 * ----------------------------------------------
 * The first version was ONE polyline with two straight ribs per node. At this
 * chapter's lens that is a 1px hairline wrapping a head 1.2 units wide — the
 * head won, and the "vine" read as a stray wire with thorns. Everything below
 * is aimed at the opposite reading: a living plant with mass.
 *
 *   ROPE     — a core plus three strands wound around it (`STRANDS`/`TURNS`),
 *              plus bark ticks weaving between the strands. Four thin lines
 *              braiding at a 16px radius read as one thick stem, where one
 *              thick line would just read as a cable. The rope tapers toward
 *              the growing tip, so the plant has a direction.
 *   LEAVES   — real blades (see ./foliage.ts), placed by phyllotaxis so they
 *              splay around the stem in 3D instead of lying in one plane. They
 *              unfurl — rolled up along the midrib, widening as they mature —
 *              once the growing tip has passed them, then breathe on a wave
 *              that travels the vine.
 *   TENDRILS — corkscrews springing off the stem between leaves, uncoiling
 *              behind the tip. Pure character; a vine without them is a rope.
 *   ROSETTES — six oversized leaves around each card's bud, sized per bud so
 *              all three read the same on screen despite sitting at different
 *              depths. The card nests in them.
 *   POLLEN   — motes drifting in the air around the drawn part of the vine,
 *              plus sparks shedding off the growing tip.
 *   SAP      — the chapter's recurring EVENT (see the set-piece notes in
 *              docs/scroll-3d-architecture.md): a bright pulse runs the stem on
 *              its own clock and flares each bud as it passes.
 *   CURTAIN  — the chapter's last act. Past `TAIL_T` the vine leaves the head
 *              and descends; at its last point a few boughs spring out and a
 *              curtain of strands hangs from them, each drawing itself
 *              DOWNWARD. The way through to /projects hangs off the same point
 *              as a label — DOM, positioned exactly the way the cards are —
 *              and the camera goes down after all of it (see the camera track
 *              in ../sections/registry.ts), so the finale has the frame to
 *              itself with the head out of shot.
 *
 * Everything is preallocated. The only per-frame allocation-free writes are the
 * open leaves (~7k floats), the motes and the sap band; the rope, the bark and
 * the tendrils are static buffers revealed with `setDrawRange`.
 */
const props = withDefaults(defineProps<SetPieceProps>(), {
  reveal: 0,
  variant: "",
  position: () => [0, 0, 0],
  cardProgress: undefined,
});

const { reducedMotion } = usePreferences();
const { pointer } = usePointer();
const { camera, renderer } = useTresContext();
const group = shallowRef<Group | null>(null);

const TAU = Math.PI * 2;
const ACCENT = "#00ff9c";
/**
 * The stem's body colour, and the one number here that is easy to get wrong.
 *
 * Everything in this layer is ADDITIVE. A thick line in the chapter's accent
 * with fine strands in a second bright green wound over it does not read as a
 * lit stem, it reads as WHITE — the two simply sum past the top of the range
 * wherever they overlap, which is everywhere along a hugging helix. The first
 * fat-line pass did exactly that and turned the vine into a neon tube.
 *
 * Mass in an additive layer comes from a DIM body with BRIGHT detail over it:
 * the core is a deep green that only fills the silhouette, and the winds are
 * the accent, so the braid reads as highlights catching on a solid thing.
 */
const STEM_BODY = "#0c7d55";
const WOOD = "#16c48c";
const BLADE = "#63f2c0";
const POLLEN = "#b7ffe6";
const SAP = "#e8fff6";

const curve = vineCurve();
const N = VINE_SAMPLES;
/**
 * Parallel-transported, not Frenet-in-the-textbook-sense: three's
 * `computeFrenetFrames` carries the first normal along the curve rather than
 * recomputing it from curvature, so the frame never flips where the vine
 * straightens out. Everything that has to sit ON the stem — every strand of the
 * rope, every leaf, every tendril — is placed in this frame, which is why they
 * wind together instead of each twisting to its own idea of "up".
 */
const frames = curve.computeFrenetFrames(N, false);
const idxAt = (t: number) => Math.max(0, Math.min(N, Math.round(t * N)));

const rnd = mulberry32(20260920);
/** Stable per-index jitter, independent of how many `rnd()` draws precede it. */
const rnd0 = (i: number) => mulberry32(9173 + i * 2657)();

// ── The rope ────────────────────────────────────────────────────────────────
/**
 * The stem is a thick CORE with fine strands wound around it, drawn with
 * `createFatLines` — real pixel widths, not the 1px hairline WebGL gives a
 * `LineBasicMaterial` (see the note on that factory in ./lineArt.ts).
 *
 * The first pass at this had no fat lines available and braided four equal
 * hairlines at a 19px radius to fake thickness. It worked, in the sense that a
 * wide loose braid does read as thicker than one thread, but what it actually
 * drew was a rope of four threads with daylight between them. With a real
 * width the shape is the botanically honest one: one solid stem, with the
 * winds pulled in close to hug it and give it grain.
 */
const STRANDS = 3;
/** Wraps of each strand over the vine's ~8.7 units — one turn per ~0.14u. */
const TURNS = 62;

/** CSS pixels. The core carries the mass; the winds are grain over it. */
const CORE_PX = 8;
const WIND_PX = 1.8;

/**
 * How far the winds sit off the core.
 *
 * Has to clear the core's own half-width or the spiral is buried inside the
 * body and all it contributes is brightness. At 0.014 the winds swing about
 * ±10px against a 4px half-core, so they cross the silhouette and read as a
 * twist.
 */
const stemRadius = (t: number) => 0.014 - 0.007 * t;

/** Centreline and strand points, kept because the leaves and sap re-read them. */
const core = new Float32Array((N + 1) * 3);
const strands: Float32Array[] = [];
for (let k = 0; k < STRANDS; k++) strands.push(new Float32Array((N + 1) * 3));
{
  const p = new Vector3();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    curve.getPointAt(t, p);
    core.set([p.x, p.y, p.z], i * 3);
    const nrm = frames.normals[i]!;
    const bin = frames.binormals[i]!;
    const r = stemRadius(t);
    for (let k = 0; k < STRANDS; k++) {
      const a = t * TURNS * TAU + (k / STRANDS) * TAU;
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      strands[k]!.set(
        [
          p.x + nrm.x * c + bin.x * s,
          p.y + nrm.y * c + bin.y * s,
          p.z + nrm.z * c + bin.z * s,
        ],
        i * 3
      );
    }
  }
}

// Two fields, because `linewidth` is a material uniform and the core and the
// winds are different weights. Both are emitted in sample order, so the same
// `drawT` walks them together and the stem grows as one object.
const corePos = new Float32Array(N * 6);
const windPos = new Float32Array(N * STRANDS * 6);
{
  let co = 0;
  let wo = 0;
  for (let i = 0; i < N; i++) {
    corePos[co++] = core[i * 3]!;
    corePos[co++] = core[i * 3 + 1]!;
    corePos[co++] = core[i * 3 + 2]!;
    corePos[co++] = core[(i + 1) * 3]!;
    corePos[co++] = core[(i + 1) * 3 + 1]!;
    corePos[co++] = core[(i + 1) * 3 + 2]!;
    for (let k = 0; k < STRANDS; k++) {
      const a = strands[k]!;
      windPos[wo++] = a[i * 3]!;
      windPos[wo++] = a[i * 3 + 1]!;
      windPos[wo++] = a[i * 3 + 2]!;
      windPos[wo++] = a[(i + 1) * 3]!;
      windPos[wo++] = a[(i + 1) * 3 + 1]!;
      windPos[wo++] = a[(i + 1) * 3 + 2]!;
    }
  }
}
const stem = createFatLines(corePos, { color: STEM_BODY, opacity: 0, width: CORE_PX });
const winds = createFatLines(windPos, { color: ACCENT, opacity: 0, width: WIND_PX });

// Bark: short ties from one strand to the next, a few samples further on. They
// close the gaps between the strands into something woody instead of leaving
// four parallel threads.
const BARK_EVERY = 9;
const BARK_SKEW = 4;
const barkStations = Math.floor((N - BARK_SKEW) / BARK_EVERY);
const barkPos = new Float32Array(barkStations * STRANDS * 6);
{
  let o = 0;
  for (let s = 0; s < barkStations; s++) {
    const i = s * BARK_EVERY;
    for (let k = 0; k < STRANDS; k++) {
      const a = strands[k]!;
      const b = strands[(k + 1) % STRANDS]!;
      barkPos[o++] = a[i * 3]!;
      barkPos[o++] = a[i * 3 + 1]!;
      barkPos[o++] = a[i * 3 + 2]!;
      barkPos[o++] = b[(i + BARK_SKEW) * 3]!;
      barkPos[o++] = b[(i + BARK_SKEW) * 3 + 1]!;
      barkPos[o++] = b[(i + BARK_SKEW) * 3 + 2]!;
    }
  }
}
const bark = createFatLines(barkPos, { color: WOOD, opacity: 0, width: 1.8 });

// ── Leaves ──────────────────────────────────────────────────────────────────
/** Three profiles, so a field of sixty blades is not one sticker repeated. */
const SHAPES: LeafShape[] = [
  buildLeafShape(0.34, 1.0, 0.1),
  buildLeafShape(0.27, 1.35, 0.14),
  buildLeafShape(0.42, 0.8, 0.07),
];

/**
 * Leaves on the hanging growth, which runs on `curtainT` rather than `drawT`.
 *
 * A blade carries the clock it is scheduled against in its `bud` field, because
 * that field already distinguishes a stem leaf from a rosette leaf and this is
 * the same question asked once more. Without it the curtain's foliage — whose
 * `t` values are 0..1 in a completely different unit — unfurls the moment the
 * vine's own draw passes the same number, which is right at the start of the
 * chapter, in mid-air, where the curtain is not yet.
 */
const CURTAIN = -2;

/**
 * When a blade begins to unfurl, as a sort key for `leaves`.
 *
 * The render loop draws the open blades as a PREFIX of the buffer, so this has
 * to be a single ordering across both clocks. The curtain's are offset past 1
 * — past anything the vine's own clock can reach — because they are, in fact,
 * last: nothing on the curtain opens until the vine has finished growing.
 */
const openStartOf = (leaf: Leaf) =>
  leaf.bud === CURTAIN ? 1 + leaf.t : leaf.bud < 0 ? leaf.t : CARD_T[leaf.bud]! - 0.01;

interface Leaf {
  t: number;
  origin: Vector3;
  U: Vector3;
  V: Vector3;
  W: Vector3;
  shape: LeafShape;
  len: number;
  droop: number;
  phase: number;
  /**
   * `CURTAIN` for a blade on the hanging growth (scheduled on `curtainT`), -1
   * for a leaf on the vine itself, otherwise the card whose bud it belongs to.
   */
  bud: number;
}

const STEM_LEAVES = 112;
const ROSETTE = 6;
/** The golden angle — successive leaves land 137.5° round the stem. */
const PHYLLO = Math.PI * (3 - Math.sqrt(5));
const leaves: Leaf[] = [];

/**
 * Build one leaf's frame on a stem — the MAIN stem or a branch.
 *
 * `ang` rolls it around the stem; `pitch` swings it from standing straight out
 * of the stem (0) to lying flat along it (π/2), so the stem leaves' ~0.5-0.9
 * points them away AND forward, the way a climbing plant carries them, while
 * the rosettes' ~0.2 opens them as a collar square to the stem. `V` stays
 * tangential, which puts the stem's axis in the blade's own plane.
 *
 * `openT` is the only thing tying a leaf to a schedule: the value of `drawT` at
 * which it starts to unfurl. For a leaf on the main stem that is simply its own
 * position along the curve. For a leaf on a branch it is the branch's origin
 * plus how far up the branch the leaf sits — which is what makes a branch's
 * foliage open in step with the branch drawing itself, with no extra machinery.
 */
const leafOn = (
  openT: number,
  P: Vector3,
  tan: Vector3,
  nrm: Vector3,
  bin: Vector3,
  radius: number,
  ang: number,
  pitch: number,
  shape: LeafShape,
  len: number,
  droop: number,
  phase: number,
  bud: number
): Leaf => {
  const radial = new Vector3()
    .addScaledVector(nrm, Math.cos(ang))
    .addScaledVector(bin, Math.sin(ang));
  const lateral = new Vector3()
    .addScaledVector(nrm, -Math.sin(ang))
    .addScaledVector(bin, Math.cos(ang));
  const origin = P.clone().addScaledVector(radial, radius * 0.9);
  const U = new Vector3()
    .addScaledVector(radial, Math.cos(pitch))
    .addScaledVector(tan, Math.sin(pitch))
    .normalize();
  const V = lateral.clone();
  const W = new Vector3().crossVectors(U, V).normalize();
  return { t: openT, origin, U, V, W, shape, len, droop, phase, bud };
};

/** `leafOn`, reading the point and frame off the main curve at `t`. */
const makeLeaf = (
  t: number,
  ang: number,
  pitch: number,
  shape: LeafShape,
  len: number,
  droop: number,
  phase: number,
  bud: number
): Leaf => {
  const i = idxAt(t);
  const nrm = frames.normals[i]!;
  const bin = frames.binormals[i]!;
  const tan = frames.tangents[i]!;
  const radial = new Vector3()
    .addScaledVector(nrm, Math.cos(ang))
    .addScaledVector(bin, Math.sin(ang));
  const lateral = new Vector3()
    .addScaledVector(nrm, -Math.sin(ang))
    .addScaledVector(bin, Math.cos(ang));
  const origin = new Vector3(core[i * 3]!, core[i * 3 + 1]!, core[i * 3 + 2]!).addScaledVector(
    radial,
    stemRadius(t) * 0.9
  );
  const U = new Vector3()
    .addScaledVector(radial, Math.cos(pitch))
    .addScaledVector(tan, Math.sin(pitch))
    .normalize();
  const V = lateral.clone();
  const W = new Vector3().crossVectors(U, V).normalize();
  return { t, origin, U, V, W, shape, len, droop, phase, bud };
};

/**
 * Blade size, partly corrected for depth.
 *
 * The vine's loop runs from z ≈ -0.52 behind the head to z ≈ +0.44 in front of
 * it, so the near stretch is drawn at more than twice the scale of the far one.
 * Left alone, an identical leaf reads as 78px at the back and 209px at the
 * front, and the front of the vine turns into a hedge. Fully correcting it
 * (the exponent at 1) would be wrong too — near things ARE bigger, and killing
 * that flattens the coil. 0.6 keeps the depth cue and loses the hedge.
 */
const leafDepth = (t: number) =>
  Math.pow((PROJECTS_CAM_Z - core[idxAt(t) * 3 + 2]!) / 1.5, 0.6);

// Stem leaves. Skipped near a bud, where the rosette already fills the frame.
for (let i = 0; i < STEM_LEAVES; i++) {
  const t = 0.02 + (i / STEM_LEAVES) * 0.96 + (rnd() - 0.5) * 0.008;
  if (CARD_T.some((c) => Math.abs(c - t) < 0.028)) continue;
  leaves.push(
    makeLeaf(
      t,
      PHYLLO * i,
      0.52 + rnd() * 0.42,
      SHAPES[i % SHAPES.length]!,
      // Tapering with the stem, so the young end of the vine carries young
      // leaves. Roughly 45-95px on screen: a blade around half the width of a
      // card. The first pass ran to 145px with a third as many of them, which
      // read as a handful of big flat cut-outs stuck to a wire rather than as
      // foliage — density does more for "leafy" than size does.
      (0.046 + rnd() * 0.031) * (1.25 - 0.45 * t) * leafDepth(t),
      0.18 + rnd() * 0.22,
      rnd() * TAU,
      -1
    )
  );
}

/**
 * How much bigger a bud's decoration is drawn, so that all three read the same
 * size on screen.
 *
 * The three buds sit at very different depths (the last is 1.5× closer to the
 * lens than the first), and a rosette authored in world units would therefore
 * be half again as big on the card nearest the camera. Scaling by distance
 * cancels the perspective divide.
 */
const budScale = CARD_T.map((_, i) => (PROJECTS_CAM_Z - budAt(i).z) / 1.5);
for (let b = 0; b < CARD_T.length; b++) {
  const t = CARD_T[b]!;
  for (let k = 0; k < ROSETTE; k++) {
    leaves.push(
      makeLeaf(
        t,
        (k / ROSETTE) * TAU + b * 0.7,
        // Nearly square to the stem: the rosette opens like a collar around
        // the bud rather than trailing off along the vine.
        0.16 + (k % 2) * 0.1,
        SHAPES[k % SHAPES.length]!,
        // Half what it was, and the reason is that the bud is no longer empty.
        // The rosette used to BE the decoration at a bud — six oversized blades
        // filling the space a small plaque sat in the middle of. A husk, a pod
        // or a bloom now stands in that space (BudCard.vue), and six blades at
        // the old size do not frame it, they tangle with it: same colour, same
        // weight, same line vocabulary, drawn straight through it. What is
        // wanted here is a CALYX — the collar a fruit sits in — so it is sized
        // to be read as the thing under the vessel rather than as the vessel.
        (0.052 + (k % 3) * 0.011) * budScale[b]!,
        0.22,
        rnd() * TAU,
        b
      )
    );
  }
}

// ── Branches ────────────────────────────────────────────────────────────────
/**
 * Side shoots that leave the main stem and grow on their own.
 *
 * A single coil, however thick, is still one line — the plant has no structure,
 * only a path. Branches are what make it read as something that GREW rather than
 * something that was drawn: each one leaves the stem at a station, arcs outward
 * and up, droops at the tip, and carries its own leaves.
 *
 * They are built as their own little curves so they get their own
 * parallel-transported frame, which is what lets their foliage be placed with
 * exactly the same code as the main stem's (`leafOn`).
 *
 * The schedule is the neat part and costs nothing: a branch draws over
 * `BRANCH_GROW` of stem travel once the main tip passes its origin, and each of
 * its leaves is given an `openT` of "my branch's origin, plus how far up the
 * branch I sit". So a branch unrolls and leafs out in one motion, driven by the
 * same `drawT` as everything else and reversible on scroll-up like everything
 * else.
 */
const BRANCHES = 6;
const BRANCH_SAMPLES = 46;
const BRANCH_STRANDS = 2;
/** Stem travel one branch takes to draw. Shorter than the gap between them. */
const BRANCH_GROW = 0.075;
const BRANCH_LEAVES = 6;
const branchT: number[] = [];

const branchCorePos = new Float32Array(BRANCHES * BRANCH_SAMPLES * 6);
const branchWindPos = new Float32Array(BRANCHES * BRANCH_SAMPLES * BRANCH_STRANDS * 6);
{
  const up = new Vector3(0, 1, 0);
  const radial = new Vector3();
  const U = new Vector3();
  const a = new Vector3();
  const b = new Vector3();
  let co = 0;
  let wo = 0;
  for (let i = 0; i < BRANCHES; i++) {
    // Spread along the coil, away from the buds so a branch never grows through
    // a card.
    const t = 0.16 + (i / BRANCHES) * 0.66 + (rnd() - 0.5) * 0.02;
    branchT.push(t);
    const idx = idxAt(t);
    const P = new Vector3(core[idx * 3]!, core[idx * 3 + 1]!, core[idx * 3 + 2]!);
    const tan = frames.tangents[idx]!;
    // Outward from the COIL's vertical axis, not from the stem's own normal —
    // that is what sends a branch away from the head instead of into it.
    radial.set(P.x, 0, P.z);
    if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
    radial.normalize();
    const lift = 0.2 + rnd() * 0.45;
    U.copy(radial).addScaledVector(up, lift).addScaledVector(tan, 0.3).normalize();
    const side = new Vector3().crossVectors(U, up).normalize();
    const bend = new Vector3().crossVectors(side, U).normalize();
    const len = 0.26 + rnd() * 0.2;
    // Four points: out, rising, still rising, then the tip falls away under its
    // own weight. Catmull-Rom through them gives the arc a real shoulder.
    const curveB = new CatmullRomCurve3(
      [
        P.clone(),
        P.clone().addScaledVector(U, len * 0.34).addScaledVector(bend, len * 0.1),
        P.clone().addScaledVector(U, len * 0.72).addScaledVector(bend, len * 0.13),
        P.clone().addScaledVector(U, len).addScaledVector(bend, -len * 0.04),
      ],
      false,
      "catmullrom",
      0.5
    );
    const fb = curveB.computeFrenetFrames(BRANCH_SAMPLES, false);
    const r = (s: number) => (0.0075 - 0.0045 * s) * (0.85 + 0.3 * rnd0(i));
    // Core + a thinner twist, same vocabulary as the trunk.
    for (let k = 0; k <= BRANCH_SAMPLES; k++) {
      curveB.getPointAt(k / BRANCH_SAMPLES, k === 0 ? a : b);
      if (k > 0) {
        branchCorePos.set([a.x, a.y, a.z, b.x, b.y, b.z], co);
        co += 6;
        a.copy(b);
      }
    }
    for (let k = 0; k < BRANCH_SAMPLES; k++) {
      for (let w = 0; w < BRANCH_STRANDS; w++) {
        for (let e = 0; e < 2; e++) {
          const kk = k + e;
          const sN = kk / BRANCH_SAMPLES;
          curveB.getPointAt(sN, e === 0 ? a : b);
          const nn = fb.normals[kk]!;
          const bb = fb.binormals[kk]!;
          const ang = sN * 9 * TAU + (w / BRANCH_STRANDS) * TAU;
          const rr = r(sN);
          const tgt = e === 0 ? a : b;
          tgt.addScaledVector(nn, Math.cos(ang) * rr).addScaledVector(bb, Math.sin(ang) * rr);
        }
        branchWindPos.set([a.x, a.y, a.z, b.x, b.y, b.z], wo);
        wo += 6;
      }
    }
    // Foliage, opening as the branch draws past each leaf.
    for (let k = 0; k < BRANCH_LEAVES; k++) {
      const sN = 0.2 + (k / BRANCH_LEAVES) * 0.74;
      const bi = Math.round(sN * BRANCH_SAMPLES);
      leaves.push(
        leafOn(
          t + sN * BRANCH_GROW * 0.9,
          curveB.getPointAt(sN, new Vector3()),
          fb.tangents[Math.min(BRANCH_SAMPLES, bi)]!,
          fb.normals[Math.min(BRANCH_SAMPLES, bi)]!,
          fb.binormals[Math.min(BRANCH_SAMPLES, bi)]!,
          r(sN),
          PHYLLO * k + i,
          0.5 + rnd() * 0.4,
          SHAPES[(i + k) % SHAPES.length]!,
          (0.05 + rnd() * 0.028) * leafDepth(t),
          0.2 + rnd() * 0.2,
          rnd() * TAU,
          -1
        )
      );
    }
  }
}
const branchStem = createFatLines(branchCorePos, {
  color: STEM_BODY,
  opacity: 0,
  width: 4.2,
});
const branchWinds = createFatLines(branchWindPos, {
  color: ACCENT,
  opacity: 0,
  width: 1.4,
});

// ── The hanging growth ──────────────────────────────────────────────────────
/**
 * Where the vine stops climbing and starts FALLING.
 *
 * The chapter used to end with the coil sliding off frame right and a pill
 * marked "All 16 projects" floating over the middle of nothing — a button in a
 * scene that has no buttons in it. The handoff is the one thing this chapter
 * exists to earn, so it gets an act rather than an afterthought.
 *
 * The first version of that act grew a bush UPWARD out of a root below the
 * frame, which was the wrong direction twice over. It fought the vine, whose
 * whole motion is downward by then; and it fought /projects, which opens by
 * drawing its own growth down the page (see `GrowthBush.vue` there, spilling
 * off the chart's baseline like ivy off a wall). So this falls: a few boughs
 * spring off the vine's last node, and a curtain of strands hangs from them,
 * each drawing itself downward from where it is attached.
 *
 * Built from the same parts as everything else here — a core with winds over
 * it, blades from ./foliage.ts placed in the stem's own transported frame — so
 * it is recognisably the same plant rather than a second piece of art that
 * happens to be green.
 *
 * ORDER MATTERS in this file: the leaves are pushed into the shared `leaves`
 * array, which is sorted by open time a few lines below. Growing this after
 * that sort would leave its blades unsorted in a buffer the render loop draws
 * as a prefix, and they would simply never appear.
 */
const NODE = hangPoint();

const BOUGHS = 6;
const BOUGH_SAMPLES = 28;
const BOUGH_STRANDS = 2;
const BOUGH_LEAVES = 3;
/**
 * The crown and the curtain are scheduled on `curtainT`, NOT on `drawT`.
 *
 * They hang off the vine's last point, so on the vine's own clock there is no
 * room to schedule them: anything before 1 puts them below a tip that has not
 * arrived. `curtainT` starts where `vineDrawT` finishes — see the note on the
 * chapter's two clocks in ../sections/projectsTeaser.ts.
 *
 * Boughs first and overlapping, strands after and staggered wider, so the crown
 * springs out and the curtain then falls through it.
 */
const BOUGH_GROW = 0.17;
const BOUGH_SPAN = 0.26;

const FALLS = 26;
const FALL_SAMPLES = 32;
const FALL_LEAVES = 4;
const FALL_GROW = 0.13;
const FALL_FIRST = 0.2;
const FALL_SPAN = 0.62;

const boughT: number[] = [];
const strandT: number[] = [];
const boughCorePos = new Float32Array(BOUGHS * BOUGH_SAMPLES * 6);
const boughWindPos = new Float32Array(BOUGHS * BOUGH_SAMPLES * BOUGH_STRANDS * 6);
const fallPos = new Float32Array(FALLS * FALL_SAMPLES * 6);

/** Where each hanging strand is tied on, filled by the bough pass below. */
interface Anchor {
  p: Vector3;
  /** The `drawT` at which the bough had drawn this far. */
  at: number;
  /** Which way the strand drifts as it falls — away from the node. */
  side: number;
}
const anchors: Anchor[] = [];

{
  const a = new Vector3();
  const b = new Vector3();
  for (let i = 0; i < BOUGHS; i++) {
    // Alternating sides, reaching further with each pair, so the crown fills
    // outward rather than sweeping across.
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    const reach = 0.23 + rank * 0.11;
    // They rise a little before they droop. A bough that only ever falls is a
    // cable; the shoulder is what makes it read as something holding weight.
    const lift = 0.055 - rank * 0.014;
    const dz = (rnd() - 0.5) * 0.15;
    const openT = (i / BOUGHS) * BOUGH_SPAN;
    boughT.push(openT);
    const curveB = new CatmullRomCurve3(
      [
        NODE.clone(),
        NODE.clone().add(new Vector3(side * reach * 0.34, lift * 0.9, dz * 0.3)),
        NODE.clone().add(new Vector3(side * reach * 0.72, lift * 0.5, dz * 0.7)),
        NODE.clone().add(new Vector3(side * reach, -lift * 1.5, dz)),
      ],
      false,
      "catmullrom",
      0.5
    );
    const fb = curveB.computeFrenetFrames(BOUGH_SAMPLES, false);
    const r = (s: number) => (0.0095 - 0.005 * s) * (0.85 + 0.3 * rnd0(i));
    let co = i * BOUGH_SAMPLES * 6;
    let wo = i * BOUGH_SAMPLES * BOUGH_STRANDS * 6;
    for (let j = 0; j < BOUGH_SAMPLES; j++) {
      curveB.getPointAt(j / BOUGH_SAMPLES, a);
      curveB.getPointAt((j + 1) / BOUGH_SAMPLES, b);
      boughCorePos.set([a.x, a.y, a.z, b.x, b.y, b.z], co);
      co += 6;
      for (let w = 0; w < BOUGH_STRANDS; w++) {
        for (let e = 0; e < 2; e++) {
          const kk = j + e;
          const sN = kk / BOUGH_SAMPLES;
          curveB.getPointAt(sN, e === 0 ? a : b);
          const nn = fb.normals[kk]!;
          const bb = fb.binormals[kk]!;
          const ang = sN * 6 * TAU + (w / BOUGH_STRANDS) * TAU;
          const rr = r(sN);
          (e === 0 ? a : b)
            .addScaledVector(nn, Math.cos(ang) * rr)
            .addScaledVector(bb, Math.sin(ang) * rr);
        }
        boughWindPos.set([a.x, a.y, a.z, b.x, b.y, b.z], wo);
        wo += 6;
      }
    }
    for (let j = 0; j < BOUGH_LEAVES; j++) {
      const sN = 0.28 + (j / BOUGH_LEAVES) * 0.6;
      const bi = Math.min(BOUGH_SAMPLES, Math.round(sN * BOUGH_SAMPLES));
      leaves.push(
        leafOn(
          openT + sN * BOUGH_GROW * 0.9,
          curveB.getPointAt(sN, new Vector3()),
          fb.tangents[bi]!,
          fb.normals[bi]!,
          fb.binormals[bi]!,
          r(sN),
          PHYLLO * j + i,
          0.5 + rnd() * 0.35,
          SHAPES[(i + j) % SHAPES.length]!,
          0.042 + rnd() * 0.026,
          0.24 + rnd() * 0.2,
          rnd() * TAU,
          CURTAIN
        )
      );
    }
    // Four strands hang off each bough, plus two straight off the node — see
    // the fall pass below.
    for (let j = 0; j < 4; j++) {
      const sN = 0.3 + (j / 4) * 0.66 + (rnd() - 0.5) * 0.06;
      anchors.push({
        p: curveB.getPointAt(Math.min(1, sN), new Vector3()),
        at: openT + sN * BOUGH_GROW,
        side,
      });
    }
  }
  anchors.push({ p: NODE.clone().add(new Vector3(-0.03, -0.01, 0.03)), at: 0, side: -1 });
  anchors.push({ p: NODE.clone().add(new Vector3(0.035, -0.012, -0.02)), at: 0, side: 1 });
}

/**
 * The curtain.
 *
 * Emitted TOP TO BOTTOM within each strand, which is the whole reason the
 * draw-on works: `drawFatFraction` reveals segments in buffer order, so a
 * strand written from its tie downward grows downward, and nothing has to know
 * about gravity.
 *
 * They are sorted by the moment they start so the same accumulate-and-floor
 * trick the branches use gives an exact instance count — and so the curtain
 * fills in from the node outward rather than in whatever order the boughs
 * happened to be built.
 */
anchors.sort((x, y) => x.at - y.at);
{
  const a = new Vector3();
  const b = new Vector3();
  let o = 0;
  for (let i = 0; i < Math.min(FALLS, anchors.length); i++) {
    const an = anchors[i]!;
    const openT = FALL_FIRST + (i / FALLS) * FALL_SPAN;
    strandT.push(openT);
    // Wide spread on purpose: strands of one length hang as a fringe, and a
    // fringe is a curtain rail rather than a plant.
    const len = 0.17 + Math.pow(rnd(), 0.75) * 0.46;
    // Drift outward as it falls, so the curtain widens toward the bottom
    // instead of hanging as a set of parallels.
    const sway = an.side * (0.015 + rnd() * 0.085);
    const jz = (rnd() - 0.5) * 0.06;
    const hook = rnd() < 0.55 ? (rnd() < 0.5 ? 1 : -1) * 0.03 : 0;
    const pts = [
      an.p.clone(),
      an.p.clone().add(new Vector3(sway * 0.5, -len * 0.3, jz * 0.4)),
      an.p.clone().add(new Vector3(sway, -len * 0.66, jz * 0.9)),
      an.p.clone().add(new Vector3(sway * 0.65, -len, jz * 0.5)),
    ];
    if (hook) {
      // A tip that turns back on itself. A strand ending in a straight line is
      // a wire; this is the same gesture the tendrils on the coil make.
      pts.push(an.p.clone().add(new Vector3(sway * 0.65 + hook, -len - 0.016, jz * 0.5)));
      pts.push(an.p.clone().add(new Vector3(sway * 0.65 + hook * 0.4, -len - 0.004, jz * 0.5)));
    }
    const curveF = new CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    const fb = curveF.computeFrenetFrames(FALL_SAMPLES, false);
    for (let j = 0; j < FALL_SAMPLES; j++) {
      curveF.getPointAt(j / FALL_SAMPLES, a);
      curveF.getPointAt((j + 1) / FALL_SAMPLES, b);
      fallPos.set([a.x, a.y, a.z, b.x, b.y, b.z], o);
      o += 6;
    }
    for (let j = 0; j < FALL_LEAVES; j++) {
      const sN = 0.18 + (j / FALL_LEAVES) * 0.72;
      const bi = Math.min(FALL_SAMPLES, Math.round(sN * FALL_SAMPLES));
      leaves.push(
        leafOn(
          openT + sN * FALL_GROW * 0.9,
          curveF.getPointAt(sN, new Vector3()),
          fb.tangents[bi]!,
          fb.normals[bi]!,
          fb.binormals[bi]!,
          0.004,
          PHYLLO * j + i * 1.7,
          // Nearly square to the strand and drooping: a leaf on something that
          // hangs points down and out, not up along it.
          0.22 + rnd() * 0.25,
          SHAPES[(i + j) % SHAPES.length]!,
          0.032 + rnd() * 0.024,
          0.3 + rnd() * 0.24,
          rnd() * TAU,
          CURTAIN
        )
      );
    }
  }
}

const boughStems = createFatLines(boughCorePos, { color: STEM_BODY, width: 4.4 });
const boughWinds = createFatLines(boughWindPos, { color: ACCENT, width: 1.3 });
const fallField = createFatLines(fallPos, { color: WOOD, width: 2.5 });

/**
 * The eyelet the label hangs from, and the pool of light it hangs in.
 *
 * Two dots at one point, exactly the pattern the buds use: a small hot one that
 * reads as the node itself, and a wide soft one so the label sits in light
 * rather than floating over the dark.
 */
const hookField = createDots(1, { color: ACCENT, hot: "#ffffff" });
const hookAura = createDots(1, { color: ACCENT });
{
  hookField.position.set([NODE.x, NODE.y, NODE.z], 0);
  hookAura.position.set([NODE.x, NODE.y, NODE.z], 0);
  hookField.flush({ position: true, size: true, glow: true });
  hookAura.flush({ position: true, size: true, glow: true });
}

/**
 * Sorted by WHEN each blade starts to open.
 *
 * Not cosmetic: it makes the set of open leaves a prefix of the buffer, which is
 * what lets the unopened remainder be excluded with an instance count instead of
 * being written somewhere harmless. See the note in the render loop — with fat
 * lines there is no harmless somewhere.
 */
leaves.sort((a, b) => openStartOf(a) - openStartOf(b));

const leafPos = new Float32Array(leaves.length * LEAF_FLOATS);
// The instance count is driven per frame from how many blades have opened — see
// the note in the render loop for why an unopened one may not simply be parked.
const leafField = createFatLines(leafPos, { color: BLADE, opacity: 0, width: 2 });

// ── Tendrils ────────────────────────────────────────────────────────────────
const TENDRILS = 15;
const TENDRIL_SEGS = 30;
/** How much stem travel one tendril takes to uncoil. Shorter than their spacing. */
const TENDRIL_GROW = 0.05;
const tendrilT: number[] = [];
const tendrilPos = new Float32Array(TENDRILS * TENDRIL_SEGS * 6);
{
  const a = new Vector3();
  const b = new Vector3();
  const axis = new Vector3();
  const p1 = new Vector3();
  const p2 = new Vector3();
  let o = 0;
  for (let i = 0; i < TENDRILS; i++) {
    const t = 0.05 + (i / TENDRILS) * 0.9 + (rnd() - 0.5) * 0.012;
    tendrilT.push(t);
    const idx = idxAt(t);
    const nrm = frames.normals[idx]!;
    const bin = frames.binormals[idx]!;
    const tan = frames.tangents[idx]!;
    const ang = rnd() * TAU;
    axis
      .set(0, 0, 0)
      .addScaledVector(nrm, Math.cos(ang))
      .addScaledVector(bin, Math.sin(ang))
      .addScaledVector(tan, 0.45)
      .normalize();
    // Two vectors spanning the plane the corkscrew turns in.
    p1.crossVectors(axis, tan).normalize();
    if (!isFinite(p1.x) || p1.lengthSq() < 0.1) p1.crossVectors(axis, nrm).normalize();
    p2.crossVectors(axis, p1).normalize();
    const origin = new Vector3(core[idx * 3]!, core[idx * 3 + 1]!, core[idx * 3 + 2]!);
    const len = 0.1 + rnd() * 0.07;
    const coil = 0.018 + rnd() * 0.014;
    const turns = 2.2 + rnd() * 1.2;
    const dir = rnd() < 0.5 ? 1 : -1;
    // A tendril reaches before it grips: straight for the first third, then it
    // coils. `smoothstep` on the radius is what draws that transition.
    const at = (s: number, out: Vector3) => {
      const r = coil * smoothstep(0.22, 0.82, s);
      const ang2 = dir * s * turns * TAU;
      out
        .copy(origin)
        .addScaledVector(axis, len * Math.pow(s, 0.62))
        .addScaledVector(p1, Math.cos(ang2) * r)
        .addScaledVector(p2, Math.sin(ang2) * r);
    };
    for (let s = 0; s < TENDRIL_SEGS; s++) {
      at(s / TENDRIL_SEGS, a);
      at((s + 1) / TENDRIL_SEGS, b);
      tendrilPos.set([a.x, a.y, a.z, b.x, b.y, b.z], o);
      o += 6;
    }
  }
}
const tendrils = createFatLines(tendrilPos, { color: ACCENT, opacity: 0, width: 2.2 });

// ── Sap ─────────────────────────────────────────────────────────────────────
// A bright band copied out of the rope's own buffer and walked along it. Copied
// rather than recoloured because the rope is one geometry with one material —
// this is the cheapest way to light a moving window of it.
const SAP_SAMPLES = 34;
const sapPos = new Float32Array(SAP_SAMPLES * 6);
const sapField = createFatLines(sapPos, { color: SAP, opacity: 0, width: 3.4 });
const SAP_PERIOD = 7.5;

// ── Buds, aura and pollen ───────────────────────────────────────────────────
/**
 * A note on dot sizes, because this file got them wrong once and it was not
 * visible as a mistake.
 *
 * `createDots` inherits three's `sizeAttenuation` convention:
 * `gl_PointSize = size * (height / 2) / distance`. So `size` is NOT a world
 * radius, and it is not pixels either — at this chapter's lens and a 1080-tall
 * canvas, one unit of `size` is about 360px. The buds were authored at **26**,
 * which asks for a nine-THOUSAND pixel sprite; what saved it was the driver
 * clamping to `ALIASED_POINT_SIZE_RANGE`, which meant the three buds rendered
 * as blobs of whatever maximum the visitor's GPU happened to have. Every dot
 * here is now sized against that 360px-per-unit figure.
 *
 * `budScale` (∝ distance) cancels the perspective divide on top of it, so a bud
 * is the same size on screen whichever of the three it is.
 */
// One glowing point where each card hangs...
const budField = createDots(CARD_T.length, { color: ACCENT, hot: "#ffffff", opacity: 0 });
// ...and a wide, soft one behind it, so the card sits in a pool of light rather
// than floating over the scene on its own.
const auraField = createDots(CARD_T.length, { color: ACCENT, opacity: 0 });
{
  const p = new Vector3();
  for (let i = 0; i < CARD_T.length; i++) {
    p.copy(budAt(i));
    budField.position.set([p.x, p.y, p.z], i * 3);
    auraField.position.set([p.x, p.y, p.z], i * 3);
    budField.size[i] = 0.1 * budScale[i]!;
    budField.glow[i] = 0.3;
    auraField.size[i] = 0.78 * budScale[i]!;
  }
  budField.flush({ position: true, size: true, glow: true });
  auraField.flush({ position: true, size: true, glow: true });
}

/**
 * The curve station closest to a point, as a 0..1 fraction.
 *
 * Brute force over the centreline samples, which is 1281 distance checks per
 * call and runs once at module load for 150 motes — nothing worth a spatial
 * index. Squared distances only; the actual distance is never needed.
 */
const nearestOnStem = (x: number, y: number, z: number) => {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= N; i++) {
    const dx = core[i * 3]! - x;
    const dy = core[i * 3 + 1]! - y;
    const dz = core[i * 3 + 2]! - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best / N;
};

const MOTES = 150;
const SPARKS = 14;
/** The sap bead rides the last slot. */
const BEAD = MOTES + SPARKS;
const moteField = createDots(MOTES + SPARKS + 1, {
  color: POLLEN,
  hot: "#ffffff",
  opacity: 0,
});
const moteT = new Float32Array(MOTES);
const moteHome = new Float32Array(MOTES * 3);
const moteRise = new Float32Array(MOTES);
const moteSpan = new Float32Array(MOTES);
const moteSize = new Float32Array(MOTES);
const motePhase = new Float32Array(MOTES);
const moteWob = new Float32Array(MOTES);
{
  const p = new Vector3();
  for (let m = 0; m < MOTES; m++) {
    const t = rnd();
    curve.getPointAt(t, p);
    const i = idxAt(t);
    const nrm = frames.normals[i]!;
    const bin = frames.binormals[i]!;
    // Scattered in the stem's own normal plane, so the cloud hugs the vine's
    // shape instead of filling a box around it.
    const a = rnd() * TAU;
    const r = 0.05 + Math.pow(rnd(), 0.7) * 0.34;
    const hx = p.x + nrm.x * Math.cos(a) * r + bin.x * Math.sin(a) * r;
    const hy = p.y + nrm.y * Math.cos(a) * r + bin.y * Math.sin(a) * r;
    const hz = p.z + nrm.z * Math.cos(a) * r + bin.z * Math.sin(a) * r;
    moteHome.set([hx, hy, hz], m * 3);
    moteRise[m] = 0.035 + rnd() * 0.055;
    const span = 0.2 + rnd() * 0.3;
    moteSpan[m] = span;
    // A mote appears once the vine has reached every stem it will EVER sit
    // beside — not the station it was scattered from, and not even the one it
    // rests against.
    //
    // Two things conspire here, and each was a separate bug. The scatter offset
    // is up to 0.39 units while the coil's turns pass within about 0.32 of each
    // other, so a mote scattered from one turn routinely comes to rest against
    // the NEXT one; gating on the scatter station lit 8% of them ahead of their
    // own neighbourhood, the worst by 0.36 of the whole vine. Fixing that left a
    // second, subtler version of the same mistake: the mote does not stay where
    // it rests, it rises and falls through `span` every cycle, and at the far
    // end of that travel it is beside different stem again. Gating on the
    // resting point still left four or five specks at a time hanging past the
    // growing tip, the worst more than half a vine ahead.
    //
    // So the gate is the LATEST station along the whole drift path. It is
    // conservative — a mote can be withheld while the vine is beside where it
    // happens to be right now — but the failure it prevents is the visible one:
    // a speck lit in empty space, waiting for a vine that has not arrived.
    let gate = 0;
    for (let k = 0; k <= 4; k++) {
      gate = Math.max(gate, nearestOnStem(hx, hy + (k / 4 - 0.5) * span, hz));
    }
    moteT[m] = gate;
    moteSize[m] = 0.012 + Math.pow(rnd(), 2) * 0.026;
    motePhase[m] = rnd();
    moteWob[m] = 0.4 + rnd() * 0.9;
  }
}
const sparkDir = new Float32Array(SPARKS * 3);
const sparkPhase = new Float32Array(SPARKS);
for (let s = 0; s < SPARKS; s++) {
  const a = rnd() * TAU;
  const z = rnd() * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  sparkDir.set([Math.cos(a) * r, Math.sin(a) * r, z], s * 3);
  sparkPhase[s] = rnd();
}
moteField.size[BEAD] = 0.075;
moteField.glow[BEAD] = 1;

onBeforeUnmount(() => {
  stem.dispose();
  winds.dispose();
  branchStem.dispose();
  branchWinds.dispose();
  boughStems.dispose();
  boughWinds.dispose();
  fallField.dispose();
  hookField.dispose();
  hookAura.dispose();
  bark.dispose();
  leafField.dispose();
  tendrils.dispose();
  sapField.dispose();
  budField.dispose();
  auraField.dispose();
  moteField.dispose();
  // Let go of the cards, or a stale transform sticks after a hot reload.
  for (let i = 0; i < cardEls.length; i++) {
    const el = cardEls[i];
    if (el) el.style.opacity = "0";
  }
  if (labelEl.el) labelEl.el.style.opacity = "0";
});

// ── Per-frame ───────────────────────────────────────────────────────────────
const ndc = new Vector3();
const world = new Vector3();
const tip = new Vector3();
const lv = new Vector3();
const lw = new Vector3();
/** Skip the DOM writes entirely once the chapter is off screen. */
let wroteHidden = false;
/** How far each card has opened. Preallocated — this is read every frame. */
const born = new Float32Array(CARD_T.length);
/**
 * How close the sap pulse is to each bud, 0..1 — handed to the DOM as `--sap`.
 *
 * The buds already flare when the pulse reaches them; the cards hanging off
 * those buds did not, which made them the only part of the chapter the plant's
 * own circulation did not reach. One number per bud, written as a custom
 * property, lets each vessel answer it in its own terms.
 */
const sapNear = new Float32Array(CARD_T.length);

/**
 * Where a card's own box sits relative to the bud it hangs on.
 *
 * Not its centre: a bud card is a VESSEL standing on its foot with a name plate
 * hanging under it, and the foot is what the stem holds. See `BUD_ANCHOR_PX`.
 */
const CARD_ANCHOR = `translate(-50%, -${BUD_ANCHOR_PX}px)`;

/**
 * Take a node out of the page without unmounting it.
 *
 * `visibility` as well as opacity, because these are LINKS: an anchor faded to
 * zero is still in the tab order, so a keyboard visitor scrolling past this
 * chapter would otherwise collect four invisible stops. `visibility: hidden`
 * takes it out of the tab order and costs nothing, since a card at opacity 0 is
 * already showing nothing.
 */
const park = (el: HTMLElement | null | undefined) => {
  if (!el) return;
  el.style.opacity = "0";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
};

/**
 * Hand a projected point to a DOM node.
 *
 * `anchor` is where the node's own box sits relative to that point: cards hang
 * ON their bud and are centred on it, the shield hangs FROM its ring and so is
 * centred horizontally but starts at it.
 */
const placeEl = (
  el: HTMLElement,
  p: Vector3,
  cam: Camera,
  w: number,
  h: number,
  grown: number,
  fade: number,
  sap: number,
  anchor: string
) => {
  ndc.copy(p).project(cam);
  // Behind the camera: `project` mirrors such a point back into frame, so
  // without this the card reappears on the far side of the screen.
  const o = ndc.z > 1 ? 0 : grown * fade;
  el.style.transform = `translate3d(${((ndc.x * 0.5 + 0.5) * w).toFixed(1)}px, ${(
    (-ndc.y * 0.5 + 0.5) *
    h
  ).toFixed(1)}px, 0) ${anchor}`;
  el.style.opacity = o.toFixed(3);
  el.style.visibility = o > 0.004 ? "visible" : "hidden";
  el.style.pointerEvents = o > 0.6 ? "auto" : "none";
  // The one number every vessel's own chrome stages off: a husk splits, a pod
  // unzips and a bloom opens on this, so all three arrive with the bud instead
  // of running a CSS transition that knows nothing about the scroll.
  //
  // GROWTH ONLY — deliberately not the opacity above. The two are different
  // things and folding them together is a real bug: the chapter's `reveal`
  // drains over its last quarter, so a `--born` carrying it would make every
  // husk close, every pod zip shut and the shield climb back up its own cord on
  // the way out. Nothing else in the scene un-draws at the hand-off; the vine
  // holds whatever it has grown and simply dims, and so should these.
  el.style.setProperty("--born", grown.toFixed(3));
  el.style.setProperty("--sap", sap.toFixed(3));
};
/** Eased cursor, so the vine answers the pointer without snapping to it. */
let curX = 0;
let curY = 0;

/**
 * Overshoot: a leaf springs open and settles, which is what unfurling looks like.
 *
 * `1 + c₃u³ + c₁u²` with `u = t - 1`. The two constants are not free — the curve
 * only passes through 0 at t = 0 when `c₃ = c₁ + 1`, and getting that wrong does
 * not look like a bad ease, it looks like every leaf on the vine starting at
 * DOUBLE size and shrinking. 2.2 / 1.2 peaks about 5% over.
 */
const easeOutBack = (t: number) => {
  const u = clamp01(t) - 1;
  return 1 + u * u * (2.2 * u + 1.2);
};

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const g = group.value;
  if (!g) return;

  const reveal = clamp01(props.reveal ?? 0);

  // Same gate every other set-piece uses: the group is mounted hidden and only
  // switched on for its own beat, so the vine is not being traversed and drawn
  // through the other six chapters. The card parking still has to happen on the
  // way out, or three transforms are left frozen mid-frame.
  g.visible = reveal > 0.001;
  if (!g.visible) {
    if (!wroteHidden) {
      for (let i = 0; i < cardEls.length; i++) park(cardEls[i]);
      park(labelEl.el);
      wroteHidden = true;
    }
    return;
  }
  wroteHidden = false;

  const still = reducedMotion.value;
  const time = still ? 0 : elapsed;

  // The assembly runs on the beat's whole travel, not the bloom — a vine that
  // coils in over a quarter of the section reads as a flicker (see the note on
  // `cardProgress` in SceneSetPieces).
  //
  // LINEAR, with only the last stretch eased. This was `easeOutCubic(raw*1.12)`,
  // and a cubic ease-out is the wrong shape for a growth whose whole job is to
  // deal three cards out in turn: it front-loads the travel, so the tip was past
  // the second bud (CARD_T 0.44) by a fifth of the chapter and all three cards
  // had landed inside the first 38% of it — the first two arriving together.
  // That is the thing `weight: 5` in registry.ts exists to prevent.
  //
  // The curve itself lives in ./projectsTeaser.ts, because the head track is
  // generated from it too — the head turns toward wherever this says the growing
  // tip is, so the two have to be the same function or the gaze lags the thing
  // it is watching.
  const raw = props.cardProgress ?? reveal;
  const drawT = still ? 1 : vineDrawT(raw);
  // The second clock: how far the growth hanging off the vine's end has fallen.
  const fallT = still ? 1 : curtainT(raw);

  // The whole plant leans with the cursor. Small on purpose: the three cards
  // are welded to this group, so anything bigger would have the visitor's own
  // mouse dragging the text they are trying to read.
  const ease = approach(0.05, delta);
  curX += ((still ? 0 : pointer.value.x) - curX) * ease;
  curY += ((still ? 0 : pointer.value.y) - curY) * ease;
  g.rotation.y = curX * 0.05;
  g.rotation.x = curY * 0.03;

  stem.material.opacity = reveal * 0.95;
  winds.material.opacity = reveal * 0.55;
  // A shade behind the trunk, so the eye still reads one main line with side
  // shoots off it rather than a thicket of equal stems.
  branchStem.material.opacity = reveal * 0.8;
  branchWinds.material.opacity = reveal * 0.45;
  // The boughs carry the crown's weight; the curtain hanging off them sits a
  // shade behind, the same way the side shoots sit behind the main stem. Both
  // are held down from what a single stem would take, because this layer is
  // ADDITIVE and twenty-six strands in one place sum to a white mat wherever
  // they cross — which is exactly what a curtain does to itself.
  boughStems.material.opacity = reveal * 0.9;
  boughWinds.material.opacity = reveal * 0.45;
  fallField.material.opacity = reveal * 0.6;
  bark.material.opacity = reveal * 0.3;
  leafField.material.opacity = reveal * 0.8;
  tendrils.material.opacity = reveal * 0.7;
  // A DotField's alpha lives in its own `uOpacity` uniform, NOT in
  // `material.opacity` — the fragment shader in ./lineArt.ts reads the uniform,
  // and a ShaderMaterial does not feed its `opacity` property into a custom
  // shader. Writing the property instead (which this file did, and which is how
  // the buds came to be authored at a size that would have covered the screen
  // had they ever drawn) leaves every dot at opacity 0 and perfectly invisible.
  budField.material.uniforms.uOpacity!.value = reveal;
  auraField.material.uniforms.uOpacity!.value = reveal * 0.3;
  moteField.material.uniforms.uOpacity!.value = reveal * 0.85;

  drawFatFraction(stem, drawT);
  drawFatFraction(winds, drawT);
  drawFatFraction(bark, drawT);

  // Branches draw one at a time behind the tip, the same way the tendrils do:
  // laid out in stem order and spaced wider than `BRANCH_GROW`, so at most one
  // is ever part-drawn and the sum below is an exact instance count.
  let openBranch = 0;
  for (let i = 0; i < branchT.length; i++) {
    openBranch += clamp01((drawT - branchT[i]!) / BRANCH_GROW);
  }
  branchStem.geometry.instanceCount = Math.floor(openBranch * BRANCH_SAMPLES);
  branchWinds.geometry.instanceCount =
    Math.floor(openBranch * BRANCH_SAMPLES) * BRANCH_STRANDS;

  // Tendrils uncoil one at a time behind the tip. They are laid out in stem
  // order and spaced further apart than `TENDRIL_GROW`, so at most one is ever
  // partly drawn — which makes the sum below an exact draw range rather than an
  // approximation of one.
  let openCoils = 0;
  for (let i = 0; i < tendrilT.length; i++) {
    openCoils += clamp01((drawT - tendrilT[i]!) / TENDRIL_GROW);
  }
  tendrils.geometry.instanceCount = Math.floor(openCoils * TENDRIL_SEGS);

  // --- The hanging growth ---------------------------------------------------
  // The boughs spring out of the node first, then the curtain falls from them.
  // Both are revealed by instance count off the same `drawT` as everything
  // else, so the whole act runs backwards on scroll-up without a single piece
  // of state — and because each strand is written top to bottom, revealing it
  // in buffer order IS it growing downward.
  let openBough = 0;
  for (let i = 0; i < boughT.length; i++) {
    openBough += clamp01((fallT - boughT[i]!) / BOUGH_GROW);
  }
  boughStems.geometry.instanceCount = Math.floor(openBough * BOUGH_SAMPLES);
  boughWinds.geometry.instanceCount =
    Math.floor(openBough * BOUGH_SAMPLES) * BOUGH_STRANDS;
  let openStrand = 0;
  for (let i = 0; i < strandT.length; i++) {
    openStrand += clamp01((fallT - strandT[i]!) / FALL_GROW);
  }
  fallField.geometry.instanceCount = Math.floor(openStrand * FALL_SAMPLES);

  // The eyelet, and the pool of light the label hangs in. Same breathing the
  // buds do, and the same flare when the sap pulse reaches it — so the node the
  // label hangs from is visibly part of the same plant.
  const hung = smoothstep(0.42, LABEL_OPEN, fallT);
  const hookBreathe = still ? 0.5 : 0.5 + 0.5 * Math.sin(time * 1.5 + 0.9);
  hookField.material.uniforms.uOpacity!.value = reveal;
  hookAura.material.uniforms.uOpacity!.value = reveal * 0.26;
  hookField.size[0] = (0.09 + 0.04 * hookBreathe) * hung;
  hookField.glow[0] = 0.3 + 0.2 * hookBreathe;
  hookAura.size[0] = 0.95 * hung;
  hookAura.glow[0] = 0;
  hookField.flush({ position: false, size: true, glow: true });
  hookAura.flush({ position: false, size: true, glow: true });

  // --- Cards -----------------------------------------------------------------
  // Resolved before the leaves, because the rosettes open on the same factor the
  // card does — the nest and the thing nesting in it arrive together.
  for (let i = 0; i < CARD_T.length; i++) {
    born[i] = smoothstep(CARD_T[i]! - 0.01, CARD_T[i]! + 0.07, drawT);
  }

  // --- Leaves ---------------------------------------------------------------
  // A breeze travelling the vine rather than a global sine: every blade at the
  // same phase is a flag, and the whole point of sixty of them is that they
  // move against each other.
  //
  // Only the OPEN prefix is written, and only it is drawn. A blade that has not
  // been reached used to be collapsed onto its own base — the idiom `createLinkPool`
  // documents, where a zero-length segment draws nothing. That is true of a native
  // GL line and false of a fat one: `LineSegments2` expands every segment into a
  // quad and caps the ends, so a segment of zero length comes out as a round dot
  // `linewidth` across. Twenty-six of them, coincident and additive, at the base of
  // every unopened leaf — which is a bright speck at every station of the whole
  // curve, including all the stem that has not grown yet. It reads as a dotted
  // line sketching the vine's future path, and it was mistaken for the pollen.
  let openLeaves = 0;
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]!;
    const at = i * LEAF_FLOATS;
    const open =
      leaf.bud === CURTAIN
        ? smoothstep(leaf.t, leaf.t + 0.06, fallT)
        : leaf.bud < 0
          ? smoothstep(leaf.t, leaf.t + 0.045, drawT)
          : born[leaf.bud]!;
    // Sorted by open time, so the first blade that has not started is the end of
    // the prefix and everything after it can simply not be drawn.
    if (open <= 0.001) break;
    openLeaves = i + 1;
    const grown = easeOutBack(open);
    // Rolled along the midrib at first, opening out as it matures.
    const width = 0.12 + 0.88 * smoothstep(0.15, 1, open);
    const sway = still
      ? 0
      : Math.sin(time * 1.15 + leaf.phase + leaf.t * 9) * 0.26 +
        Math.sin(time * 2.7 + leaf.phase * 1.7) * 0.09;
    // Roll about the leaf's own axis: the blade turns its face, which is the
    // one motion that reads as foliage rather than as a wobbling decal.
    const cs = Math.cos(sway);
    const sn = Math.sin(sway);
    lv.copy(leaf.V).multiplyScalar(cs).addScaledVector(leaf.W, sn);
    lw.copy(leaf.W).multiplyScalar(cs).addScaledVector(leaf.V, -sn);
    writeLeaf(
      leafPos,
      at,
      leaf.shape,
      leaf.origin,
      leaf.U,
      lv,
      lw,
      leaf.len * grown,
      width,
      leaf.droop + (still ? 0 : Math.sin(time * 1.6 + leaf.phase) * 0.07)
    );
  }
  leafField.flush();
  leafField.geometry.instanceCount = openLeaves * LEAF_SEGMENTS;

  // --- Sap ------------------------------------------------------------------
  // Runs on its own clock, but never past the growing tip: a pulse arriving at
  // stem that has not been drawn yet is a bright line hanging in the dark.
  // Two numbers, not one: `sapPhase` is where the pulse is in its own cycle and
  // owns the fade in and out; `sapHead` is where that lands on the stem, and is
  // clamped to the drawn part. Folding them together would peak the brightness
  // at the END of a half-grown vine rather than the middle of the run.
  const sapPhase = (elapsed / SAP_PERIOD) % 1;
  const sapHead = still ? 0 : sapPhase * drawT;
  const sapOn = !still && drawT > 0.12;
  if (sapOn) {
    const i1 = Math.min(N, Math.max(1, Math.floor(sapHead * N)));
    const i0 = Math.max(0, i1 - SAP_SAMPLES);
    const span = Math.max(1, i1 - i0);
    let o = 0;
    for (let i = i0; i < i1; i++) {
      // Dashes that lengthen toward the head — the tail breaks up into sparks
      // instead of ending on a hard edge.
      const k = Math.pow((i - i0) / span, 0.55);
      const src = i * 6;
      for (let c = 0; c < 3; c++) {
        const a = corePos[src + c]!;
        const b = corePos[src + 3 + c]!;
        const mid = (a + b) * 0.5;
        sapPos[o + c] = mid + (a - mid) * k;
        sapPos[o + 3 + c] = mid + (b - mid) * k;
      }
      o += 6;
    }
    sapPos.fill(0, o);
    sapField.flush();
    sapField.geometry.instanceCount = o / 6;
    // In and out over the run, so it does not restart with a jump at t=0.
    sapField.material.opacity = reveal * Math.pow(Math.sin(Math.PI * sapPhase), 0.5) * 0.85;
  } else {
    sapField.material.opacity = 0;
  }

  // --- Buds -----------------------------------------------------------------
  for (let i = 0; i < CARD_T.length; i++) {
    const near = sapOn ? clamp01(1 - Math.abs(sapHead - CARD_T[i]!) / 0.06) : 0;
    sapNear[i] = near;
    const breathe = still ? 0.5 : 0.5 + 0.5 * Math.sin(time * 1.7 + i * 2.1);
    budField.size[i] = (0.085 + 0.045 * breathe + 0.07 * near) * budScale[i]! * born[i]!;
    // `glow` warms the dot toward `hot` (white) as well as brightening it, so a
    // bud held at 1 is a white pinhole, not a green one. It sits low and only
    // goes white as the sap arrives — which is what makes the arrival read.
    budField.glow[i] = 0.25 + 0.15 * breathe + 0.35 * near;
    auraField.size[i] = (0.78 + 0.2 * near) * budScale[i]! * born[i]!;
    // Capped: the aura, the bud and the sap bead all land on the same pixels
    // when the pulse arrives, and three additive sources at full glow clip to a
    // white disc that swallows the rosette it is supposed to be lighting.
    auraField.glow[i] = near * 0.45;
  }
  budField.flush({ position: false, size: true, glow: true });
  auraField.flush({ position: false, size: true, glow: true });

  // --- Pollen ---------------------------------------------------------------
  for (let m = 0; m < MOTES; m++) {
    const alive = smoothstep(moteT[m]!, moteT[m]! + 0.08, drawT);
    if (alive <= 0.001) {
      moteField.size[m] = 0;
      continue;
    }
    // Rise, wrap, and fade at both ends of the wrap so nothing pops.
    const f = still ? 0.5 : (time * moteRise[m]! + motePhase[m]!) % 1;
    const w = moteWob[m]!;
    const o = m * 3;
    moteField.position[o] = moteHome[o]! + Math.sin(time * w + motePhase[m]! * TAU) * 0.035;
    moteField.position[o + 1] = moteHome[o + 1]! + (f - 0.5) * moteSpan[m]!;
    moteField.position[o + 2] =
      moteHome[o + 2]! + Math.cos(time * w * 0.77 + motePhase[m]! * TAU) * 0.035;
    moteField.size[m] = moteSize[m]! * Math.sin(Math.PI * f) * alive;
    moteField.glow[m] = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2.2 + motePhase[m]! * TAU));
  }

  // Sparks shed off the growing tip — only while there IS a growing tip.
  const growing = drawT > 0.015 && drawT < 0.995 ? smoothstep(0.995, 0.9, drawT) : 0;
  curve.getPointAt(clamp01(drawT), tip);
  for (let s = 0; s < SPARKS; s++) {
    const i = MOTES + s;
    const f = still ? 0 : (time * 1.7 + sparkPhase[s]!) % 1;
    const o = i * 3;
    const d = s * 3;
    const reach = 0.02 + f * 0.17;
    moteField.position[o] = tip.x + sparkDir[d]! * reach;
    moteField.position[o + 1] = tip.y + sparkDir[d + 1]! * reach + f * f * 0.07;
    moteField.position[o + 2] = tip.z + sparkDir[d + 2]! * reach;
    moteField.size[i] = 0.05 * (1 - f) * growing;
    moteField.glow[i] = 1;
  }

  // The sap bead, riding the head of the pulse.
  if (sapOn) {
    curve.getPointAt(clamp01(sapHead), world);
    // Written component by component rather than through `set([...])`, which
    // would allocate an array on every frame (issue #4).
    moteField.position[BEAD * 3] = world.x;
    moteField.position[BEAD * 3 + 1] = world.y;
    moteField.position[BEAD * 3 + 2] = world.z;
    moteField.size[BEAD] = 0.055 * Math.pow(Math.sin(Math.PI * sapPhase), 0.4);
  } else {
    moteField.size[BEAD] = 0;
  }
  moteField.flush({ position: true, size: true, glow: true });

  // --- The DOM half ---------------------------------------------------------
  const gl = renderer.instance;
  const cam = camera.activeCamera.value;
  if (!gl || !cam) return;

  const canvas = gl.domElement;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  // The group now carries a rotation as well as a position, so the buds have to
  // go through its matrix rather than have the offset added to them — otherwise
  // the cards stay put while the vine they hang from leans away.
  g.updateMatrixWorld();

  for (let i = 0; i < CARD_T.length; i++) {
    const el = cardEls[i];
    if (!el) continue;
    // A card opens just after the stem's tip has gone past its bud.
    world.copy(budAt(i)).applyMatrix4(g.matrixWorld);
    placeEl(el, world, cam, w, h, born[i]!, reveal, sapNear[i]!, CARD_ANCHOR);
  }

  // The label hangs BY ITS EYELET, which is why it gets a different anchor: the
  // eyelet is at the top of its box, and the box has to fall away below the
  // point on the vine it is tied to.
  if (labelEl.el) {
    world.copy(NODE).applyMatrix4(g.matrixWorld);
    const labelSap = sapOn ? clamp01(1 - Math.abs(sapHead - 1) / 0.06) : 0;
    placeEl(labelEl.el, world, cam, w, h, hung, reveal, labelSap, "translate(-50%, -7px)");
  }
});

// Dots are sized against the canvas height, so they have to be told it.
const { height } = useWindowSize();
watchEffect(() => {
  setDotScale(budField, height.value);
  setDotScale(auraField, height.value);
  setDotScale(moteField, height.value);
  setDotScale(hookField, height.value);
  setDotScale(hookAura, height.value);
});
</script>

<template>
  <TresGroup ref="group" :position="position" :visible="false">
    <primitive :object="stem.lines" />
    <primitive :object="winds.lines" />
    <primitive :object="branchStem.lines" />
    <primitive :object="branchWinds.lines" />
    <primitive :object="boughStems.lines" />
    <primitive :object="boughWinds.lines" />
    <primitive :object="fallField.lines" />
    <primitive :object="bark.lines" />
    <primitive :object="leafField.lines" />
    <primitive :object="tendrils.lines" />
    <primitive :object="sapField.lines" />
    <primitive :object="auraField.points" />
    <primitive :object="hookAura.points" />
    <primitive :object="budField.points" />
    <primitive :object="hookField.points" />
    <primitive :object="moteField.points" />
  </TresGroup>
</template>
