<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import {
  AdditiveBlending,
  Color,
  PointLight,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import type { Group, Object3D } from "three";
import { createGlowTexture } from "~/lib/glow";
import { HEAD_HALF } from "~/lib/frame";

/**
 * The planets: a handful of coloured lights circling the head at the coda, each
 * on its own orbit, painting the face as they pass.
 *
 * This is the last image of the page, and it is the one beat where the head is
 * an OBJECT rather than a correspondent. The finale before it is a conversation
 * — the head turns to the terminal, watches the cursor, receives what you type.
 * Here the invitation is to take the camera and fly, so the scene stops
 * addressing you and starts behaving like a thing in space that a camera could
 * be flown around. Lights on inclined orbits are how you say that without a
 * word: they give the head a scale, an axis and a near/far side, all of which a
 * static portrait lit from the front hides. (`OutroSection`'s glyph — a lens
 * travelling a tipped ring around a core — is the same picture in CSS.)
 *
 * Alive across the coda only: `store.orbiting` rises over the outro's opening
 * and holds to the bottom of the page, while `store.tracking` releases the
 * cursor over the same stretch — so the fly burns out as the system comes up and
 * exactly one thing is ever pulling at the face. See "The finale (contact)" in
 * docs/scroll-3d-architecture.md.
 *
 * What makes it read as planets
 * -----------------------------
 * Not the colours — the GEOMETRY, and specifically the fact that no two orbits
 * share a plane or a period:
 *
 *  - **Different circumferences.** Radii step outward by `spread`, so the
 *    innermost light skims the cheek and the outermost swings well clear of the
 *    silhouette. One radius for all of them reads as a halo, which is a costume,
 *    not a system.
 *  - **Different periods, and they are not free.** Angular speed falls off as
 *    `r^-1.5` (Kepler's third law, which is the one piece of physics an eye
 *    actually knows): the outer lights visibly lag the inner ones, the whole set
 *    drifts out of phase within a lap or two, and it never repeats while anyone
 *    is watching. Equal speeds would make the five lights one rigid object
 *    spinning — a mobile, not orbits.
 *  - **Different planes.** Each orbit is tilted by its own inclination and
 *    rotated to its own ascending node (stepped by the golden angle, so no two
 *    planes line up at any count). This is what puts lights above and below the
 *    brow instead of all of them crossing the same equator, and it is where the
 *    modelling of the face comes from: a light passing over the head rakes the
 *    forehead, one passing under it lights the jaw from beneath.
 *  - **Precession.** The planes themselves turn, slowly and at their own rates.
 *    Without it a long look settles into a pattern; with it the composition is
 *    never quite the one you saw a lap ago.
 *
 * All of it derives from five knobs and the planet's index — no table of
 * per-planet poses to keep in sync, so changing `count` re-derives the whole
 * system rather than leaving orphaned entries behind.
 *
 * How the face gets painted
 * -------------------------
 * Each planet is a real `PointLight` at the body's own position, so the light
 * arrives from where you can see the source: a planet at the left temple lights
 * that temple, and when it swings behind the head the face goes dark on that
 * side while the body is eclipsed by the very geometry it stopped lighting. That
 * is the whole trick, and it is why these are lights rather than a shader on the
 * face. `decay` 1 and a short `range` match the scroll rig's convention and keep
 * each one a local wash rather than a scene-wide tint.
 *
 * It survives the ASCII pass because the pass keeps the scene's own colour
 * (`useSceneColor`, the default — it multiplies each cell's rgb by the character
 * it picked). So a green light on one cheek and a violet one on the other come
 * out as green and violet characters, and the modelling reads through the grid
 * as a change of hue where it would otherwise only be a change of glyph density.
 *
 * Rendering
 * ---------
 * The bodies are the same additive core+halo sprites the cursor orb is built
 * from, on the default layer, so they go through the ASCII composer with the
 * face instead of sitting on top of it as crisp foreign objects. They are
 * depth-TESTED (and write no depth of their own), which is what lets the head
 * eclipse a planet passing behind it — without that the illusion collapses on
 * the first pass behind the skull.
 *
 * Why the lights are never hidden
 * -------------------------------
 * A pool of `MAX` lights is added to the scene once, at mount, and stays there
 * for the whole page at `intensity` 0 until the coda. Hiding a light (or
 * unmounting it) changes the renderer's lights-state hash, which invalidates
 * every program built against it and recompiles the scene's materials on the
 * next frame — a stutter, and it would land exactly on the beat this exists for.
 * An intensity-0 light costs a few instructions per fragment and nothing else.
 * The SPRITES are hidden when the system is down; sprites are not lights.
 *
 * Reduced motion keeps the lights and stops the clock: the face is still modelled
 * by five coloured sources, they simply hold their positions. Unlike the fly,
 * there IS a calmer version of this, and it is most of the picture.
 *
 * Nothing is allocated per frame (issue #4).
 */
const store = useSectionsStore();
const { scene } = useTresContext();
const { reducedMotion } = usePreferences();

/** Orbits, bodies and lights are all pooled at this count; `count` only decides
 *  how many of them are lit. Raising it means one more always-resident light in
 *  every material's shader — see the note on the pool above. */
const MAX = 5;
/**
 * Kepler's third law: period² ∝ radius³, so angular speed ∝ r^-1.5.
 *
 * Hard-coded rather than tunable because it is not a preference — it is the
 * relationship that makes a set of circles read as orbits. The dial for "how
 * fast is all this" is `speed`, which scales every planet together and leaves
 * the ratios between them alone.
 */
const KEPLER = 1.5;
/** 137.5° — the angle a sunflower uses, and for the same reason: successive
 *  multiples of it never line up, so no two orbital planes coincide at any
 *  count, and the bodies do not start the page in a row. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const MAX_FRAME = 0.1; // a backgrounded tab does not get to resume with a 4s lurch
/** The head's measured silhouette radius (≈ 0.486) — the floor every orbit has
 *  to clear. See `HEAD_HALF` in ~/lib/frame, which is the one place the model is
 *  measured. */
const HEAD_R = Math.hypot(HEAD_HALF.x, HEAD_HALF.y);

// Tagged to the outro so the panel files these knobs under the beat they play in.
const tune = useTuning("planets", "Planets", "outro");
const count = tune.num("count", 5, {
  min: 1,
  max: MAX,
  step: 1,
  label: "How many",
});
/**
 * The innermost orbit, in world units — DERIVED from the head rather than dialled
 * in by eye, because it is a clearance, not a taste.
 *
 * `HEAD_HALF` is the measured silhouette of `head.glb` at the scale Scene3D
 * renders it (0.305 × 0.378 world half-extents), so its diagonal is the radius a
 * planet has to beat to stay outside the face. Anything below it spends part of
 * every lap INSIDE the head: the depth test handles that honestly — the body
 * simply vanishes — but a light appearing out of the bridge of a nose reads as a
 * bug. The 15% is the margin that keeps the inner planet grazing the silhouette
 * rather than clipping it, which is exactly where it lights the cheek most.
 *
 * Swap the model, re-measure `HEAD_HALF` (the note there says how), and the whole
 * system moves out with it.
 */
const radius = tune.num("radius", HEAD_R * 1.15, {
  min: 0.12,
  max: 1.5,
  step: 0.01,
  label: "Inner orbit (world units)",
});
/**
 * How much wider each orbit is than the one inside it (a fraction of the INNER
 * radius, so the whole system scales with `radius`).
 *
 * At 0.12 the five orbits run 0.56 → 0.83. The ceiling is the frame, not taste:
 * the coda's camera sits at x 0.62 with the head at the origin, which leaves only
 * ~0.65 units of world between the head's centre and the left edge of a 16:9
 * frame. Wider than that and the outer planets spend a visible part of each lap
 * outside the shot — fine once (a system bigger than the frame), tiresome for
 * two of the five.
 */
const spread = tune.num("spread", 0.12, {
  min: 0,
  max: 1,
  step: 0.01,
  label: "Orbit spacing (× inner)",
});
/** The INNERMOST planet's angular speed in rad/s; everything else is derived
 *  from it by `KEPLER`. At 0.5 the first light laps the head in ~13s and the
 *  outermost in ~23s — slow enough to read as orbiting rather than spinning, and
 *  far enough apart that the two are never in step. */
const speed = tune.num("speed", 0.5, {
  min: 0,
  max: 3,
  step: 0.01,
  label: "Orbit speed (inner, rad/s)",
});
/** Maximum inclination. At 0 every orbit is flat and the lights all cross the
 *  same equator; at 0.8 rad (~46°) the set covers the face from brow to jaw.
 *  Each planet takes its own fraction of this, both signs. */
const tilt = tune.num("tilt", 0.8, {
  min: 0,
  max: 1.5,
  step: 0.01,
  label: "Orbit tilt (max, rad)",
});
/** How fast the orbital PLANES themselves turn (rad/s). Small on purpose: it is
 *  what stops a long look from settling into a repeating pattern, and at more
 *  than ~0.2 the system reads as tumbling rather than precessing. */
const precess = tune.num("precess", 0.05, {
  min: 0,
  max: 0.4,
  step: 0.005,
  label: "Plane precession (rad/s)",
});
/**
 * The body's radius in world units — read it as a fraction of the head, which is
 * 0.61 across: 0.04 puts a planet at about a fifteenth of the head's width.
 *
 * Sized against the GRID as much as against the head. At the coda the face's
 * ASCII cell is at its fine end (`faceCellFine`, 9px), and the frame is ~1.5
 * world units tall, so this is ~2-3 cells of core inside ~8 cells of halo — a
 * body with a falloff the ramp can resolve. Much smaller and a planet is one
 * flickering character that the grid can quantize away entirely as it moves.
 */
const size = tune.num("size", 0.04, {
  min: 0.004,
  max: 0.12,
  step: 0.002,
  label: "Body size (world units)",
});
const haloScale = tune.num("haloScale", 3.4, {
  min: 1,
  max: 10,
  step: 0.1,
  label: "Halo size (× body)",
});
/**
 * Brightness of the BODIES, which is a separate story from the light they cast.
 *
 * A planet has to survive the same ASCII ramp the orb does: a glyph is picked
 * from a cell's luminance, so a body that peaks mid-ramp comes out as the same
 * grey mush as the lit cheek behind it. Driven a little past saturation it holds
 * the dense end of the ramp and reads as a source.
 */
const glow = tune.num("glow", 1.15, {
  min: 0,
  max: 3,
  step: 0.05,
  label: "Body brightness",
});
/**
 * The light each body casts, in candela — the knob this whole component exists
 * for, and the one to reach for first.
 *
 * With `decay` 1 and a body ~0.25 units off the skin at its closest, 5 lands
 * each planet at roughly a third of the finale's key spotlight: enough to tint a
 * cheek and model a brow, not enough to flatten the face into one saturated
 * glyph. Push it past ~12 and the ASCII ramp tops out wherever a planet is near,
 * which costs the face its features exactly where it is brightest.
 */
const intensity = tune.num("intensity", 5, {
  min: 0,
  max: 30,
  step: 0.1,
  label: "Light intensity (candela)",
});
/** The light's cutoff distance. Short, so a planet lights the head and not the
 *  backdrop — five scene-wide washes would just raise the black level. */
const range = tune.num("range", 2.2, {
  min: 0.3,
  max: 10,
  step: 0.1,
  label: "Light range (world units)",
});
/** A slow breathe on each light, at its own rate and phase, so the set never
 *  pulses in unison. Dropped under reduced motion with the orbits. */
const shimmer = tune.num("shimmer", 0.12, {
  min: 0,
  max: 0.6,
  step: 0.01,
  label: "Brightness shimmer",
});
/** The centre the system orbits, as an offset from the head's own centre (which
 *  is where the head group's origin is). Lifting it puts more of the traffic
 *  across the brow than across the jaw. */
const centre = tune.vec3("centre", { x: 0, y: 0.02, z: 0 }, {
  label: "Orbit centre (offset from the head)",
  anchor: "head",
});
/**
 * One colour per planet, and they are the page's own accents rather than a
 * planetary palette: the green the hero and the terminal are lit in, the blue of
 * the reveal and the biography, the amber of the skills chapter, plus two the
 * page has not used. So the coda reads as every chapter's light coming back
 * round the head at once, which is a better last image than five arbitrary hues.
 */
const colors = [
  tune.color("c1", "#00ff9c", { label: "Planet 1 (inner)" }),
  tune.color("c2", "#9ad1ff", { label: "Planet 2" }),
  tune.color("c3", "#ffb454", { label: "Planet 3" }),
  tune.color("c4", "#ff5470", { label: "Planet 4" }),
  tune.color("c5", "#b06cff", { label: "Planet 5 (outer)" }),
];

// ── The pool ──────────────────────────────────────────────────────────────────
const glowTexture = createGlowTexture();

const spriteMaterial = () =>
  new SpriteMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    // Depth-TESTED (the default) so the head eclipses a planet behind it; no
    // depth WRITE, because this is light — nothing should be hidden by it.
    depthWrite: false,
  });

interface Unit {
  light: PointLight;
  core: Sprite;
  halo: Sprite;
  coreMat: SpriteMaterial;
  haloMat: SpriteMaterial;
  /** Where this planet is on its orbit (rad), integrated per frame rather than
   *  derived from `elapsed`, so turning `speed` moves it from here instead of
   *  teleporting it to wherever the new rate would have put it by now. */
  angle: number;
  /** The orbit plane's own rotation, integrated the same way. */
  node: number;
}

const WHITE = new Color(1, 1, 1);

const pool: Unit[] = Array.from({ length: MAX }, (_, i) => {
  // `decay` 1 matches the scroll spotlight rig (and the scene's other point
  // lights), so intensities here are comparable to the ones in spotlights.ts.
  const light = new PointLight(0xffffff, 0, range.value, 1);
  light.castShadow = false; // the ASCII grid hides shadow detail; keep it cheap
  const coreMat = spriteMaterial();
  const haloMat = spriteMaterial();
  const core = new Sprite(coreMat);
  const halo = new Sprite(haloMat);
  core.visible = false;
  halo.visible = false;
  // Both are rewritten every frame; their bounding spheres are not, so leave
  // culling to the depth test rather than letting a stale volume pop them out.
  core.frustumCulled = false;
  halo.frustumCulled = false;
  return {
    light,
    core,
    halo,
    coreMat,
    haloMat,
    // Spread the starting positions by the golden angle too, so the system does
    // not begin its life with five lights in a row.
    angle: i * GOLDEN * 2,
    node: i * GOLDEN,
  };
});

// Colours change on a panel edit, not per frame.
watch(
  colors,
  (hexes) => {
    hexes.forEach((hex, i) => {
      const u = pool[i]!;
      u.light.color.set(hex);
      u.haloMat.color.set(hex);
      // The core is the same hue pushed most of the way to white, so the middle
      // of a body blows out instead of reading as a brighter blob of its halo —
      // and so the ASCII ramp has somewhere above the halo left to go.
      u.coreMat.color.set(hex).lerp(WHITE, 0.72);
    });
  },
  { immediate: true }
);

// ── The loop ──────────────────────────────────────────────────────────────────
const groupRef = shallowRef<Group | null>(null);
const headCentre = new Vector3();
const pos = new Vector3();
let headGroup: Object3D | null = null;
let idle = false;

/**
 * A point on an inclined, rotated circular orbit.
 *
 * Built in the order a real orbital element list is read: place the body on a
 * circle in the XZ plane (so the flat case orbits the head's own vertical axis),
 * tip that circle by `incl`, then swing the whole plane round by `node`. Writes
 * into `out`; allocates nothing.
 */
const orbitPoint = (
  r: number,
  ang: number,
  incl: number,
  node: number,
  out: Vector3
) => {
  const x = Math.cos(ang) * r;
  const z = Math.sin(ang) * r;
  const ci = Math.cos(incl);
  const si = Math.sin(incl);
  const y1 = -z * si;
  const z1 = z * ci;
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  out.set(x * cn + z1 * sn, y1, -x * sn + z1 * cn);
};

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const group = groupRef.value;
  if (!group) return;

  const reveal = store.orbiting;
  if (reveal < 0.002) {
    // Down, and only the sprites go away — the lights stay in the scene at zero
    // so the material programs built against them stay valid (see the header).
    if (!idle) {
      idle = true;
      for (const u of pool) {
        u.light.intensity = 0;
        u.core.visible = false;
        u.halo.visible = false;
      }
    }
    return;
  }
  idle = false;

  // Orbit the head's live world position — it floats (Levioso) and its keyframed
  // base position moves it about the frame, and a system anchored to the origin
  // instead would drift off it. The head's ROTATION is deliberately not used:
  // planets orbit a body, they are not carried round by its turning.
  // Re-resolve if the cached node was detached (an HMR head swap).
  if (headGroup && !headGroup.parent) headGroup = null;
  if (!headGroup) {
    // @types/three ships two structurally-divergent Object3D declarations (a
    // deep src path and the TresJS-augmented build path), so the lookup's result
    // and the annotation are nominally different types; the cast pins them
    // together. The same quirk CursorOrb and ScrollSpotlights document.
    headGroup =
      (scene.value?.getObjectByName("headGroup") as Object3D | undefined) ?? null;
  }
  if (headGroup) {
    headGroup.updateWorldMatrix(true, false);
    headCentre.setFromMatrixPosition(headGroup.matrixWorld);
  } else {
    headCentre.set(0, 0, 0);
  }
  headCentre.x += centre.x;
  headCentre.y += centre.y;
  headCentre.z += centre.z;

  // One clock for the whole system, stopped under reduced motion so the lights
  // hold the positions they were in rather than snapping back to their phases.
  const dt = reducedMotion.value ? 0 : Math.min(delta, MAX_FRAME);
  const n = Math.round(count.value);
  const inner = radius.value;
  const lit = intensity.value * reveal;
  const bodySize = size.value;
  const haloMul = haloScale.value;
  const shim = reducedMotion.value ? 0 : shimmer.value;

  for (let i = 0; i < MAX; i++) {
    const u = pool[i]!;
    if (i >= n) {
      u.light.intensity = 0;
      u.core.visible = false;
      u.halo.visible = false;
      continue;
    }

    const r = inner * (1 + spread.value * i);
    // Kepler: the outer orbits lag, and by exactly as much as the ratio of the
    // radii says they should.
    u.angle += speed.value * Math.pow(inner / r, KEPLER) * dt;
    // Each plane turns at its own rate (and the outer ones the other way), or
    // "precession" is just the whole system rotating as one rigid thing.
    u.node += precess.value * (i % 2 ? -1 : 1) * (1 - 0.12 * i) * dt;
    // Its own slice of the tilt, both signs, from a formula rather than a table
    // so any `count` gets a spread of planes.
    const incl = tilt.value * Math.sin(i * 1.73 + 0.6);

    orbitPoint(r, u.angle, incl, u.node, pos);
    pos.add(headCentre);

    u.light.position.copy(pos);
    u.core.position.copy(pos);
    u.halo.position.copy(pos);
    u.light.distance = range.value;
    // A breathe per planet, each at its own rate and phase.
    const breathe = 1 + shim * Math.sin(elapsed * (0.7 + 0.23 * i) + i * 1.9);
    u.light.intensity = lit * breathe;

    // Bodies vary in size the way the orbits vary in radius — a system of
    // identical dots reads as a diagram. The sequence is deterministic and works
    // at any count.
    const bodyVar = 0.75 + 0.5 * ((i * 0.618) % 1);
    u.core.scale.setScalar(bodySize * bodyVar);
    u.halo.scale.setScalar(bodySize * bodyVar * haloMul);
    u.coreMat.opacity = reveal * glow.value * breathe;
    u.haloMat.opacity = reveal * glow.value * 0.42 * breathe;
    u.core.visible = true;
    u.halo.visible = true;
  }
});

onBeforeUnmount(() => {
  for (const u of pool) {
    u.light.dispose();
    u.coreMat.dispose();
    u.haloMat.dispose();
  }
  glowTexture?.dispose();
});
</script>

<template>
  <!-- Positions are computed in world space, so the group stays at the origin
       (world == local), exactly like CursorOrb's and SignalField's. The group
       itself is never hidden: it holds the lights, and hiding a light recompiles
       the scene's materials (see the header). -->
  <TresGroup ref="groupRef" name="planets">
    <template v-for="(u, i) in pool" :key="i">
      <primitive :object="u.light" />
      <primitive :object="u.halo" />
      <primitive :object="u.core" />
    </template>
  </TresGroup>
</template>
