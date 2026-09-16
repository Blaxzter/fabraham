<script setup lang="ts">
import { shallowRef, watch, onBeforeUnmount } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import {
  AdditiveBlending,
  Color,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from "three";
import type { BufferGeometry, WebGLRenderer } from "three";
import { clamp01, easeOutCubic, rand01 } from "./setpieces/lineArt";
import { createGlyphGeometries } from "./hero/glyphGeometry";
import { ensureGlyphTarget, disposeGlyphTarget, heroExit } from "./hero/glyphBuffer";

/**
 * The hero name, as geometry in the scene.
 *
 * It used to be a fixed DOM overlay (`AsciiTextAnimation.vue`) scrambling
 * Courier glyphs in screen space — the same idea as the ASCII post-process the
 * scene already runs, built a second time, in a different technology, with a
 * different charset and grid, floating in FRONT of the scene rather than inside
 * it. This is that treatment moved into the canvas, where the effect renders it
 * and the scene's own light and air carry it.
 *
 * Two grids, and why
 * ------------------
 * The face's cell size is the hero's narrative: coarse and illegible at the top
 * of the scroll, resolving into a face as the cells shrink. A name sharing that
 * grid would be unreadable exactly as long as the face is — so the glyphs render
 * to their OWN buffer (`hero/glyphBuffer.ts`) at their OWN cell size, and
 * `DualGridAsciiEffect` composites the two grids in one pass. What's unreadable
 * about the name is its CHARACTERS; what's unreadable about the face is its
 * RESOLUTION. And because the two are independent, the name can finish FIRST and
 * hand the frame to the face — which now happens in the section AFTER this one
 * (`ASCII_RAMP_SECTION` in the sections store). The field stays coarse for the
 * whole hero, so the name never has to share the frame with a face resolving
 * underneath it.
 *
 * Where the characters come from
 * ------------------------------
 * By default they SWARM: scattered across the frame, each drifting along its own
 * path and tumbling, then locking into the line one after another as the scroll
 * advances. That is a deliberate answer to a real constraint — the
 * spotlight rig is dark through the hero (ScrollSpotlights; the "tada" is at the
 * interlude), so these glyphs are the only lit thing on screen there. Anything
 * that starts them clustered on the head, or sitting still, opens the site on an
 * empty or a dead frame.
 *
 * Two knobs shape it, both 0..1 and applied in order: `emerge` pulls the start
 * position onto the HEAD, `swarm` scatters it across the FRAME. Set one or the
 * other; swarm is applied last and wins. Both at 0 is an assemble-in-place
 * decode, where nothing moves and only the characters resolve.
 *
 * Scroll sets the odds; a clock does the rolling
 * ----------------------------------------------
 * The decode is deliberately NOT a pure function of scroll. Each glyph re-rolls
 * on a timer of its own — a memoryless one, so it comes in bursts and pauses
 * rather than at a rate (`flipChaos`) — and `heroProgress` sets the PROBABILITY
 * that the roll comes up as the real character — from `minFlash` (a rare flash of the
 * right letter, never zero) up to certainty by the end. So the name is alive
 * while the page is still, and settling it is the odds shortening rather than a
 * timeline being scrubbed. The cost is that the churn is no longer reversible
 * frame for frame; the SETTLED state still is, because at full progress the odds
 * are 1 and the character is pinned rather than rolled.
 *
 * Extruded, not billboarded
 * -------------------------
 * Each character is real 3D geometry with thickness. A textured quad was the
 * cheaper build and it had one fatal property: edge-on, a plane is a zero-area
 * sliver, so a tumbling character disappeared twice per turn. Thickness is the
 * only actual fix. It also pays for itself through the ASCII pass — the glyphs
 * are additive, so a letter presenting more of itself to the lens accumulates
 * more luminance and the pass picks a DENSER character for it. Depth arrives as
 * character density, which is the most on-theme thing in this component.
 *
 * Contract (see docs/scroll-3d-architecture.md): every Three object is created
 * once and mutated imperatively in the loop — never reactive props (issue #4) —
 * and everything allocated here is disposed on unmount. Every seeded number a
 * glyph needs is resolved ONCE at build time: the seeded hash takes a string, and
 * calling it per glyph per frame would allocate a few hundred strings a second
 * inside the render loop.
 *
 * Those seeds come from `rand01`, not `hash01`. They are all of the form
 * `prefix + index`, and plain FNV-1a has no avalanche — consecutive indices come
 * out as consecutive NUMBERS, so every "independent" per-glyph value lands within
 * a few percent of its neighbours. Fifteen characters then share one drift rate,
 * one spin rate, one jitter, and the field moves as a block no matter how the
 * knobs are set. See the note on `rand01` in `setpieces/lineArt.ts`.
 */

// Free layer. 0 is the scene, and SceneSetPieces already owns 1 (on-top), 2
// (head depth stamp) and 3 (occluded). Layer 4 is invisible to the main render
// (a camera's default mask is layer 0), which is exactly what we want: these
// meshes exist only for the offscreen pass below.
const HERO_GLYPH_LAYER = 4;

/**
 * The identity, line by line — and ONLY the name.
 *
 * The `fullest-stack` entry and its definition are deliberately not here. They
 * are prose, and prose re-sampled onto a character grid is mush at any cell size
 * coarse enough to still read as ASCII; they also have to stay real text for
 * crawlers. So the name is glyphs in the scene and the entry is DOM over it
 * (`sections/HeroSection.vue`) — which is the split the prototype had.
 *
 * `gap` is the space above a line, in units of `lineHeight`.
 */
const HERO_LINES = [
  { text: "FREDERIC", gap: 0 },
  { text: "ABRAHAM", gap: 1 },
];

const TAU = Math.PI * 2;
const DEG2RAD = Math.PI / 180;

/**
 * Bounds on a single memoryless wait, as multiples of the average.
 *
 * A memoryless wait has no shortest or longest — it is only unlikely to be
 * extreme — and both ends of that are wrong here. Near zero is two characters
 * swapped inside one frame, which the eye gets as a flicker rather than as a
 * change; four averages of nothing is a character that reads as stuck rather
 * than as slow, and a stuck noise glyph in a settling name looks like a bug.
 */
const FLIP_MIN = 0.2;
const FLIP_MAX = 4;

const sections = useSectionsStore();
const sceneControl = useSceneControlStore();
const { reducedMotion } = usePreferences();

// ---------------------------------------------------------------------------
// Tunables — dev panel → scenes tab → "identity" (the hero), saved to
// tuning.config.json by the panel's "save to config file".
// ---------------------------------------------------------------------------
const tune = useTuning("heroGlyphs", "Hero name", "identity");

/**
 * Where the name is composed: the first character's centre, in world space.
 *
 * Its z is what sets the name's DEPTH, and so the frame it is fitted to. The
 * placement itself is a proposal rather than the last word — see `fitWidth`,
 * which holds the line inside whatever frame the viewport actually has.
 */
const anchor = tune.vec3(
  "anchor",
  { x: -0.16, y: 0.11, z: 0.22 },
  { label: "Name anchor (first letter)" }
);
/** The line's proportions at a full-width frame. All three scale together when
 *  the fit below has to bring the name in, so the letterform never distorts. */
const size = tune.num("size", 0.05, { min: 0.005, max: 0.3, step: 0.001, label: "Glyph size" });
const advance = tune.num("advance", 0.042, { min: 0.005, max: 0.2, step: 0.001, label: "Letter advance" });
const lineHeight = tune.num("lineHeight", 0.058, { min: 0.005, max: 0.3, step: 0.001, label: "Line height" });

/**
 * The most of the frame's WIDTH the name may take, and the margin it keeps off
 * the edge.
 *
 * Everything above is in world units, composed against a wide viewport — and the
 * frame is not the same width on every viewport. Scene3D widens the fov in
 * portrait to give back what the rotation took, but only so far before the lens
 * goes fisheye (it caps at 70°), so on a phone the frame at the name's depth is
 * under half the width the pose was composed for. A name sized in world units is
 * then simply wider than the screen, and the first thing a visitor sees is a
 * title with its first letter missing.
 *
 * So the line is FITTED: if it is wider than this fraction of the visible frame,
 * the size, the letter advance and the line height scale down together until it
 * is not. On a desktop frame it never binds and the tuned values are used exactly
 * as they stand; on a phone it is the whole reason the name reads.
 *
 * The margin then keeps the block off the edge — and doubles as a clamp on the
 * anchor, which is a point in a room and has no idea where the edge of a phone
 * is. Composition first; the clamp only bites when composition would put a
 * letter outside the frame.
 */
const fitWidth = tune.num("fitWidth", 0.88, {
  min: 0.2,
  max: 1,
  step: 0.01,
  label: "Fit — most of the frame the name may span",
});
const edgeMargin = tune.num("edgeMargin", 0.04, {
  min: 0,
  max: 0.2,
  step: 0.005,
  label: "Fit — margin off the frame edge",
});

/**
 * How hard the name holds the FRAME once the camera leaves.
 *
 * The anchor above is a point in the ROOM, composed against the pose the camera
 * holds from the top of the page to the hero's centre — and for the rest of the
 * hero the camera dollies back toward the interlude. At 0 the name is a thing
 * standing in that room: the dolly shrinks it and slides it out of frame, which
 * is the one moment the treatment stops reading as a title and starts reading as
 * an object that happens to be lettered.
 *
 * At 1 the whole line is carried by the camera — rigidly, including the slight
 * skew the world-axis layout has against the frame — so it keeps its place AND
 * its size in the viewport while the room moves behind it. Because the carry is
 * the rigid move between the two poses, the distance to the lens is preserved,
 * and constant distance is what makes the size constant; nothing needs scaling.
 *
 * Nothing changes before the pan begins: until the hero's centre the live pose
 * IS the composed pose, and the carry is the identity.
 */
const follow = tune.num("follow", 1, {
  min: 0,
  max: 1,
  step: 0.01,
  label: "Hold the frame as the camera pans away",
});

/**
 * The swarm: characters scattered across the frame, each drifting on its own
 * orbit, landing one after another.
 *
 * `swarmSpread` is a fraction of the VISIBLE frame at the name's depth, measured
 * from the live camera each frame — so the swarm fills whatever is on screen and
 * survives the fov widening this scene does on narrow viewports.
 */
const swarm = tune.num("swarm", 1, { min: 0, max: 1, step: 0.01, label: "Swarm the frame (0 = start in place)" });
const swarmSpread = tune.num("swarmSpread", 1, { min: 0.1, max: 1.6, step: 0.01, label: "Swarm — how much of the frame" });
const swarmWander = tune.num("swarmWander", 0.55, {
  min: 0,
  max: 1,
  step: 0.01,
  label: "Swarm — roam from its own spot",
});
const swarmSpeed = tune.num("swarmSpeed", 1, { min: 0, max: 3, step: 0.01, label: "Swarm — drift speed" });
const swarmDepth = tune.num("swarmDepth", 0.08, { min: 0, max: 0.4, step: 0.005, label: "Swarm — depth range" });
const spinSpeed = tune.num("spinSpeed", 1.1, { min: 0, max: 6, step: 0.05, label: "Tumble (rad/s while loose)" });
/**
 * How much of the tumble is an in-plane SPIN rather than a free 3D roll.
 *
 * This used to exist because a flat quad rolling freely went edge-on twice per
 * turn and strobed. The geometry has thickness now, so nothing disappears and
 * the knob is purely about READING: a character presenting its edge is still a
 * character you cannot identify, and a scramble the eye cannot read is just
 * flicker. 1 is a pure spin (always face-on, always legible), 0 a free roll.
 * Lower than it was, now that the failure it guarded against is gone.
 */
const tumbleBias = tune.num("tumbleBias", 0.35, { min: 0, max: 1, step: 0.01, label: "Tumble — keep facing the lens" });

/**
 * The alternative start: born ON the head and flying out to the line. Kept
 * because it is the most site-specific idea here — the name assembled out of the
 * face — but it is 0 by default for the reason in the header.
 */
const emerge = tune.num("emerge", 0, { min: 0, max: 1, step: 0.01, label: "Emerge from head instead" });
const originRadius = tune.num("originRadius", 0.16, { min: 0, max: 1, step: 0.005, label: "Emerge — radius on head" });
const originJitter = tune.num("originJitter", 0.35, { min: 0, max: 1, step: 0.01, label: "Emerge — radius spread" });
const bow = tune.num("bow", 0.06, { min: 0, max: 0.5, step: 0.005, label: "Emerge — path bow" });

/** How hard the letters land one-after-another rather than together. */
const stagger = tune.num("stagger", 0.72, { min: 0, max: 0.95, step: 0.01, label: "Stagger across letters" });
const faceCamera = tune.bool("faceCamera", true, { label: "Settle square to the lens" });

/**
 * Ambient sway — the letters keep breathing once they have landed.
 *
 * Without it an assembled name is the one dead thing in a frame where the head
 * floats (Levioso) and the set-pieces drift, and it reads as a screenshot pasted
 * over the scene rather than as something sharing the air with it.
 */
const swayAmp = tune.num("sway", 0.004, { min: 0, max: 0.05, step: 0.0005, label: "Sway — distance" });
const swaySpeed = tune.num("swaySpeed", 0.55, { min: 0, max: 4, step: 0.05, label: "Sway — speed" });
const swayRot = tune.num("swayRot", 0.05, { min: 0, max: 0.6, step: 0.005, label: "Sway — tilt" });

/** The odds the decode runs on (see the header note). */
const minFlash = tune.num("minFlash", 0.01, { min: 0, max: 0.5, step: 0.005, label: "Right-letter chance at start" });
const flashBias = tune.num("flashBias", 1.5, { min: 0.2, max: 4, step: 0.05, label: "Odds curve (higher = later)" });
/**
 * How often a loose character re-rolls, and how regularly.
 *
 * `flipEvery` is the AVERAGE wait. The waits themselves used to be that average
 * with a ±40% wobble on it, which is a metronome with a wobble: every character
 * changed at the same rate, all the time, and fifteen of them doing that reads
 * as one texture ticking over rather than as fifteen characters deciding things.
 *
 * `flipChaos` blends that even wait into a memoryless one — the wait between
 * events that happen at random, which is where the bursts and the pauses come
 * from. A character rattles off three changes and then sits for a beat, the way
 * a real decode sounds. It does not change the average, only how evenly the
 * changes are spaced, so turning it up costs nothing in pace.
 *
 * On top of that each character carries its OWN rate (`flipRate`, seeded at
 * build), so some are quick and some are sluggish by temperament rather than by
 * luck.
 */
const flipEvery = tune.num("flipEvery", 0.2, { min: 0.01, max: 0.6, step: 0.005, label: "Re-roll — average wait (s)" });
const flipChaos = tune.num("flipChaos", 0.8, { min: 0, max: 1, step: 0.01, label: "Re-roll — how irregular" });

/** Windows within `heroProgress`: assemble, hold, then clear the frame. */
const assembleAt = tune.num("assembleAt", 0.42, {
  min: 0.1,
  max: 1,
  step: 0.01,
  label: "Name assembled by (hero progress)",
});
/**
 * When the name starts to GO — and it goes by coming apart, not by leaving.
 *
 * The exit used to be a translate: the whole line lifted out of frame together.
 * That is a title card sliding off, and it fought everything else the hero does
 * — the name had just spent the section ASSEMBLING out of scattered characters,
 * and then departed as a solid block, as if it had been one object all along.
 *
 * So the going is the assembly run backwards, and it happens where the name
 * actually lives: the character grid. This component keeps drawing the name at
 * full strength and only publishes how far along the exit is (`heroExit`); the
 * ASCII pass takes it apart cell by cell — each one drifting off on its own and
 * thinning through the ramp until there is no character left to draw. See
 * `nameDissolve` in `hero/DualGridAsciiEffect.ts`.
 */
const exitAt = tune.num("exitAt", 0.86, { min: 0.1, max: 1, step: 0.01, label: "Starts coming apart at" });

/** Extrusion, as a fraction of the glyph's height. This is what stops a tumbling
 *  character from vanishing edge-on, so 0 is not a sensible setting. */
const extrude = tune.num("extrude", 0.22, { min: 0.02, max: 1, step: 0.01, label: "Letter thickness" });

/** Brightness. The name has to sit ABOVE the face on the luminance ramp or the
 *  ASCII pass gives both the same character and the letterform dissolves. */
const gain = tune.num("gain", 1.15, { min: 0.1, max: 3, step: 0.05, label: "Brightness" });
/** How bright an unsettled character is, relative to a settled one. The loose
 *  swarm IS the first frame of the hero, so it cannot start near-black. */
const preGain = tune.num("preGain", 0.6, { min: 0.05, max: 1, step: 0.01, label: "Brightness before settling" });

// ---------------------------------------------------------------------------
// Build once
// ---------------------------------------------------------------------------

interface Glyph {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  /** The real character's geometry. Reassigned if the extrusion is retuned. */
  letterGeo: BufferGeometry;
  /** Which character this is, so geometry can be re-resolved after a rebuild. */
  ch: string;
  col: number;
  /** Cumulative line offset, in units of `lineHeight`. */
  lineOffset: number;
  order: number;

  // --- seeded constants, resolved once (see the header note on rand01) ------
  /** Its own spot in the frame while it is loose, as a −1..1 offset. Stratified
   *  across the glyphs rather than seeded per glyph — see the note by the grid. */
  homeX: number;
  homeY: number;
  /** Where on the head it is born (spherical), for `emerge`. */
  originU: number;
  originTheta: number;
  originR: number;
  /**
   * Its own wander across the frame: two sines per axis at incommensurate
   * frequencies, so the path never repeats on a short loop and no two glyphs
   * ever share one. A single frequency per axis made them orbit in step.
   */
  wFx1: number;
  wFx2: number;
  wFy1: number;
  wFy2: number;
  wFz: number;
  wPx1: number;
  wPx2: number;
  wPy1: number;
  wPy2: number;
  wPz: number;
  /** Tumble axis, direction, and rate as a multiple of `spinSpeed`. */
  axis: Vector3;
  spinDir: number;
  spinRate: number;
  /** Bow direction for the emerge path. */
  bowDir: Vector3;
  /** Sway phases. */
  swayPhase: number;
  swayRotPhase: number;
  /** Its own re-roll rate, as a multiple of the average. */
  flipRate: number;

  // --- mutable loop state ---------------------------------------------------
  /** Accumulated tumble angle, wrapped — setFromAxisAngle is 2π-periodic, so
   *  wrapping is free of discontinuity and keeps the number small. */
  spin: number;
  /** Last geometry assigned, so the mesh is only touched when it changes. */
  lastGeo: BufferGeometry;
  /** Rolled state: showing the real character, and which noise glyph otherwise. */
  showLetter: boolean;
  noiseStep: number;
  nextFlip: number;
}

// Held in a ref because the extrusion is a tunable: the panel has to be able to
// change the thickness and SEE it, and thickness is baked into the geometry.
// Rebuilding is ~40 small extrusions, which is fine for a slider drag but far
// too expensive to do per frame — hence still built once per value, not per use.
const glyphGeometries = shallowRef(createGlyphGeometries(extrude.value));
const group = new Group();
group.name = "heroGlyphs";
group.layers.set(HERO_GLYPH_LAYER);

const glyphs: Glyph[] = [];

let lineCursor = 0;
HERO_LINES.forEach((line) => {
  lineCursor += line.gap;
  for (let col = 0; col < line.text.length; col++) {
    const ch = line.text.charAt(col);
    // A space has nothing to draw and nothing to scramble into; it earns its
    // width from `col` alone, so it never becomes a mesh.
    const letterGeo = glyphGeometries.value.geometryFor(ch);
    if (!letterGeo) continue;
    const mat = new MeshBasicMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    // Geometries are SHARED across glyphs showing the same character and are
    // owned by the set, not by the mesh — so nothing here disposes them.
    const mesh = new Mesh(letterGeo, mat);
    mesh.layers.set(HERO_GLYPH_LAYER);
    mesh.frustumCulled = false; // it roams the whole frame; never cull it loose
    group.add(mesh);

    const seed = glyphs.length;
    const axis = new Vector3(
      rand01(`ax${seed}`) - 0.5,
      rand01(`ay${seed}`) - 0.5,
      rand01(`az${seed}`) - 0.5
    );
    if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1);
    axis.normalize();

    const bowDir = new Vector3(
      rand01(`bx${seed}`) - 0.5,
      rand01(`by${seed}`) - 0.5,
      rand01(`bz${seed}`) - 0.5
    );
    if (bowDir.lengthSq() < 1e-6) bowDir.set(0, 1, 0);
    bowDir.normalize();

    glyphs.push({
      mesh,
      mat,
      letterGeo,
      ch,
      col,
      lineOffset: lineCursor,
      order: seed,

      homeX: 0, // assigned below, once the whole set is known
      homeY: 0,
      originU: rand01(`o${seed}`) * 2 - 1,
      originTheta: rand01(`t${seed}`) * TAU,
      originR: 1 - rand01(`r${seed}`),
      wFx1: 0.25 + rand01(`fx1${seed}`) * 0.35,
      wFx2: 0.7 + rand01(`fx2${seed}`) * 0.8,
      wFy1: 0.25 + rand01(`fy1${seed}`) * 0.35,
      wFy2: 0.7 + rand01(`fy2${seed}`) * 0.8,
      wFz: 0.3 + rand01(`fz${seed}`) * 0.5,
      wPx1: rand01(`px1${seed}`) * TAU,
      wPx2: rand01(`px2${seed}`) * TAU,
      wPy1: rand01(`py1${seed}`) * TAU,
      wPy2: rand01(`py2${seed}`) * TAU,
      wPz: rand01(`pz${seed}`) * TAU,
      axis,
      spinDir: rand01(`d${seed}`) < 0.5 ? -1 : 1,
      // Every glyph used to turn at exactly `spinSpeed`, differing only in which
      // way and where it started — so the relative angle between any two of them
      // never changed, and fifteen characters holding their angles against each
      // other is a formation however random the angles were to begin with. Their
      // own rate is what breaks it. Centred on 1, so the line's overall tumble is
      // still the one the knob asks for.
      spinRate: 0.55 + rand01(`sr${seed}`) * 0.95,
      bowDir,
      swayPhase: rand01(`s${seed}`) * TAU,
      swayRotPhase: rand01(`w${seed}`) * TAU,
      // Centred on 1, so the seeded spread shifts no character's share of the
      // average — the line as a whole churns at `flipEvery` either way.
      flipRate: 0.55 + rand01(`fr${seed}`) * 0.95,

      spin: rand01(`sp${seed}`) * TAU,
      lastGeo: letterGeo,
      showLetter: false,
      noiseStep: 0,
      nextFlip: 0,
    });
  }
});

const total = glyphs.length;

/**
 * Where each character waits before it lands: a spot of its own in the frame.
 *
 * The drift does not do this on its own. Every glyph's path is a sum of sines
 * about the frame's CENTRE, so however fast or wide they wander they all wander
 * around the same point — fifteen characters orbiting one spot, which reads as a
 * clump that happens to be moving rather than as a frame with characters
 * scattered through it. And the only knob that widened it (`swarmSpread`)
 * widened every path at once, so the clump just got bigger.
 *
 * So the frame is divided into a row-balanced grid, one place per character, and
 * each character takes one — in a seeded order, so the line's reading order is
 * not its layout, and jittered so the grid never reads as a grid. The drift then
 * happens AROUND that home (`swarmWander`), which is what makes the field look
 * like fifteen characters each doing its own thing.
 *
 * The outer ring sits ON the frame's edge rather than at the centre of an edge
 * cell. Spacing the places as cell centres leaves a margin of half a cell all
 * the way round — on three rows that is a sixth of the frame's height at the top
 * and another at the bottom, and the field reads as a band across the middle.
 * The extent these are measured against is already inset by a glyph's own
 * half-size, so a place on the edge is a character fully in frame rather than
 * one hanging off it.
 */
const swarmRows = Math.max(1, Math.round(Math.sqrt(total / 1.8)));
{
  const order = glyphs.map((_, i) => i).sort((a, b) => rand01(`cell${a}`) - rand01(`cell${b}`));
  const perRow = Math.floor(total / swarmRows);
  const wide = total % swarmRows; // the leftover characters widen the first rows
  // `n` places across −1..1 inclusive, nudged by up to a quarter of the spacing
  // so the rows never line up into columns. (Clamped inline: this runs at build
  // time, above the loop helpers.)
  const place = (k: number, n: number, jitter: number) => {
    if (n <= 1) return 0;
    const v = (k / (n - 1)) * 2 - 1 + (jitter - 0.5) * (0.5 / (n - 1));
    return v < -1 ? -1 : v > 1 ? 1 : v;
  };
  let taken = 0;
  for (let row = 0; row < swarmRows; row++) {
    const n = perRow + (row < wide ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const g = glyphs[order[taken + k]!]!;
      g.homeX = place(k, n, rand01(`hx${g.order}`));
      g.homeY = place(row, swarmRows, rand01(`hy${g.order}`));
    }
    taken += n;
  }
}

/**
 * The name's own proportions, measured once from the geometry.
 *
 * `blockCols` is the longest line in ADVANCES and `glyphWidth` the widest
 * character at size 1; together they say how wide the block is for a given
 * size/advance, which is what the fit needs. Measured rather than assumed — the
 * font is a subset cut by `scripts/make-hero-font.mjs`, so its metrics are not
 * something this file should be hard-coding a guess at.
 */
const blockCols = glyphs.reduce((max, g) => Math.max(max, g.col + 1), 1);
const glyphWidth = glyphs.reduce((max, g) => {
  const box = g.letterGeo.boundingBox;
  return box ? Math.max(max, box.max.x - box.min.x) : max;
}, 0.6);

watch(extrude, (depth) => {
  const next = createGlyphGeometries(depth);
  const previous = glyphGeometries.value;
  glyphGeometries.value = next;
  for (const g of glyphs) {
    g.letterGeo = next.geometryFor(g.ch)!;
    // Force the next frame's swap to take: `lastGeo` still points into the old
    // set, so any comparison against it would be against freed geometry.
    g.lastGeo = g.letterGeo;
    g.mesh.geometry = g.letterGeo;
  }
  previous.dispose();
});

// Palette: the scramble runs green (the terminal the boot sequence hands over
// from) and settles to paper.
const GREEN = new Color("#00ff9c");
const PAPER = new Color("#dfe9ee");

// ---------------------------------------------------------------------------
// Loop state — allocated once, mutated every frame (issue #4)
// ---------------------------------------------------------------------------
const tmpColor = new Color();
const tmpPre = new Vector3();
const tmpOrigin = new Vector3();
const tmpTarget = new Vector3();
const tmpHead = new Vector3();
const tmpCamPos = new Vector3();
const tmpFwd = new Vector3();
const tmpRight = new Vector3();
const tmpUp = new Vector3();
const tmpCentre = new Vector3();
const tmpSwarm = new Vector3();
const tmpEuler = new Euler();
const tmpAxis = new Vector3();
const tmpCarry = new Vector3();
const tmpAnchor = new Vector3();
const tumbleQuat = new Quaternion();
const restQuat = new Quaternion();
/** The pose the anchor was composed against, and the rigid move from it to the
 *  live one — see `follow`. */
const refPos = new Vector3();
const refQuat = new Quaternion();
const refQuatInv = new Quaternion();
const carryQuat = new Quaternion();
/** Where a landed letter rests: the lens, or the carried world axes. */
const restOrient = new Quaternion();
/** The COMPOSED frame: the reference camera's basis, and its centre at the
 *  name's depth. The line is laid out in here and then carried. */
const refFwd = new Vector3();
const refRight = new Vector3();
const refUp = new Vector3();
const refCentre = new Vector3();
const tmpOffset = new Vector3();
/** +Z in the quad's local frame: after `restQuat` this points at the lens. */
const VIEW_AXIS = new Vector3(0, 0, 1);
const tmpSize = new Vector2();
const tmpClear = new Color();

const { scene, camera, renderer } = useTresContext();

// Derived from the context so they are the SAME symbols TresJS hands back: the
// project resolves two copies of @types/three, and a named `Object3D` import is
// structurally incompatible with the one `scene.getObjectByName` returns.
type TresGl = NonNullable<typeof renderer.instance>;
type TresScene = NonNullable<typeof scene.value>;
type TresCamera = NonNullable<typeof camera.activeCamera.value>;
type SceneObject = NonNullable<ReturnType<TresScene["getObjectByName"]>>;

const headGroup = shallowRef<SceneObject | null>(null);

// The buffer only needs clearing on the frame the name LEAVES. Past the hero
// that is every remaining frame of the page, and a full-screen clear per frame
// to write the same black twice is not free.
let bufferDirty = false;

/** Keeps a normalised frame offset inside the frame. */
const clampUnit = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

/**
 * Move a point from the frame the name was composed in onto the live one.
 *
 * The composed frame is a camera pose, so this is just the rigid transform
 * between two poses — express the point in the composed camera's space, then read
 * it back out of the live camera's. Shape, screen position and distance to the
 * lens all survive it, which is the whole point (see `follow`). `amount` lerps
 * toward that carried point, so a partial setting is a partial drift.
 */
const carry = (p: Vector3, amount: number) => {
  if (amount <= 0) return p;
  tmpCarry.copy(p).sub(refPos).applyQuaternion(carryQuat).add(tmpCamPos);
  return p.lerp(tmpCarry, amount);
};

/** Per-character progress: a staggered window inside the line's own progress. */
const charProgress = (p: number, i: number) => {
  const spread = clamp01(stagger.value);
  const start = total > 1 ? (i / (total - 1)) * spread : 0;
  return clamp01((p - start) / (1 - spread || 1));
};

/**
 * Draw the hero layer into its own buffer, for `DualGridAsciiEffect` to sample.
 *
 * Runs BEFORE the composer (onBeforeRender), so the effect always reads this
 * frame's name rather than the last one's. Everything the main render cares
 * about — target, clear colour, camera layer mask — is saved and restored, the
 * same discipline SceneSetPieces follows for its extra passes.
 */
const renderGlyphBuffer = (
  gl: TresGl,
  scn: TresScene,
  cam: TresCamera,
  draw: boolean
) => {
  // Drawing-buffer size, not CSS size: the effect samples this buffer against
  // the composer's own resolution, and they have to agree.
  gl.getDrawingBufferSize(tmpSize);
  const target = ensureGlyphTarget(tmpSize.x, tmpSize.y);

  // TresJS types `renderer.instance` as a union that also covers WebGPU, and the
  // two halves disagree about the signatures of the renderer-STATE calls
  // (Color4 vs Color, RenderTarget vs WebGLRenderTarget). This canvas is WebGL,
  // so those few calls go through a narrowed handle. Everything that touches
  // scene objects still goes through `gl`, whose types line up already.
  const webgl = gl as unknown as WebGLRenderer;

  const prevMask = cam.layers.mask;
  webgl.getClearColor(tmpClear);
  const prevAlpha = webgl.getClearAlpha();

  // Black and fully transparent: the composite reads this buffer's LUMINANCE to
  // decide where the name is, so anything non-zero here would duck the face
  // across the whole frame. (The canvas clears to #111, which is not nothing.)
  webgl.setRenderTarget(target);
  webgl.setClearColor(0x000000, 0);
  webgl.clear(true, false, false);

  if (draw) {
    cam.layers.set(HERO_GLYPH_LAYER);
    gl.render(scn, cam);
  }

  cam.layers.mask = prevMask;
  webgl.setClearColor(tmpClear, prevAlpha);
  // Back to the canvas — which is where the target is at this point in the
  // frame, since the composer has not run yet.
  webgl.setRenderTarget(null);
};

const { onBeforeRender } = useLoop();

onBeforeRender(({ delta, elapsed }) => {
  const gl = renderer.instance;
  const cam = camera.activeCamera.value;
  const scn = scene.value;
  if (!gl || !cam || !scn) return;

  const p = sections.heroProgress;
  const assemble = clamp01(p / (assembleAt.value || 1));
  const exit = clamp01((p - exitAt.value) / (1 - exitAt.value || 1));
  const alive = exit < 0.999;

  // Published before the early-out below, so the pass still reads a finished
  // exit on the frames where there is nothing left to draw.
  heroExit.progress = exit;

  group.visible = alive;
  if (!alive) {
    // Past the hero the name is gone, but the buffer the effect samples must be
    // cleared once — otherwise the last frame of the name is stamped over the
    // rest of the site.
    if (bufferDirty) {
      renderGlyphBuffer(gl, scn, cam, false);
      bufferDirty = false;
    }
    return;
  }

  const still = reducedMotion.value;
  const em = clamp01(emerge.value);
  const sw = still ? 0 : clamp01(swarm.value);

  // The pose this frame will be DRAWN with — which is the camera OBJECT, not the
  // store.
  //
  // Scene3D writes the camera in TresCanvas's `@loop`, and TresJS wires that to
  // the AFTER-render hook; this is a BEFORE-render hook. So the object still
  // holds the pose written at the end of the last frame — and nothing touches it
  // between here and the draw, which is exactly what makes it the right read:
  // it IS the camera this frame is shot from. `cameraAt(progress)` is the pose of
  // a frame that has not been drawn yet, one frame AHEAD of the render.
  //
  // That one frame is the whole of the judder. Placing the name against a camera
  // the frame is not shot from lands it off by the camera's own per-frame
  // movement: nothing at all while the camera is parked, and growing with scroll
  // speed exactly while it pans. Everything else in the scene sits in world
  // space and shows none of it, so the name is the only thing that stutters —
  // which is what makes this look like a problem with the name rather than with
  // which clock it is reading.
  //
  // The fallback covers the frames before Scene3D's seed watch has run, where
  // the object is still at its default at the origin — a point inside the head
  // that no pose in this scene ever uses, and one that would put the name's
  // anchor behind the lens.
  cam.getWorldPosition(tmpCamPos);
  if (tmpCamPos.lengthSq() > 1e-8) {
    cam.getWorldQuaternion(restQuat);
  } else {
    const pose = sections.cameraAt(sections.progress);
    tmpCamPos.set(pose.position.x, pose.position.y, pose.position.z);
    tmpEuler.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
    restQuat.setFromEuler(tmpEuler);
  }

  // The pose the anchor was composed against, and the rigid move from it to the
  // live one. Progress 0 is the right reference because the camera HOLDS the
  // identity keyframe from the top of the page to the hero's centre — the pan is
  // everything after that, so before it this move is the identity and the name
  // sits exactly where it was placed. (Safe to sample second even though
  // `cameraAt` returns the store's scratch: the live pose above is already
  // copied out of it.)
  //
  // Not in orbit mode. There the camera belongs to whoever is flying it — the
  // dev panel inspecting a pose, or a visitor who typed `orbit` at the finale —
  // and a name welded to the lens is one you can never walk around. Orbiting is
  // for looking at the room, so in the room is where the name stays.
  const fol = sceneControl.cameraControlMode === "orbit" ? 0 : clamp01(follow.value);
  const composed = sections.cameraAt(0);
  refPos.set(composed.position.x, composed.position.y, composed.position.z);
  tmpEuler.set(composed.rotation.x, composed.rotation.y, composed.rotation.z);
  refQuat.setFromEuler(tmpEuler);
  refQuatInv.copy(refQuat).invert();
  carryQuat.copy(restQuat).multiply(refQuatInv);

  // Square to the lens is already carried — the lens IS the live frame. Letters
  // left world-aligned have to be turned by hand, or their orientation would stay
  // in the composed frame while their positions left with the camera.
  if (faceCamera.value) restOrient.copy(restQuat);
  else restOrient.identity().slerp(carryQuat, fol);

  // --- fit the line to the frame it was composed in ------------------------
  // The COMPOSED frame, not the live one: the live frame is what `follow` carries
  // the result onto, and fitting there instead would size the name off a camera
  // that is halfway through leaving.
  refFwd.set(0, 0, -1).applyQuaternion(refQuat);
  refRight.set(1, 0, 0).applyQuaternion(refQuat);
  refUp.set(0, 1, 0).applyQuaternion(refQuat);
  tmpOffset.set(anchor.x, anchor.y, anchor.z).sub(refPos);
  const refDist = Math.max(0.01, tmpOffset.dot(refFwd));
  // fov/aspect are written by a watch rather than by the loop, so unlike the pose
  // these are current — which is what makes the fit answer a resize.
  const persp = cam as { fov?: number; aspect?: number };
  const refHalfH = Math.tan(((persp.fov ?? 45) * 0.5) * DEG2RAD) * refDist;
  const refHalfW = refHalfH * (persp.aspect ?? 1.6);
  refCentre.copy(refPos).addScaledVector(refFwd, refDist);

  // The block at the tuned size, and how much of it this frame can hold.
  const natural = (blockCols - 1) * advance.value + glyphWidth * size.value;
  const room = 2 * refHalfW * clamp01(fitWidth.value);
  const fit = natural > room && natural > 0 ? room / natural : 1;
  const s = size.value * fit;
  const adv = advance.value * fit;
  const lh = lineHeight.value * fit;

  // Placed by its CENTRE, so the clamp has one number to hold rather than two
  // edges that can fight each other. `limitX` is how far off the frame's centre
  // the block's centre may sit before a letter crosses the margin — zero when the
  // block fills the frame, which lands it dead centre.
  const halfBlock = natural * fit * 0.5;
  const halfGlyph = glyphWidth * s * 0.5;
  tmpOffset.set(anchor.x, anchor.y, anchor.z).sub(refCentre);
  const wantX = tmpOffset.dot(refRight) - halfGlyph + halfBlock;
  const limitX = Math.max(0, refHalfW * (1 - 2 * edgeMargin.value) - halfBlock);
  const placedX =
    (wantX < -limitX ? -limitX : wantX > limitX ? limitX : wantX) - halfBlock + halfGlyph;
  // Vertically the anchor is left alone: two lines of caps clear the height of
  // every viewport this runs on, so there is nothing to rescue and a clamp would
  // only move a composition that is already right.
  const placedY = tmpOffset.dot(refUp);

  // The placed anchor as a world point — the depth the swarm measures its frame
  // at, and with `follow` a constant distance from the lens rather than one that
  // lengthens as the camera pulls back.
  tmpAnchor
    .copy(refCentre)
    .addScaledVector(refRight, placedX)
    .addScaledVector(refUp, placedY);
  carry(tmpAnchor, fol);

  // The glyphs can be born ON the head, which floats (Levioso) and is posed per
  // scene, so the origin has to follow its live world position rather than a
  // baked point. Looked up lazily: the model is loaded async.
  if (em > 0) {
    if (!headGroup.value) headGroup.value = scn.getObjectByName("headGroup") ?? null;
    if (headGroup.value) headGroup.value.getWorldPosition(tmpHead);
    else tmpHead.set(0, 0, 0);
  }

  // The frame the swarm fills, measured from the live camera at the name's
  // depth: centre, half-width and half-height in world units. Derived rather
  // than tuned so it tracks the fov this scene widens on narrow viewports.
  let halfW = 0;
  let halfH = 0;
  let camDist = 1;
  if (sw > 0) {
    // The camera's own basis, so the scatter rectangle is the SCREEN rectangle.
    // Offsetting along world x/y instead would hand the swarm a box rotated
    // against the frame, and the corners would drift off the edges.
    tmpFwd.set(0, 0, -1).applyQuaternion(restQuat);
    tmpRight.set(1, 0, 0).applyQuaternion(restQuat);
    tmpUp.set(0, 1, 0).applyQuaternion(restQuat);
    tmpCentre.copy(tmpAnchor).sub(tmpCamPos);
    camDist = Math.max(0.01, tmpCentre.dot(tmpFwd));
    halfH = Math.tan(((persp.fov ?? 45) * 0.5) * DEG2RAD) * camDist;
    halfW = halfH * (persp.aspect ?? 1.6);
    tmpCentre.copy(tmpCamPos).addScaledVector(tmpFwd, camDist);
  }

  const spread = swarmSpread.value;
  const chaos = clamp01(flipChaos.value);
  const wander = clamp01(swarmWander.value);
  const t = elapsed * swarmSpeed.value;

  for (let i = 0; i < total; i++) {
    const g = glyphs[i]!;
    const cp = charProgress(assemble, i);
    const eased = easeOutCubic(cp);

    // --- where it belongs ----------------------------------------------------
    // Along the composed frame's own axes rather than the world's, so the line
    // sits level IN THE FRAME. A title a degree off square reads as a mistake,
    // and the world axes are a degree off whatever the pose is.
    tmpTarget
      .copy(refCentre)
      .addScaledVector(refRight, placedX + g.col * adv)
      .addScaledVector(refUp, placedY - g.lineOffset * lh);
    // Carried per glyph rather than laid out around the carried anchor: the
    // transform is rigid, so the two agree at `follow` 1 — but at a partial
    // setting only this one lerps the whole line evenly instead of stretching it.
    carry(tmpTarget, fol);

    // --- where it is coming from --------------------------------------------
    // `emerge` pulls the start onto the head, `swarm` scatters it across the
    // frame; applied in that order, so swarm wins when both are set. At 0/0 the
    // start IS the target and the decode happens purely in the characters.
    tmpPre.copy(tmpTarget);

    if (em > 0) {
      const ring = Math.sqrt(Math.max(0, 1 - g.originU * g.originU));
      const r = originRadius.value * (1 - originJitter.value * g.originR);
      tmpOrigin.set(
        tmpHead.x + ring * Math.cos(g.originTheta) * r,
        tmpHead.y + g.originU * r,
        tmpHead.z + ring * Math.sin(g.originTheta) * r
      );
      // Partial emergence starts the glyph part-way home rather than shortening
      // the flight, so the knob reads as "how far does it come from".
      tmpPre.lerp(tmpOrigin, em);
      // A straight line from the face to the line reads as a slide; the bow (a
      // seeded perpendicular offset peaking mid-flight) makes it a throw.
      if (bow.value > 0 && !still) {
        tmpPre.addScaledVector(g.bowDir, Math.sin(eased * Math.PI) * bow.value * em);
      }
    }

    if (sw > 0) {
      // Depth along the view axis is what gives the swarm perspective — a near
      // glyph reads bigger than a far one — but it also changes how wide the
      // frame IS at that depth, so the extent has to follow it or a glyph that
      // drifts toward the camera slides off the edge.
      const fz = Math.sin(t * g.wFz + g.wPz) * swarmDepth.value;
      const depthScale = (camDist + fz) / camDist;

      // Inset by the glyph's own half-width, so "inside the frame" means the
      // whole character rather than its centre point.
      const half = s * 0.5;
      const usableW = Math.max(0, halfW * depthScale - half) * spread;
      const usableH = Math.max(0, halfH * depthScale - half) * spread;

      // Its own path — two sines per axis at unrelated frequencies, so nothing
      // holds formation and nothing repeats in step — taken as a roam AROUND its
      // home rather than around the frame's centre.
      const driftX =
        0.72 * Math.sin(t * g.wFx1 + g.wPx1) + 0.28 * Math.sin(t * g.wFx2 + g.wPx2);
      const driftY =
        0.72 * Math.sin(t * g.wFy1 + g.wPy1) + 0.28 * Math.sin(t * g.wFy2 + g.wPy2);

      // The drift is a ±1 signal, and it is mapped into the room this glyph
      // actually HAS on each side rather than added symmetrically. Two things
      // were wrong with the obvious versions. Lerping home toward the drift
      // shrinks the homes by exactly the amount you asked them to move, so
      // turning the roam up pulls the field back into the middle — the clump
      // again. Adding it symmetrically and clamping instead pins whatever
      // reaches an edge, and a character stuck against the frame for a second is
      // the one thing in this field that looks broken. Mapping it into the room
      // available does neither: a glyph at home keeps its spread, every glyph
      // moves, and nothing ever has to be clamped (the clamp below is belt and
      // braces).
      const roamX = driftX > 0 ? driftX * (1 - g.homeX) : driftX * (1 + g.homeX);
      const roamY = driftY > 0 ? driftY * (1 - g.homeY) : driftY * (1 + g.homeY);
      const nx = clampUnit(g.homeX + roamX * wander);
      const ny = clampUnit(g.homeY + roamY * wander);

      tmpSwarm
        .copy(tmpCentre)
        .addScaledVector(tmpRight, nx * usableW)
        .addScaledVector(tmpUp, ny * usableH)
        .addScaledVector(tmpFwd, fz);
      tmpPre.lerp(tmpSwarm, sw);
    }

    g.mesh.position.lerpVectors(tmpPre, tmpTarget, eased);

    // --- ambient sway --------------------------------------------------------
    // Per-glyph phase, so the landed line breathes rather than sliding as one
    // block. Scaled by `eased` so it does not fight the swarm's own drift.
    if (!still && swayAmp.value > 0) {
      const st = elapsed * swaySpeed.value;
      const a = swayAmp.value * eased;
      g.mesh.position.x += Math.sin(st + g.swayPhase) * a;
      g.mesh.position.y += Math.sin(st * 0.77 + g.swayPhase * 1.7) * a * 0.6;
      g.mesh.position.z += Math.sin(st * 0.61 + g.swayPhase * 2.3) * a * 0.4;
    }

    // --- the tumble ----------------------------------------------------------
    // A loose glyph spins continuously; landing is a slerp back to the rest
    // orientation, so the settle converges exactly instead of unwinding a
    // number that keeps growing.
    g.mesh.quaternion.copy(restOrient);

    const loose = Math.max(em, sw);
    if (!still && loose > 0 && spinSpeed.value > 0 && eased < 1) {
      g.spin = (g.spin + delta * spinSpeed.value * g.spinRate * g.spinDir * loose) % TAU;
      // Rotating about the view axis is an in-plane spin; about anything else,
      // a roll that passes edge-on. Blend between the glyph's own axis and the
      // view axis to choose how much of each. The axis is expressed in the
      // quad's local frame, which after `restQuat` has +Z pointing at the lens.
      tmpAxis.copy(g.axis).lerp(VIEW_AXIS, tumbleBias.value);
      if (tmpAxis.lengthSq() < 1e-6) tmpAxis.copy(VIEW_AXIS);
      tmpAxis.normalize();
      tumbleQuat.setFromAxisAngle(tmpAxis, g.spin);
      g.mesh.quaternion.multiply(tumbleQuat);
      g.mesh.quaternion.slerp(restOrient, eased);
    }
    if (!still && swayRot.value > 0) {
      g.mesh.rotateZ(
        Math.sin(elapsed * swaySpeed.value * 0.8 + g.swayRotPhase) * swayRot.value * eased
      );
    }

    // --- the glyph itself: scroll sets the ODDS, a clock does the rolling ----
    // A space is never rolled (a scrambling space is a stray glyph), and full
    // progress is PINNED rather than left to the next roll, so the name is
    // correct the moment it is supposed to be and stays that way.
    if (cp >= 1) {
      g.showLetter = true;
    } else if (still) {
      // Reduced motion: no churn at all, just the deterministic reveal.
      g.showLetter = false;
      g.noiseStep = Math.floor(cp * 12);
    } else if (elapsed >= g.nextFlip) {
      // The next wait: a memoryless draw, blended toward an even one by
      // `flipChaos` and bounded at both ends. `-log(1 - u)` averages 1, so the
      // blend leaves the mean alone whatever the knob is set to — it buys
      // irregularity, not pace.
      const memoryless = Math.min(FLIP_MAX, -Math.log(1 - Math.random()));
      const wait = Math.max(FLIP_MIN, 1 - chaos + chaos * memoryless);
      g.nextFlip = elapsed + flipEvery.value * g.flipRate * wait;
      const odds = minFlash.value + (1 - minFlash.value) * Math.pow(cp, flashBias.value);
      g.showLetter = Math.random() < odds;
      g.noiseStep++;
    }

    const geo = g.showLetter
      ? g.letterGeo
      : glyphGeometries.value.noiseFor(g.order, g.noiseStep);
    if (geo !== g.lastGeo) {
      g.lastGeo = geo;
      g.mesh.geometry = geo;
    }

    g.mesh.scale.setScalar(s);

    // A glyph showing the real character is brighter than one still churning, so
    // an early correct flash reads as a flash rather than as more noise.
    tmpColor.copy(GREEN).lerp(PAPER, cp);
    const settle = preGain.value + (1 - preGain.value) * cp;
    // Cubic, so the name holds its weight while the dissolve is eating it: what
    // is still THERE has to stay solid, or the letters dim as a block and the
    // effect reads as a fade with some drifting on top. This is only a floor
    // under the dissolve anyway — a guarantee that nothing is left stamped on
    // screen if the ASCII pass is switched off in the dev panel.
    const fade = 1 - exit * exit * exit;
    const flash = g.showLetter ? 1 : 0.72;
    g.mat.color.copy(tmpColor).multiplyScalar(gain.value * settle * flash * fade);
    g.mat.opacity = fade;
  }

  renderGlyphBuffer(gl, scn, cam, true);
  bufferDirty = true;
});

onBeforeUnmount(() => {
  for (const g of glyphs) g.mat.dispose();
  glyphGeometries.value.dispose();
  disposeGlyphTarget();
});
</script>

<template>
  <primitive :object="group" />
</template>
