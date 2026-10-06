<script setup lang="ts">
import { computed, watchEffect, onBeforeUnmount } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  Vector3,
} from "three";
import type { Object3D, PerspectiveCamera, PointLight } from "three";
import { useWindowSize } from "@vueuse/core";
import { createDots, setDotScale, mulberry32, smoothstep, clamp01 } from "./setpieces/lineArt";

/**
 * The air in the room: a sparse field of drifting motes and fireflies around the
 * head, for the stretches of the scroll where nothing else moves.
 *
 * Not a set-piece. It belongs to no chapter, so it lives for the whole page and
 * everything it does is a per-section PROFILE interpolated between section
 * centres (the same anchors the camera arrives at), so chapters hand over
 * without a pop:
 *
 *   strength  how much of the field is there at all. The vine brings its own
 *             pollen, so projects keeps it low; biography and the outro, which
 *             otherwise sit on a black field, turn it up.
 *   embers    skills: the motes turn the accent's orange, flicker, and rise on
 *             their own as if shed by the logos streaming past.
 *   pull      contact: the motes are drawn into the head, one by one, and go out
 *             as they arrive — the "receive" broadcast, taking things in.
 *   planets   outro: a mote near one of the orbiting lights takes its colour and
 *             brightens, so the planets light the air as well as the face.
 *
 * And, on every section, the cursor: motes near it are pushed aside and swirl
 * round it, settling back once it has gone, and faint lines join the ones close
 * to it into a small constellation.
 *
 * The motes are real points in world space, spread over a box around the head,
 * so the camera's own travel gives them parallax for free; the scroll lifts them
 * too, the near ones faster (see `scrollLift`). They drift on summed sines (no
 * noise texture, no allocation), twinkle softly, and every so often one BLINKS —
 * a sharp pulse that warms it toward `hot` — which is the beat that reads as
 * "firefly" rather than "dust".
 *
 * Drawn in the selective-render overlay on the occluded layer (SceneSetPieces
 * wraps it), so they stay crisp instead of being ground into the ASCII grid, and
 * the head hides the ones behind it. Nothing is allocated per frame (issue #4).
 */

const store = useSectionsStore();
const { reducedMotion } = usePreferences();
const { pointer, pointerActive } = usePointer();
const { scene } = useTresContext();
const rawCamera = useRawCamera();

// --- Tuning ------------------------------------------------------------------
const tune = useTuning("ambientMotes", "Ambient motes");
const opacity = tune.num("opacity", 0.9, { min: 0, max: 1.5, step: 0.01, label: "Opacity at full strength" });
const sizeScale = tune.num("size", 1, { min: 0.2, max: 3, step: 0.05, label: "Size" });
const drift = tune.num("drift", 1, { min: 0, max: 3, step: 0.05, label: "Drift amount" });
const speed = tune.num("speed", 1, { min: 0, max: 3, step: 0.05, label: "Drift speed" });
const blinkRate = tune.num("blinkRate", 1, { min: 0, max: 4, step: 0.05, label: "Firefly blink rate" });
/**
 * Scroll parallax: how far (world units) the NEAREST motes rise over the whole
 * page; the farthest rise a quarter of that. The camera's own travel already
 * gives parallax, but it mostly holds still within a section — this is what
 * makes the air move while you scroll through one. 28 viewports of scroll, so
 * 14 is about half a unit per screen up front.
 */
/**
 * Speed streaks: while the page scrolls fast, each mote trails a tail as long as
 * the distance it covers in this many seconds — so it is the scroll parallax
 * made visible, longer up front, and gone the moment the scroll stops.
 */
const streakLength = tune.num("streakLength", 0.07, { min: 0, max: 0.5, step: 0.005, label: "Streaks · length (seconds of motion)" });
const streakOpacity = tune.num("streakOpacity", 0.65, { min: 0, max: 2, step: 0.01, label: "Streaks · brightness" });
const streakStart = tune.num("streakStart", 0.07, { min: 0, max: 0.4, step: 0.005, label: "Streaks · speed before they appear" });
const streakEase = tune.num("streakEase", 3, { min: 0.5, max: 12, step: 0.1, label: "Streaks · how fast they build (1/s)" });
const streakMax = tune.num("streakMax", 0.3, { min: 0.05, max: 1, step: 0.01, label: "Streaks · longest tail (world units)" });
const scrollLift = tune.num("scrollLift", 14, { min: 0, max: 40, step: 0.5, label: "Scroll parallax (lift over the page)" });
const accentMix = tune.num("accentMix", 0.55, { min: 0, max: 1, step: 0.01, label: "Tint toward section accent" });
const baseColor = tune.color("color", "#d6ffb0", { label: "Mote colour" });
const hotColor = tune.color("hot", "#fff4c2", { label: "Blink colour" });

// The cursor. Distances are in screen HEIGHTS (NDC y, aspect-corrected x), so a
// radius of 0.3 is the same size on a phone and a wide monitor.
const repelRadius = tune.num("repelRadius", 0.3, { min: 0, max: 1, step: 0.01, label: "Cursor · radius (screen heights)" });
const repelPush = tune.num("repelPush", 0.12, { min: 0, max: 0.5, step: 0.005, label: "Cursor · push" });
const repelSwirl = tune.num("repelSwirl", 0.08, { min: 0, max: 0.5, step: 0.005, label: "Cursor · swirl" });
const linkDist = tune.num("linkDist", 0.11, { min: 0, max: 0.3, step: 0.005, label: "Cursor · constellation link length" });
const linkOpacity = tune.num("linkOpacity", 0.9, { min: 0, max: 1, step: 0.01, label: "Cursor · constellation opacity" });

/**
 * Centre dimming. The middle of the frame is where the content is — the head,
 * the set-piece, the card — so motes there are turned down and the field reads
 * as framing it rather than as noise in front of it. `centerDim` is how bright
 * a mote is dead centre (1 = no dimming); full brightness from `dimOuter` outward, both
 * radii in NDC on the screen's own ellipse (1 = the edge).
 */
const centerDim = tune.num("centerDim", 0.3, { min: 0, max: 1, step: 0.01, label: "Centre · brightness in the middle" });
const dimInner = tune.num("dimInner", 0.1, { min: 0, max: 1, step: 0.01, label: "Centre · dim radius (inner)" });
const dimOuter = tune.num("dimOuter", 0.75, { min: 0, max: 1.5, step: 0.01, label: "Centre · dim radius (outer)" });

// The chapter behaviours' own knobs (how much each does is the profile below).
const emberRise = tune.num("emberRise", 0.09, { min: 0, max: 0.5, step: 0.005, label: "Embers · rise speed (units/s)" });
const pullPeriod = tune.num("pullPeriod", 7, { min: 1, max: 20, step: 0.5, label: "Pull · seconds per mote" });
const pullTarget = tune.vec3("pullTarget", { x: 0.05, y: 0.12, z: 0.1 }, { label: "Pull · target (head-local)" });
const planetReach = tune.num("planetReach", 0.7, { min: 0.1, max: 2, step: 0.05, label: "Planets · light reach" });

/**
 * The profile per section, keyed by id (registry.ts); a missing section is all
 * zeros. Each value is a dev-panel slider, so the table is only the defaults.
 */
interface Profile {
  strength: number;
  embers: number;
  pull: number;
  planets: number;
}
const PROFILE_DEFAULTS: Record<string, Profile> = {
  identity: { strength: 0, embers: 0, pull: 0, planets: 0 },
  reveal: { strength: 0.15, embers: 0, pull: 0, planets: 0 },
  projects: { strength: 0.35, embers: 0, pull: 0, planets: 0 },
  biography: { strength: 1, embers: 0, pull: 0, planets: 0 },
  skills: { strength: 0.45, embers: 1, pull: 0, planets: 0 },
  contact: { strength: 0.5, embers: 0, pull: 1, planets: 0 },
  outro: { strength: 0.9, embers: 0, pull: 0, planets: 1 },
};
const PROFILE_KEYS = ["strength", "embers", "pull", "planets"] as const;
const profileRefs = Object.entries(PROFILE_DEFAULTS).map(([id, def]) => ({
  id,
  refs: Object.fromEntries(
    PROFILE_KEYS.map((k) => [
      k,
      tune.num(`${k}_${id}`, def[k], { min: 0, max: k === "strength" ? 1.5 : 1, step: 0.01, label: `${id} · ${k}` }),
    ])
  ) as unknown as Record<(typeof PROFILE_KEYS)[number], { value: number }>,
}));
const profileOf = (id: string): Profile => {
  const p = profileRefs.find((r) => r.id === id);
  return p
    ? { strength: p.refs.strength.value, embers: p.refs.embers.value, pull: p.refs.pull.value, planets: p.refs.planets.value }
    : { strength: 0, embers: 0, pull: 0, planets: 0 };
};

// Per-section profile + accent, resolved whenever the sections or the tuning
// change — the loop only reads these, never builds them.
const stops = computed(() =>
  store.sections.map((s, i) => ({
    at: store.anchors[i] ?? 0,
    ...profileOf(s.id),
    accent: new Color(s.accent || baseColor.value),
  }))
);

// --- The field ---------------------------------------------------------------
const COUNT = 320;
// The box the motes live in. Every section's camera sits between z≈0.5 and 1.8
// looking down -z at a head around the origin, and the projects chapter drops to
// y≈-0.9 — so the box runs a little past both, and mostly BEHIND the head where a
// mote reads as depth rather than as dirt on the lens.
const BOX = { x: [-1.7, 1.7], y: [-1.5, 1.15], z: [-2.2, 0.35] } as const;

// Tinted: colour is resolved per mote (accent, embers, planet light) and the
// material's own `uColor` is held at white.
const field = createDots(COUNT, { color: "#ffffff", hot: hotColor.value, tinted: true });
const tint = field.tint!;
const home = new Float32Array(COUNT * 3);
const baseSize = new Float32Array(COUNT);
// Two drift frequencies per mote and a phase, so no two wander alike.
const fA = new Float32Array(COUNT);
const fB = new Float32Array(COUNT);
const phase = new Float32Array(COUNT);
const amp = new Float32Array(COUNT);
// Blink: its own rate and phase. Only ~1 in 4 motes is a firefly at all.
const blinkF = new Float32Array(COUNT);
const blinkP = new Float32Array(COUNT);
const isFly = new Uint8Array(COUNT);
// How much of the scroll lift each mote gets: 1 at the front of the box, 0.25
// at the back, so the near ones overtake the far ones as you scroll.
const depth = new Float32Array(COUNT);
// Embers rise at their own pace each, or they would go up as a sheet.
const riseVar = new Float32Array(COUNT);
// Pull: where each mote is in its own trip to the head, and how fast it goes.
const pullP = new Float32Array(COUNT);
const pullF = new Float32Array(COUNT);
// The cursor push, smoothed per mote, in screen heights.
const offX = new Float32Array(COUNT);
const offY = new Float32Array(COUNT);
const BOX_H = BOX.y[1] - BOX.y[0];
// Over this much of the box's height at each end a mote fades, so the wrap from
// top back to bottom never pops.
const WRAP_FADE = 0.25;
{
  const rnd = mulberry32(0x6f1e);
  const lerp = (r: readonly [number, number], t: number) => r[0] + (r[1] - r[0]) * t;
  for (let i = 0; i < COUNT; i++) {
    home[i * 3] = lerp(BOX.x, rnd());
    home[i * 3 + 1] = lerp(BOX.y, rnd());
    // Biased toward the back: depth is where the field earns its keep.
    home[i * 3 + 2] = lerp(BOX.z, Math.pow(rnd(), 0.7));
    // World units, not pixels: at the ~2.5 units most of them sit from the lens
    // the smallest lands near 4px and the rare large one past 12.
    baseSize[i] = 0.022 + Math.pow(rnd(), 3) * 0.05;
    fA[i] = 0.05 + rnd() * 0.12;
    fB[i] = 0.03 + rnd() * 0.09;
    phase[i] = rnd() * Math.PI * 2;
    amp[i] = 0.04 + rnd() * 0.1;
    isFly[i] = rnd() < 0.25 ? 1 : 0;
    blinkF[i] = 0.08 + rnd() * 0.16;
    blinkP[i] = rnd() * Math.PI * 2;
    depth[i] = 0.25 + 0.75 * ((home[i * 3 + 2]! - BOX.z[0]) / (BOX.z[1] - BOX.z[0]));
    riseVar[i] = 0.55 + rnd() * 0.9;
    pullP[i] = rnd();
    pullF[i] = 0.7 + rnd() * 0.6;
  }
}

// --- Constellation lines -----------------------------------------------------
// The motes near the cursor, joined to each other. Additive, so a link fades by
// darkening its vertex colours — the same trick the orb's sparks use.
const LINK_CANDIDATES = 28;
const MAX_LINKS = 48;
const linkPos = new Float32Array(MAX_LINKS * 6);
const linkCol = new Float32Array(MAX_LINKS * 6);
const linkGeom = new BufferGeometry();
const linkPosAttr = new BufferAttribute(linkPos, 3);
const linkColAttr = new BufferAttribute(linkCol, 3);
linkGeom.setAttribute("position", linkPosAttr);
linkGeom.setAttribute("color", linkColAttr);
linkGeom.setDrawRange(0, 0);
const linkMat = new LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  blending: AdditiveBlending,
  depthWrite: false,
});
const links = new LineSegments(linkGeom, linkMat);
links.frustumCulled = false;
// --- Speed streaks -------------------------------------------------------------
// One tail per mote at most, drawn only while the scroll is fast enough to earn
// one. Same additive vertex-colour fade as the links.
const tailPos = new Float32Array(COUNT * 6);
const tailCol = new Float32Array(COUNT * 6);
const tailGeom = new BufferGeometry();
const tailPosAttr = new BufferAttribute(tailPos, 3);
const tailColAttr = new BufferAttribute(tailCol, 3);
tailGeom.setAttribute("position", tailPosAttr);
tailGeom.setAttribute("color", tailColAttr);
tailGeom.setDrawRange(0, 0);
const tailLines = new LineSegments(tailGeom, linkMat);
tailLines.frustumCulled = false;
tailLines.visible = false;
let lastP = -1;
let scrollVel = 0;

// Scratch for the candidates: screen position, world position, closeness.
const candIdx = new Int32Array(LINK_CANDIDATES);
const candSX = new Float32Array(LINK_CANDIDATES);
const candSY = new Float32Array(LINK_CANDIDATES);
const candW = new Float32Array(LINK_CANDIDATES);

// --- Scene lookups -----------------------------------------------------------
// Found once and kept: the head group and the planets' lights live for the
// whole page (the lights sit at intensity 0 until the coda — see Planets.vue).
let headObj: Object3D | null = null;
const planetLights: PointLight[] = [];
const PLANETS_MAX = 8;
const planetPos = new Float32Array(PLANETS_MAX * 3);
const planetCol = new Float32Array(PLANETS_MAX * 3);
const planetLvl = new Float32Array(PLANETS_MAX);
const findScene = () => {
  const scn = scene.value;
  if (!scn) return;
  // Through `unknown`: @types/three resolves Object3D via two module paths and
  // the scene hands back the other one (the same quirk SignalField hits).
  if (!headObj) headObj = (scn.getObjectByName("headGroup") as unknown as Object3D | undefined) ?? null;
  if (!planetLights.length) {
    const g = scn.getObjectByName("planets");
    g?.traverse((o) => {
      if ((o as PointLight).isPointLight && planetLights.length < PLANETS_MAX) planetLights.push(o as PointLight);
    });
  }
};

const mixed = new Color();
const sectionCol = new Color();
const hot = new Color();
const v = new Vector3();
const camRight = new Vector3();
const camUp = new Vector3();
const attractor = new Vector3();
let riseAcc = 0;

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  // The profile at the current scroll position, piecewise-linear between
  // section centres; held flat before the first and after the last.
  const s = stops.value;
  const p = store.progress;
  let strength = 0;
  let embers = 0;
  let pull = 0;
  let planets = 0;
  if (s.length) {
    let k = 0;
    while (k < s.length - 1 && p > s[k + 1]!.at) k++;
    const a = s[k]!;
    const b = s[Math.min(k + 1, s.length - 1)]!;
    const t = b === a ? 0 : smoothstep(a.at, b.at, p);
    strength = a.strength + (b.strength - a.strength) * t;
    embers = a.embers + (b.embers - a.embers) * t;
    pull = a.pull + (b.pull - a.pull) * t;
    planets = a.planets + (b.planets - a.planets) * t;
    mixed.copy(a.accent).lerp(b.accent, t);
  }

  // Scroll speed, in progress per second, eased so a single wheel notch is a
  // flick of a tail rather than a strobe. Read off the (already smoothed)
  // progress, so it is the speed the scene is moving at, not the raw wheel.
  // Tracked every frame, visible or not, and seeded on the first, so neither a
  // mid-page reload nor the field fading in reads as one enormous jump.
  if (lastP < 0) lastP = p;
  const vdt = Math.min(delta, 0.1);
  if (vdt > 0) {
    const raw = (p - lastP) / vdt;
    // Slow on purpose: the tails grow in over ~a third of a second of sustained
    // scrolling instead of snapping on with the first notch.
    scrollVel += (raw - scrollVel) * (1 - Math.exp(-vdt * streakEase.value));
  }
  lastP = p;

  const still = reducedMotion.value;
  if (still) strength *= 0.6;
  const visible = strength > 0.002;
  field.points.visible = visible;
  links.visible = false;
  tailLines.visible = false;
  if (!visible) return;

  findScene();
  const cam = rawCamera() as PerspectiveCamera | undefined;
  if (!cam) return;
  const dt = Math.min(delta, 0.1);

  const u = field.material.uniforms;
  u.uOpacity!.value = strength * opacity.value;
  (u.uHot!.value as Color).set(hotColor.value);
  // The mote colour for this frame, before any planet light: base toward the
  // section accent, and all the way to it as the embers take over.
  sectionCol.set(baseColor.value).lerp(mixed, accentMix.value + (1 - accentMix.value) * embers * 0.9);
  hot.set(hotColor.value);

  const time = still ? 0 : elapsed * speed.value;
  const amt = drift.value;
  const sz = sizeScale.value;
  const blink = still ? 0 : blinkRate.value;
  // Reduced motion drops the scroll parallax too: it is motion the visitor
  // didn't ask for, even if their scroll set it off.
  const lift = still ? 0 : p * scrollLift.value;
  // Integrated rather than `elapsed * embers`, so motes keep where they rose to
  // as the embers fade out instead of all dropping back at once.
  if (!still) riseAcc += dt * emberRise.value * embers;

  // Pull target: a point on the face, riding the head's live matrix.
  const pulling = pull > 0.001 && !still && !!headObj;
  if (pulling) {
    attractor.set(pullTarget.x, pullTarget.y, pullTarget.z);
    headObj!.localToWorld(attractor);
  }

  // Planet lights: where they are, their colour, and how lit (0..1).
  const lit = planets > 0.001 ? planetLights.length : 0;
  for (let l = 0; l < lit; l++) {
    const L = planetLights[l]!;
    L.getWorldPosition(v);
    planetPos[l * 3] = v.x;
    planetPos[l * 3 + 1] = v.y;
    planetPos[l * 3 + 2] = v.z;
    planetCol[l * 3] = L.color.r;
    planetCol[l * 3 + 1] = L.color.g;
    planetCol[l * 3 + 2] = L.color.b;
    planetLvl[l] = clamp01(L.intensity / 3) * planets;
  }
  const reach2 = planetReach.value * planetReach.value;

  // What the near motes are doing in world units/s; each scales it by depth.
  const liftVel = still ? 0 : scrollVel * scrollLift.value;
  const tailK = streakLength.value;
  const tailOn = tailK > 0 && Math.abs(liftVel) > 0.01;
  let tails = 0;

  // The cursor, in NDC (y up), and the camera's screen axes in world space.
  const cursorOn = pointerActive.value && !still && repelRadius.value > 0;
  const aspect = cam.aspect || 1;
  const cx = pointer.value.x * aspect;
  const cy = -pointer.value.y;
  const R = repelRadius.value;
  const tanHalf = Math.tan(((cam.fov || 45) * Math.PI) / 360);
  camRight.setFromMatrixColumn(cam.matrixWorld, 0);
  camUp.setFromMatrixColumn(cam.matrixWorld, 1);
  const follow = 1 - Math.exp(-dt * 5);
  let cands = 0;
  const camPos = cam.position;

  for (let i = 0; i < COUNT; i++) {
    const o = i * 3;
    const ph = phase[i]!;
    const a = amp[i]! * amt;
    let x =
      home[o]! +
      (Math.sin(time * fA[i]! * 6.28 + ph) + 0.5 * Math.sin(time * fB[i]! * 9.1 + ph * 1.7)) * a +
      embers * Math.sin(elapsed * (1.5 + fA[i]! * 8) + ph) * 0.03;
    // Rise with the scroll (and the embers), wrapped inside the box — a double
    // mod so a negative offset still lands in range — faded at both ends.
    let yr = (home[o + 1]! - BOX.y[0] + lift * depth[i]! + riseAcc * riseVar[i]!) % BOX_H;
    if (yr < 0) yr += BOX_H;
    const wrap = smoothstep(0, WRAP_FADE, yr) * smoothstep(BOX_H, BOX_H - WRAP_FADE, yr);
    let y = BOX.y[0] + yr + (Math.sin(time * fB[i]! * 6.28 + ph * 2.3) + 0.4 * Math.cos(time * fA[i]! * 7.3)) * a * 0.8;
    let z = home[o + 2]! + Math.cos(time * fA[i]! * 5.1 + ph * 0.6) * a;

    // Pull: each mote on its own loop out of its place and into the face,
    // accelerating as it goes (t²), gone on arrival and back at home after.
    let pullFade = 1;
    if (pulling) {
      const t = (elapsed / pullPeriod.value * pullF[i]! + pullP[i]!) % 1;
      const e = t * t * pull;
      x += (attractor.x - x) * e;
      y += (attractor.y - y) * e;
      z += (attractor.z - z) * e;
      pullFade = 1 - pull + pull * smoothstep(0, 0.12, t) * smoothstep(1, 0.75, t);
    }

    // Cursor: where the mote lands on screen decides its push, which is eased
    // per mote so it swirls off and settles back rather than snapping.
    let tx = 0;
    let ty = 0;
    let dist = 1;
    {
      const dx = x - camPos.x;
      const dy = y - camPos.y;
      const dz = z - camPos.z;
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    let sx = 0;
    let sy = 0;
    // Projected every frame, cursor or not: the centre dimming needs it too.
    v.set(x, y, z).project(cam);
    const onScreen = v.z < 1;
    // Centre dimming, on an ellipse that matches the screen (raw NDC, not
    // aspect-corrected): 0 in the middle, 1 at the rim.
    const rim = onScreen ? smoothstep(dimInner.value, dimOuter.value, Math.sqrt(v.x * v.x + v.y * v.y)) : 1;
    const dim = centerDim.value + (1 - centerDim.value) * rim;
    if (cursorOn) {
      sx = v.x * aspect;
      sy = v.y;
      const ex = sx - cx;
      const ey = sy - cy;
      const d = Math.sqrt(ex * ex + ey * ey);
      if (onScreen && d < R && d > 1e-4) {
        const f = (1 - d / R) * (1 - d / R);
        tx = (ex / d) * f * repelPush.value - (ey / d) * f * repelSwirl.value;
        ty = (ey / d) * f * repelPush.value + (ex / d) * f * repelSwirl.value;
      }
    }
    offX[i] = offX[i]! + (tx - offX[i]!) * follow;
    offY[i] = offY[i]! + (ty - offY[i]!) * follow;
    // Screen heights → world at this mote's distance. `camRight` is per screen
    // HEIGHT too, since `sx` was aspect-corrected above.
    const k = dist * tanHalf;
    const wx = (camRight.x * offX[i]! + camUp.x * offY[i]!) * k;
    const wy = (camRight.y * offX[i]! + camUp.y * offY[i]!) * k;
    const wz = (camRight.z * offX[i]! + camUp.z * offY[i]!) * k;
    x += wx;
    y += wy;
    z += wz;
    field.position[o] = x;
    field.position[o + 1] = y;
    field.position[o + 2] = z;

    // Fade anything that drifts up against the lens: up close a 2cm speck is a
    // blurry disc the width of the screen.
    const near = smoothstep(0.3, 0.75, dist);

    // Soft twinkle for everyone; fireflies add a rare, sharp blink on top, and
    // embers a fast flicker.
    const tw = 0.25 + 0.2 * Math.sin(elapsed * (0.6 + fA[i]! * 4) + ph);
    let g = 0;
    if (isFly[i] && blink > 0) {
      const w = Math.sin(elapsed * blinkF[i]! * blink * 6.28 + blinkP[i]!);
      g = w > 0 ? Math.pow(w, 18) : 0;
    }
    if (embers > 0 && !still) {
      const fl = Math.sin(elapsed * (9 + fB[i]! * 60) + ph) * Math.sin(elapsed * (5.3 + fA[i]! * 30));
      g = Math.max(g, embers * (0.2 + 0.25 * fl));
    }

    // Planet light: tint toward whichever lights are near, and brighten.
    let r = sectionCol.r;
    let gg = sectionCol.g;
    let b = sectionCol.b;
    let caught = 0;
    for (let l = 0; l < lit; l++) {
      const qx = x - planetPos[l * 3]!;
      const qy = y - planetPos[l * 3 + 1]!;
      const qz = z - planetPos[l * 3 + 2]!;
      const w = planetLvl[l]! * Math.exp(-(qx * qx + qy * qy + qz * qz) / reach2);
      if (w < 0.01) continue;
      r += (planetCol[l * 3]! - r) * w;
      gg += (planetCol[l * 3 + 1]! - gg) * w;
      b += (planetCol[l * 3 + 2]! - b) * w;
      caught += w;
    }

    // Additive, so darkening the colour IS dimming it. The glow is scaled too,
    // or a blink would still flare to full `hot` in the middle of the frame.
    tint[o] = r * dim;
    tint[o + 1] = gg * dim;
    tint[o + 2] = b * dim;

    field.glow[i] = Math.min(1, tw * 0.4 + g + Math.min(0.5, caught * 0.5)) * dim;
    const size =
      baseSize[i]! * sz * near * wrap * pullFade * (0.6 + 0.4 * dim) * (1 + g * 1.6 + Math.min(0.6, caught * 0.6));
    field.size[i] = size;

    // Speed streak: a tail trailing the mote's scroll motion, as long as the
    // distance it covers in `streakLength` seconds. Bright at the mote, black
    // (so: gone, additively) at the end. The dot itself thins a little as the
    // tail grows, so the two read as one streak and not a dot with a line.
    if (tailOn) {
      const ty = liftVel * depth[i]! * tailK;
      // A threshold, so an ordinary scroll stays dots and only a real fling
      // streaks, ramping in over 3× the threshold rather than at once.
      const fast = smoothstep(streakStart.value, streakStart.value * 4, Math.abs(ty));
      if (fast > 0.01 && size > 0.005) {
        // Capped, or a hard fling turns the field into rain.
        const len = Math.max(-streakMax.value, Math.min(streakMax.value, ty));
        const q = tails * 6;
        tailPos[q] = x;
        tailPos[q + 1] = y;
        tailPos[q + 2] = z;
        tailPos[q + 3] = x;
        tailPos[q + 4] = y - len;
        tailPos[q + 5] = z;
        const a = Math.min(1, fast * streakOpacity.value * strength * opacity.value * near * wrap * pullFade);
        tailCol[q] = tint[o]! * a;
        tailCol[q + 1] = tint[o + 1]! * a;
        tailCol[q + 2] = tint[o + 2]! * a;
        tailCol[q + 3] = 0;
        tailCol[q + 4] = 0;
        tailCol[q + 5] = 0;
        tails++;
        field.size[i] = size * (1 - 0.35 * fast);
      }
    }

    // Constellation candidates: on screen, near the cursor, actually visible.
    if (cursorOn && onScreen && size > 0.01 && cands < LINK_CANDIDATES) {
      const ex = sx - cx;
      const ey = sy - cy;
      const d = Math.sqrt(ex * ex + ey * ey);
      if (d < R * 1.2) {
        candIdx[cands] = i;
        // Re-projected with the push applied, so the lines meet the dots.
        candSX[cands] = sx + offX[i]!;
        candSY[cands] = sy + offY[i]!;
        candW[cands] = 1 - d / (R * 1.2);
        cands++;
      }
    }
  }
  field.flush({ size: true, tint: true });
  tailGeom.setDrawRange(0, tails * 2);
  tailLines.visible = tails > 0;
  if (tails > 0) {
    tailPosAttr.needsUpdate = true;
    tailColAttr.needsUpdate = true;
  }

  // Join the candidates that are close to each other on screen.
  let n = 0;
  const L = linkDist.value;
  const lo = linkOpacity.value * strength;
  if (cands > 1 && L > 0 && lo > 0) {
    for (let a = 0; a < cands && n < MAX_LINKS; a++) {
      for (let b = a + 1; b < cands && n < MAX_LINKS; b++) {
        const ex = candSX[a]! - candSX[b]!;
        const ey = candSY[a]! - candSY[b]!;
        const d = Math.sqrt(ex * ex + ey * ey);
        if (d >= L) continue;
        const w = (1 - d / L) * Math.min(candW[a]!, candW[b]!) * lo;
        const ia = candIdx[a]! * 3;
        const ib = candIdx[b]! * 3;
        const q = n * 6;
        linkPos[q] = field.position[ia]!;
        linkPos[q + 1] = field.position[ia + 1]!;
        linkPos[q + 2] = field.position[ia + 2]!;
        linkPos[q + 3] = field.position[ib]!;
        linkPos[q + 4] = field.position[ib + 1]!;
        linkPos[q + 5] = field.position[ib + 2]!;
        linkCol[q] = tint[ia]! * w;
        linkCol[q + 1] = tint[ia + 1]! * w;
        linkCol[q + 2] = tint[ia + 2]! * w;
        linkCol[q + 3] = tint[ib]! * w;
        linkCol[q + 4] = tint[ib + 1]! * w;
        linkCol[q + 5] = tint[ib + 2]! * w;
        n++;
      }
    }
  }
  linkGeom.setDrawRange(0, n * 2);
  if (n > 0) {
    linkPosAttr.needsUpdate = true;
    linkColAttr.needsUpdate = true;
    links.visible = true;
  }
});

// Dots are sized against the canvas height, so they have to be told it.
const { height } = useWindowSize();
watchEffect(() => setDotScale(field, height.value));

onBeforeUnmount(() => {
  field.dispose();
  linkGeom.dispose();
  tailGeom.dispose();
  linkMat.dispose();
});
</script>

<template>
  <TresGroup>
    <primitive :object="field.points" />
    <primitive :object="links" />
    <primitive :object="tailLines" />
  </TresGroup>
</template>
