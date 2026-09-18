<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import type { Group, Object3D } from "three";

/**
 * The fly: a small glowing orb that keeps the cursor company while the head is
 * looking at it, shedding sparks that fall away behind it.
 *
 * It lives for exactly as long as the head's gaze does — `store.addressing`, the
 * same 0→1 ramp `Scene3D` uses to swing the head toward the terminal and track
 * the cursor with it (see "The finale (contact)" in
 * docs/scroll-3d-architecture.md). Before the contact beat there is nothing to
 * follow, and no orb.
 *
 * Where it flies
 * --------------
 * The cursor is a 2D thing; the orb is not. Each frame the cursor is unprojected
 * through the live camera onto the ray under it, at `depthFrac` of the
 * camera→head distance — so the point sits BETWEEN the head and the lens and
 * stays there as the camera pose changes. That point is the centre of gravity,
 * not the orb's position: the orb is falling toward it and missing.
 *
 * How it flies
 * ------------
 * A spring (`pull`) rather than an inverse-square well: real gravity is violent
 * up close and limp far away, which reads as a yo-yo. A spring's pull grows with
 * distance, so the orb can never escape the cursor, and an undamped one keeps its
 * orbit forever — the "never 0 velocity" the brief asks for falls out of the
 * physics instead of being bolted on. Layered on top:
 *
 *  - `wander` — two sines per axis at frequencies with no common period. This is
 *    the whole difference between a fly and a pendulum: without it the orbit is
 *    an ellipse you can predict after one lap.
 *  - `drag`, and a lot of it. A spring on its own is a bell: it rings around the
 *    target and takes a dozen swings to stop. This is what stops the orb sailing
 *    a quarter of the way past the cursor on every move — see the note on the
 *    knob for what each value costs in overshoot.
 *  - a speed FLOOR (and a ceiling). With this much drag the floor is what keeps
 *    the orb moving at all, which is the literal reading of the brief: whatever
 *    the drag and the spring conspire to do, it is never allowed to stop. Applied
 *    along the CURRENT heading, so it still carries past the cursor rather than
 *    parking on it — just by a body length now rather than half the screen.
 *
 * What it burns
 * -------------
 * Sparks, not a trail. Each one is born at the orb with a fraction of its
 * velocity (`inherit`), a little scatter and an `updraft`, and from that moment
 * it is on its own: it rises for an instant, falls under `sparkGravity`, slows
 * against `sparkDrag`, and burns out. It is dropped rather than thrown — `inherit`
 * is near zero and the spark drag is high, so whatever sideways motion it was born
 * with is gone in a few tenths of a second and gravity has the rest of its life to
 * itself. That is the difference between a flame dripping and a comet: with a
 * third of the orb's velocity inherited and little drag, the cloud strings out
 * along the orbit into a streak instead of falling.
 *
 * Each one is also COOLING, which is what separates an ember from a dot that
 * fades: a white-hot flash for the first `BURN_POINT` of its life, then a long
 * burn down through `sparkMid` to `sparkCool`, with its own flicker phase so the
 * field crackles rather than pulsing together. Colour carries the cooling,
 * brightness carries the decay; a single-colour spark fading out has only the
 * second of those, and reads as one trail particle.
 *
 * A fixed pool of 1024 in a ring buffer: at the default rate and life about 250
 * are alive at once, and if the rate is pushed far enough to exhaust the pool the
 * oldest (so the dimmest) is the one recycled.
 *
 * The orb and the sparks are both integrated on a fixed 120Hz substep, and
 * spawning happens inside that loop — so a spray is laid down ALONG the path the
 * orb took during the frame, not dumped at the one position it ended on, and
 * nothing changes shape between 30 and 144fps.
 *
 * Rendering
 * ---------
 * The default layer, so all of it goes through the ASCII composer with the head:
 * it resolves into bright characters on the same grid as the face rather than
 * sitting on top of the image as a foreign, crisp object. At the contact beat
 * that grid is at its fine end (`faceCellFine`, 9px), so the orb's core is a few
 * cells across, its halo a good dozen, and a spark is about one — each falling
 * ember is its own character. Everything is an additive sprite over a soft radial
 * falloff, which is the gradient a character ramp is built to resolve; a
 * hard-edged disc would flatten to a single glyph.
 *
 * The pass costs the effect its subtlety, so nothing here is subtle: `sparkGain`
 * drives a spark past saturation at birth, because a glyph is chosen from a
 * cell's luminance and anything that peaks in the middle of that ramp comes out
 * as grey mush beside the lit face. Nothing is allocated per frame (issue #4).
 */
const store = useSectionsStore();
const { scene, camera } = useTresContext();
const { pointer, pointerActive } = usePointer();
const { reducedMotion } = usePreferences();
// Published every frame so the head can aim at the orb instead of at the cursor
// (Scene3D reads it). Screen space, same convention as `pointer` — see the
// composable.
const gaze = useCursorOrb();

// Tagged to the contact section so the dev panel shows these knobs under the beat
// they actually play in.
const tune = useTuning("cursorOrb", "Cursor orb", "contact");
const depthFrac = tune.num("depthFrac", 0.55, {
  min: 0.1,
  max: 0.95,
  step: 0.01,
  label: "Depth (0 = lens, 1 = head)",
});
const pull = tune.num("pull", 120, {
  min: 2,
  max: 400,
  step: 1,
  label: "Gravity (pull toward cursor)",
});
/**
 * The damping, and it carries more of the feel than `pull` does.
 *
 * `pull` alone is a bell: a spring with almost no damping RINGS around its
 * target, and at 0.9 against a pull of 120 the ratio was 0.04 — about as
 * undamped as it is possible to be while still having a number there. The orb
 * sailed a quarter of the way past the cursor on every move and took a dozen
 * swings to come back, which is the "overshoots way too much" this fixes. At 12
 * the ratio is 0.55: it still rings, once or twice, then sits down.
 *
 * Measured against a 0.3-unit cursor jump — how far PAST the cursor the orb
 * sails before it turns around:
 *
 *     drag 0.9 → 0.238    drag 3 → 0.196    drag 6 → 0.138    drag 12 → 0.049
 */
const drag = tune.num("drag", 12, {
  min: 0,
  max: 24,
  step: 0.1,
  label: "Drag (per second)",
});
const wander = tune.num("wander", 2.5, {
  min: 0,
  max: 20,
  step: 0.1,
  label: "Wander (the fly)",
});
/**
 * The hover speed, and at this damping it is the speed almost all of the time —
 * drag kills a kick within a tenth of a second and the floor is what puts the
 * orb back in motion, so this is the dial that says how frantic it is.
 *
 * 0.16 world units/s is about a fifth of the frame height per second, and holds
 * the orbit at a mean radius of 0.022 (~25px on a 900px-tall viewport): a fly
 * hovering at the pointer. The old 0.45 was three times that, orbiting at 0.049
 * and flinging its sparks sideways faster than they could fall.
 */
const minSpeed = tune.num("minSpeed", 0.16, {
  min: 0,
  max: 3,
  step: 0.01,
  label: "Min speed (never rests)",
});
const maxSpeed = tune.num("maxSpeed", 2.6, {
  min: 0.1,
  max: 8,
  step: 0.05,
  label: "Max speed",
});
const size = tune.num("size", 0.03, {
  min: 0.004,
  max: 0.15,
  step: 0.002,
  label: "Orb size (world units)",
});
const haloScale = tune.num("haloScale", 3.6, {
  min: 1,
  max: 10,
  step: 0.1,
  label: "Halo size (x orb)",
});
const sparkRate = tune.num("sparkRate", 220, {
  min: 0,
  max: 600,
  step: 5,
  label: "Sparks per second",
});
const sparkLife = tune.num("sparkLife", 0.9, {
  min: 0.15,
  max: 3,
  step: 0.05,
  label: "Spark life (s)",
});
/**
 * Brightness, and it is allowed past 1 on purpose.
 *
 * Everything here is additive, and the ASCII pass picks a glyph from a cell's
 * LUMINANCE — so a spark that peaks at 0.4 of the tint lands in the middle of the
 * character ramp and reads as grey mush next to the lit face. Driving it past
 * saturation puts the hot end of a spark's life at the top of the ramp, where the
 * dense glyphs are, and lets the cooling fade walk it back down through the whole
 * ramp instead of through the bottom third of it.
 */
const sparkGain = tune.num("sparkGain", 2.6, {
  min: 0.2,
  max: 8,
  step: 0.1,
  label: "Spark brightness (1 = saturated)",
});
const sparkFlicker = tune.num("sparkFlicker", 14, {
  min: 0,
  max: 40,
  step: 0.5,
  label: "Spark flicker (Hz)",
});
const updraft = tune.num("updraft", 0.14, {
  min: 0,
  max: 1,
  step: 0.01,
  label: "Updraft at birth (world +Y/s)",
});
/**
 * How hard a spark falls, in world units/s².
 *
 * Small, because the world is: at the contact camera the visible frame is only
 * ~0.79 units tall. Against `sparkDrag` a spark reaches a terminal speed of
 * `sparkGravity / sparkDrag` (0.27 at the defaults) and covers ~0.18 units over
 * its life — a quarter of the frame, so the fall is unmistakable without the
 * sparks raining off the bottom of it.
 */
const sparkGravity = tune.num("sparkGravity", 0.7, {
  min: 0,
  max: 5,
  step: 0.05,
  label: "Spark gravity (world -Y)",
});
/**
 * High on purpose: this is what makes it drip rather than streak.
 *
 * A spark keeps whatever sideways motion it was born with until drag takes it
 * away, so a low value leaves the whole cloud strung out along the orb's path —
 * a comet. At 2.6 the horizontal component is gone within a few tenths of a
 * second and gravity has the rest of the spark's life to itself. Cloud shape
 * (width × height, so higher is more vertical):
 *
 *     drag 0.8, inherit 0.35 → 0.128 × 0.200 (1.6, a comet)
 *     drag 2.6, inherit 0.05 → 0.057 × 0.178 (3.1, a drip)
 */
const sparkDrag = tune.num("sparkDrag", 2.6, {
  min: 0,
  max: 10,
  step: 0.05,
  label: "Spark drag (per second)",
});
const sparkSize = tune.num("sparkSize", 0.014, {
  min: 0.002,
  max: 0.06,
  step: 0.001,
  label: "Spark size (world units)",
});
// Nearly nothing, and that is the other half of the comet fix: a spark that
// leaves with a third of the orb's velocity is thrown along the orbit and the
// cloud becomes a streak behind it. At 0.05 a spark is essentially dropped where
// it was made, and what happens to it afterwards is gravity's business.
const inherit = tune.num("inherit", 0.05, {
  min: 0,
  max: 1.5,
  step: 0.05,
  label: "Velocity inherited from the orb",
});
const scatter = tune.num("scatter", 0.05, {
  min: 0,
  max: 0.5,
  step: 0.005,
  label: "Spawn scatter (world units/s)",
});
const tint = tune.color("tint", "#00ff9c", { label: "Orb colour" });
// The burn, as three stops rather than one colour: a spark is not a dot that
// fades, it is something cooling. Fire by default — a hot fly throwing embers
// off a green scene. Pull all three toward the accent in the panel if that reads
// as too literal against the terminal.
const sparkHot = tune.color("sparkHot", "#fff4d6", { label: "Spark — new" });
const sparkMid = tune.color("sparkMid", "#ffae2b", { label: "Spark — burning" });
const sparkCool = tune.color("sparkCool", "#ff3d12", { label: "Spark — dying" });
/** Where the white-hot flash hands over to the long burn down to ember. */
const BURN_POINT = 0.3;

// Sized for the default rate × life (≈250 alive) with room to raise one of them
// a long way before the ring buffer starts recycling a spark that is still
// burning — and if it does, the one it takes is the oldest, so the dimmest.
const POOL = 1024;
const PHYS_STEP = 1 / 120;
const MAX_FRAME = 0.1; // a backgrounded tab doesn't get to resume with a 4s kick
const FALLBACK_HEAD_DIST = 0.5; // if the head group isn't in the scene yet

/**
 * A soft radial falloff, drawn once into a canvas and shared by the orb and every
 * spark.
 *
 * White, so each material's `color` (or, for the sparks, their vertex colour) is
 * what tints it: the core keeps it nearly white, everything else takes the
 * accent, and additive blending stacks them into a hot centre with a coloured
 * bloom. A flat `MeshBasicMaterial` sphere would just be a disc of one colour —
 * no falloff, and a hard-edged disc is the one thing an ASCII ramp can make
 * nothing of.
 */
const makeGlowTexture = () => {
  if (!import.meta.client) return null;
  const px = 128;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,0.88)");
  g.addColorStop(0.34, "rgba(255,255,255,0.26)");
  g.addColorStop(0.68, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  return new CanvasTexture(canvas);
};
const glowTexture = makeGlowTexture();

// Depth-tested (the default) because this draws in the main pass: the orb is in
// the scene with the head, not pasted over it. `depthWrite` stays off — it is
// additive light, and nothing should be hidden BY it.
const spriteMaterial = () =>
  new SpriteMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });

const haloMat = spriteMaterial();
const coreMat = spriteMaterial();
const halo = new Sprite(haloMat);
const core = new Sprite(coreMat);

// The spark pool. `sparkPos` doubles as the draw buffer; the rest is simulation
// state. A spark is dead when its life is 0, which is also how a free slot reads
// — there is no free list, the ring buffer just walks.
const sparkPos = new Float32Array(POOL * 3);
const sparkCol = new Float32Array(POOL * 3);
const sparkVel = new Float32Array(POOL * 3);
const sparkAge = new Float32Array(POOL);
const sparkLifespan = new Float32Array(POOL);
// A flicker phase per spark, so the field crackles instead of pulsing in unison.
const sparkPhase = new Float32Array(POOL);
let sparkCursor = 0;
let sparkAcc = 0;

const sparkGeom = new BufferGeometry();
const sparkPosAttr = new BufferAttribute(sparkPos, 3);
const sparkColAttr = new BufferAttribute(sparkCol, 3);
sparkGeom.setAttribute("position", sparkPosAttr);
sparkGeom.setAttribute("color", sparkColAttr);
// Per-particle brightness is the vertex colour, not an alpha: additively, fading
// a vertex to black IS fading it out, and `PointsMaterial` has no per-particle
// alpha (or size) to fade instead. A dead spark is simply painted black, so it
// costs a little fill and contributes nothing.
const sparkMat = new PointsMaterial({
  map: glowTexture,
  size: 0.014,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  blending: AdditiveBlending,
  depthWrite: false,
});
const sparks = new Points(sparkGeom, sparkMat);

const WHITE = new Color(1, 1, 1);
const tintColor = new Color();
watch(
  tint,
  (hex) => {
    tintColor.set(hex);
    haloMat.color.copy(tintColor);
    // The core is the same hue pushed most of the way to white, so the middle of
    // the orb blows out instead of reading as a brighter blob of the halo — and
    // so the ASCII ramp has somewhere above the halo left to go.
    coreMat.color.copy(tintColor).lerp(WHITE, 0.72);
  },
  { immediate: true }
);

// Parsed once per edit, then read as six loose numbers in the paint loop: the
// ramp is evaluated per spark per frame, and `Color.lerpColors` there would mean
// an allocation per particle (issue #4).
const hotC = new Color();
const midC = new Color();
const coolC = new Color();
watch(
  [sparkHot, sparkMid, sparkCool],
  ([h, m, c]) => {
    hotC.set(h);
    midC.set(m);
    coolC.set(c);
  },
  { immediate: true }
);

// Both buffers are rewritten every frame but their bounding spheres are not, so
// frustum culling would test a stale volume and pop the sparks out of existence
// near the edge of the frame. This is one point cloud and two sprites; skip it.
for (const o of [halo, core, sparks]) o.frustumCulled = false;

const groupRef = shallowRef<Group | null>(null);

// Reused scratch — nothing allocated per frame (issue #4).
const pos = new Vector3();
const vel = new Vector3();
const target = new Vector3();
const scratch = new Vector3();
const ndc = new Vector3();
const camWorld = new Vector3();
const headWorld = new Vector3();
let headGroup: Object3D | null = null;
let reveal = 0;
let seeded = false;
let physAcc = 0;

const clearSparks = () => {
  sparkLifespan.fill(0);
  sparkCol.fill(0);
  sparkAcc = 0;
  sparkPosAttr.needsUpdate = true;
  sparkColAttr.needsUpdate = true;
};

/** One fixed substep of the orb. `t` is wall time, for the wander phases. */
const stepOrb = (dt: number, t: number) => {
  // Gravity toward the cursor point: the pull grows with distance, so no escape.
  vel.addScaledVector(scratch.subVectors(target, pos), pull.value * dt);
  // The fly. Depth wanders at half rate — swinging as freely toward the lens as
  // it does across it reads as a size glitch rather than as flight.
  const w = wander.value * dt;
  vel.x += Math.sin(t * 1.7) * Math.cos(t * 0.93 + 1.3) * w;
  vel.y += Math.sin(t * 1.31 + 2.1) * Math.cos(t * 2.27 + 0.7) * w;
  vel.z += Math.sin(t * 0.83 + 4.2) * Math.cos(t * 1.91 + 2.9) * w * 0.5;
  vel.multiplyScalar(Math.exp(-drag.value * dt));
  // Never at rest, and never off to the races.
  const s = vel.length();
  if (s < 1e-6) vel.set(minSpeed.value, 0, 0);
  else if (s < minSpeed.value) vel.multiplyScalar(minSpeed.value / s);
  else if (s > maxSpeed.value) vel.multiplyScalar(maxSpeed.value / s);
  pos.addScaledVector(vel, dt);
};

/** Shed one spark at wherever the orb is right now. */
const emitSpark = () => {
  const i = sparkCursor++ % POOL;
  const k = i * 3;
  // Born inside the orb, not at a point: a single source pixel would read as a
  // seam once they start falling.
  const r = size.value * 0.5;
  sparkPos[k] = pos.x + (Math.random() - 0.5) * r;
  sparkPos[k + 1] = pos.y + (Math.random() - 0.5) * r;
  sparkPos[k + 2] = pos.z + (Math.random() - 0.5) * r;
  const inh = inherit.value;
  const j = scatter.value;
  sparkVel[k] = vel.x * inh + (Math.random() - 0.5) * j;
  // The updraft is what makes it read as heat rather than as shedding: an ember
  // rises off the flame for a moment before its own weight takes it back down.
  sparkVel[k + 1] = vel.y * inh + (Math.random() - 0.5) * j + updraft.value;
  sparkVel[k + 2] = vel.z * inh + (Math.random() - 0.5) * j;
  sparkAge[i] = 0;
  sparkPhase[i] = Math.random() * Math.PI * 2;
  // Spread the lifetimes, or a steady rate makes them die in visible ranks.
  sparkLifespan[i] = sparkLife.value * (0.7 + Math.random() * 0.6);
};

/** One fixed substep of every live spark, plus this substep's share of new ones. */
const stepSparks = (dt: number) => {
  const fall = sparkGravity.value * dt;
  const keep = Math.exp(-sparkDrag.value * dt);
  for (let i = 0; i < POOL; i++) {
    const life = sparkLifespan[i]!;
    if (life <= 0) continue;
    const age = sparkAge[i]! + dt;
    if (age >= life) {
      sparkLifespan[i] = 0;
      continue;
    }
    sparkAge[i] = age;
    const k = i * 3;
    const vx = sparkVel[k]! * keep;
    const vy = sparkVel[k + 1]! * keep - fall;
    const vz = sparkVel[k + 2]! * keep;
    sparkVel[k] = vx;
    sparkVel[k + 1] = vy;
    sparkVel[k + 2] = vz;
    sparkPos[k] = sparkPos[k]! + vx * dt;
    sparkPos[k + 1] = sparkPos[k + 1]! + vy * dt;
    sparkPos[k + 2] = sparkPos[k + 2]! + vz * dt;
  }
  // Inside the substep, so a fast orb lays its sparks along the path it flew
  // rather than dropping the whole frame's worth at its final position.
  sparkAcc += sparkRate.value * dt;
  while (sparkAcc >= 1) {
    emitSpark();
    sparkAcc -= 1;
  }
};

/**
 * Repaint the pool once per frame: each spark flares white-hot, burns down
 * through the ramp, and goes out.
 *
 * Colour and brightness are separate stories here, which is the difference
 * between something burning and a dot fading. The RAMP carries the cooling — hot
 * → burning → dying, all three tunable — while the ENVELOPE (a fast flare, then
 * a long decay) carries how much of it there is. A single-colour spark fading
 * out has only the second half of that, which is why it read as one trail
 * particle instead of an ember.
 */
const paintSparks = (fade: number, elapsed: number) => {
  const gain = sparkGain.value * fade;
  const hz = sparkFlicker.value;
  for (let i = 0; i < POOL; i++) {
    const k = i * 3;
    const life = sparkLifespan[i]!;
    if (life <= 0) {
      sparkCol[k] = 0;
      sparkCol[k + 1] = 0;
      sparkCol[k + 2] = 0;
      continue;
    }
    const t = sparkAge[i]! / life;
    let r: number;
    let g: number;
    let b: number;
    if (t < BURN_POINT) {
      const u = t / BURN_POINT;
      r = hotC.r + (midC.r - hotC.r) * u;
      g = hotC.g + (midC.g - hotC.g) * u;
      b = hotC.b + (midC.b - hotC.b) * u;
    } else {
      const u = (t - BURN_POINT) / (1 - BURN_POINT);
      r = midC.r + (coolC.r - midC.r) * u;
      g = midC.g + (coolC.g - midC.g) * u;
      b = midC.b + (coolC.b - midC.b) * u;
    }
    const flick = 0.7 + 0.3 * Math.sin(elapsed * hz + sparkPhase[i]!);
    const a = Math.min(1, t / 0.05) * Math.pow(1 - t, 1.4) * flick * gain;
    sparkCol[k] = r * a;
    sparkCol[k + 1] = g * a;
    sparkCol[k + 2] = b * a;
  }
  sparkPosAttr.needsUpdate = true;
  sparkColAttr.needsUpdate = true;
};

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const group = groupRef.value;
  const cam = camera.activeCamera.value;
  if (!group || !cam) return;

  // Alive exactly while the head is tracking the cursor — and only if there IS a
  // cursor. On touch, `pointer` never leaves (0,0), so the orb would otherwise
  // sit buzzing in the middle of the screen around nothing. Reduced motion drops
  // it outright: it is pure motion, there is no calmer version of it to show.
  const wanted =
    reducedMotion.value || !pointerActive.value ? 0 : store.addressing;
  reveal += (wanted - reveal) * (1 - Math.exp(-6 * delta));
  if (wanted === 0 && reveal < 0.002) {
    group.visible = false;
    // Nothing to look at: the head falls back to the raw cursor.
    gaze.influence = 0;
    // Re-seed on the way back in, or a beat scrolled away and returned to hands
    // back a cloud of sparks hanging wherever the orb left them.
    seeded = false;
    return;
  }
  group.visible = true;

  // The centre of gravity: the cursor, unprojected onto the ray under it at a
  // fraction of the camera→head distance. Both ends are live — the camera is
  // driven by the scroll and the head floats — so the point tracks the pose
  // rather than assuming the one the finale was composed at. The camera pose
  // itself is one frame old here (Scene3D writes it in the after-render `@loop`,
  // like SignalField and the spotlights see it); on an orb that is already
  // orbiting, a frame of lag on its centre is not a thing you can see.
  cam.updateMatrixWorld();
  cam.getWorldPosition(camWorld);
  if (!headGroup) {
    // @types/three ships two structurally-divergent Object3D declarations (a
    // deep src path and the TresJS-augmented build path), so the lookup's
    // result and the annotation above are nominally different types; the cast
    // pins them together. Same quirk ScrollSpotlights documents.
    headGroup =
      (scene.value?.getObjectByName("headGroup") as Object3D | undefined) ??
      null;
  }
  let headDist = FALLBACK_HEAD_DIST;
  if (headGroup) {
    headGroup.updateWorldMatrix(true, false);
    headWorld.setFromMatrixPosition(headGroup.matrixWorld);
    headDist = camWorld.distanceTo(headWorld);
  }
  const reach = Math.max(0.12, headDist * depthFrac.value);
  // `usePointer`'s y is +1 at the BOTTOM (screen space); NDC wants +1 at the top.
  target
    .set(pointer.value.x, -pointer.value.y, 0.5)
    .unproject(cam)
    .sub(camWorld)
    .normalize()
    .multiplyScalar(reach)
    .add(camWorld);

  if (!seeded) {
    pos.copy(target);
    // Any non-radial kick will do — the wander takes it from there.
    vel.set(minSpeed.value, minSpeed.value * 0.5, 0);
    clearSparks();
    seeded = true;
    physAcc = 0;
  }

  // Fixed-step integration, so the orbit and the spray are the same shape at 30
  // and at 144fps.
  physAcc += Math.min(delta, MAX_FRAME);
  let t = elapsed - physAcc;
  while (physAcc >= PHYS_STEP) {
    stepOrb(PHYS_STEP, t);
    stepSparks(PHYS_STEP);
    physAcc -= PHYS_STEP;
    t += PHYS_STEP;
  }
  paintSparks(reveal, elapsed);

  core.position.copy(pos);
  halo.position.copy(pos);
  sparkMat.size = sparkSize.value;

  // Publish where the orb ended up, on screen, for the head to aim at. Projected
  // here rather than in Scene3D because the camera's matrices were refreshed at
  // the top of this callback and the head is written in the AFTER-render `@loop`
  // — doing it there would mix this frame's orb with next frame's camera. The
  // clamp is insurance: a cursor flick can briefly throw the orb past the edge of
  // the frame, and the head has no business turning further than the corner.
  ndc.copy(pos).project(cam);
  gaze.x = ndc.x < -1 ? -1 : ndc.x > 1 ? 1 : ndc.x;
  // NDC is +1 at the TOP; `pointer` (and therefore the head) is +1 at the bottom.
  const gy = -ndc.y;
  gaze.y = gy < -1 ? -1 : gy > 1 ? 1 : gy;
  gaze.influence = reveal;
  // A shimmer, plus a little extra brightness when it is moving fast — the dart
  // between two hovers is the moment worth seeing.
  //
  // Measured from the FLOOR, not from zero, and full at twice it. `maxSpeed` is
  // a safety rail the orb essentially never touches, and scaling against it
  // pinned this at a constant — the flare never fired. From the floor it reads
  // as what it should: at rest the orb hovers at exactly `minSpeed` and this is
  // 0, and it only lights up when the cursor actually moves and the orb has to
  // chase, which is the one moment worth marking.
  const flicker = 0.86 + 0.14 * Math.sin(elapsed * 9.3);
  const over = (vel.length() - minSpeed.value) / Math.max(0.05, minSpeed.value);
  const rush = over < 0 ? 0 : over > 1 ? 1 : over;
  core.scale.setScalar(size.value * (0.92 + 0.16 * rush));
  halo.scale.setScalar(size.value * haloScale.value);
  coreMat.opacity = reveal * flicker * (0.7 + 0.3 * rush);
  haloMat.opacity = reveal * flicker * 0.45;
});

onBeforeUnmount(() => {
  // The gaze is module-level and outlives this component; leaving a stale
  // influence behind would have the head aiming at an orb that no longer exists.
  gaze.influence = 0;
  sparkGeom.dispose();
  sparkMat.dispose();
  haloMat.dispose();
  coreMat.dispose();
  glowTexture?.dispose();
});
</script>

<template>
  <!-- Positions are computed in world space, so the group stays at the origin
       (world == local), exactly like SignalField's. -->
  <TresGroup ref="groupRef" :visible="false">
    <primitive :object="sparks" />
    <primitive :object="halo" />
    <primitive :object="core" />
  </TresGroup>
</template>
