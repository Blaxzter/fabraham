<script setup lang="ts">
import { shallowRef, onMounted, onBeforeUnmount } from "vue";
import { useLoop } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  clamp01,
  drawFraction,
  hash01,
  smoothstep,
  wrapDist,
  type SetPieceProps,
} from "./lineArt";

/**
 * Berlin skyline as **SVG line-art**, rendered into the 3D scene as lines,
 * driven **per labelled group**. The art is authored in
 * `public/setpieces/berlin-skyline.svg` where every landmark is a `<g id="…">`
 * (buildings) and the moving extras are top-level `<path id="…">` (`airplane`,
 * `Balloon1/2`, `Cloud1/2`, `bottomline*`). We load it with three's `SVGLoader`,
 * walk each parsed path back up to its nearest id'd ancestor, and build **one
 * LineSegments per group**. Swap the SVG (keep the ids) and the skyline updates —
 * no code change.
 *
 * Four things about this piece are deliberate and easy to undo by accident:
 *
 * **1. It DRAWS itself in, it does not fade in.** Each part reveals itself
 * through `geometry.setDrawRange(0, n)` — the 3D equivalent of animating
 * `stroke-dashoffset` — and the segments are written into the buffer in the
 * order we want the pen to take them: buildings sorted **bottom-up**, so they
 * grow out of the ground; the ground line sorted **left→right**, so the horizon
 * draws across before anything stands on it. This is the pattern `StackFlight`
 * established and the reason that assembly reads as *drawing* rather than
 * *appearing* (docs/scroll-3d-architecture.md → "real brand marks as line art").
 *
 * **2. It is driven by `cardProgress`, not `reveal`.** `reveal` is a bloom that
 * ramps over only a quarter of the card's window, so an entrance hung off it
 * happens inside one notch of a mouse wheel. `SceneSetPieces` hands this piece
 * its card's raw local travel instead, and the whole assembly is scheduled
 * across that. `reveal` still owns the fade in/out. Because the drive is scroll —
 * not time — scrolling back up **un-draws** the skyline; the entrance is
 * reversible, not a one-shot.
 *
 * **3. It is a HORIZON, not a mask.** It is listed in `OCCLUDED_PIECES`, so the
 * head is stamped into the depth buffer first and the skyline is depth-tested
 * against it, and it sits low and pushed back (`HORIZON`) with the buildings
 * topping out around the head's chin. The face stays readable and the head reads
 * as rising above the city instead of being wallpapered over. Nothing here
 * assumes the head is at x=0 — it swerves sideways across the biography cards,
 * and a wide, centred, depth-occluded horizon works wherever it goes.
 *
 * **4. The buildings have DEPTH.** The art is a flat drawing, so each building
 * carries a second copy of its own outline set back in z with rungs tying the
 * two together, and the buildings sit at slightly different ranks front to back
 * (see the extrusion block below). Depth you cannot see is depth you did not
 * add, so the stage also YAWS — with the cursor, and slowly across the card's
 * own travel — which walks the back copies out from behind the front ones. Turn
 * `yaw` down to zero and the whole thing collapses back into a flat drawing
 * wearing a faint echo; that is the number to check first if it ever looks
 * doubled rather than solid.
 *
 * Roles (matched loosely on the id, so SVG typos/casing don't matter):
 *  - building → draws bottom-up, staggered left→right; perpetual "dawn light"
 *    sweep warms each one as it passes, and the cursor lights the ones near it;
 *  - beacon (Fernsehturm) → the above + a blinking landmark beacon;
 *  - plane → flies across the sky on a loop (nose-left, so right→left), banks
 *    toward the cursor's height, edge-fades at the wrap;
 *  - balloon → gentle bob + sway (independent phases);
 *  - cloud → slow drift;
 *  - ground → draws first, left→right, with a faint water-reflection shimmer.
 *
 * Only lines (no fills) so it reads through the ASCII post-process; additive,
 * `depthWrite:false`, everything disposed on unmount (set-piece contract).
 */
const props = withDefaults(defineProps<SetPieceProps>(), {
  reveal: 0,
  variant: "",
  position: () => [0, 0, 0],
  cardProgress: undefined,
});

const { pointer } = usePointer();
const { reducedMotion } = usePreferences();

// Source art + the world size the normalised drawing is scaled to fit. The
// drawing is roughly 2:1, so this is its WIDTH; at the biography camera (z≈1.3)
// pushed back to HORIZON.z it covers ~3/4 of a 16:9 frame.
const SVG_URL = "/setpieces/berlin-skyline.svg";
const TARGET_SIZE = 2.4;
// Samples per curve when flattening paths to lines. The drawing is ~6,600 curve
// commands of mostly hairline slivers, so this is the piece's whole vertex
// budget: 24 spent ~160k segments on curvature nobody can see at this scale.
// Dropping it to 10 pays for the extrusion below and still leaves the city
// sharper than the ASCII grid behind it.
const CURVE_DIVISIONS = 10;

// --- Extrusion ----------------------------------------------------------------
// The art is a flat drawing; the city it depicts is not. Each building carries a
// second copy of its own outline set back in z, with rungs tying the two
// together at intervals — the way an extruded line drawing is built, and
// cheaper than extruding the geometry for real (every "line" in this SVG is a
// filled hairline sliver, so `ExtrudeGeometry` would thicken 974 ribbons rather
// than raise 20 buildings).
//
// It only pays off if something MOVES: a flat-on view of an extruded drawing is
// the drawing. The stage yaws with the cursor and drifts as the card scrolls
// past, which is what turns the back copy from a ghost into a far wall.
const EXTRUDE_MIN = 0.05;
const EXTRUDE_VAR = 0.085; // + seed * this, so the skyline has real massing
const CONNECT_EVERY = 14; // one rung per N outline segments
/** How much dimmer the back copy and the rungs are than the front outline.
 *  Carried as a vertex colour so one material still tints the whole part. */
const BACK_DIM = 0.3;
const RUNG_DIM = 0.2;
/** Depth jitter per building (world z), so the city has ranks front to back. */
const RANK_DEPTH = 0.16;

// Placement is art direction, so it's live-tunable (dev panel → the Berlin
// milestone, since the group id matches the set-piece name). The anchor is the
// world point the BOTTOM CENTRE of the drawing stands on — parts are normalised
// to that at build time, so this reads as "where the city stands" and stays
// meaningful even if the SVG's bounding box changes.
const tune = useTuning("berlinSkyline", "Berlin skyline");
const horizon = tune.vec3(
  "horizon",
  { x: 0, y: -0.62, z: -0.85 },
  {
    min: -3,
    max: 3,
    step: 0.01,
    label: "Horizon anchor (bottom centre, world)",
    gizmo: true,
  }
);
const stageScale = tune.num("scale", 1, { min: 0.3, max: 2.5, step: 0.05, label: "Scale" });
const parallaxAmount = tune.num("parallax", 0.13, { min: 0, max: 0.6, step: 0.01, label: "Cursor parallax (world units)" });
// The two levers on the extrusion. Yaw is what makes the depth visible at all,
// so this is the one number to reach for if the city ever reads flat again.
const yawAmount = tune.num("yaw", 0.24, { min: 0, max: 1, step: 0.01, label: "Cursor yaw (radians)" });
const yawDrift = tune.num("yawDrift", 0.14, { min: 0, max: 1, step: 0.01, label: "Scroll yaw drift (radians)" });

// Palette: cool base line, warm "dawn light" the sweep and the cursor tint toward.
const BASE_COLOR = new Color("#7ec7e6");
const GLOW_COLOR = new Color("#ffe0a8");

// Ambient motion tuning.
const SWEEP_SECONDS = 7.5; // dawn light crossing the whole skyline once
const SWEEP_SIGMA = 0.12; // width of the moving light band (in normalised x)
const PLANE_SECONDS = 18; // time for the plane to cross + loop
const PLANE_PARKED_U = 0.35; // where the plane sits when motion is off
const CLOUD_SECONDS = 26; // cloud drift cycle

// --- Draw-on schedule, in CARD-LOCAL progress --------------------------------
// Everything is a fraction of the card's own window, so the pace follows the
// biography section's `weight` rather than needing its own retune. Deliberately
// generous and finished by ~0.72 — `reveal` starts fading the piece back out at
// 0.75, and a part still drawing while it dims reads as a glitch.
const DRAW_START = 0.05; // a beat of nothing while the card settles in
const GROUND_WINDOW = 0.2; // the horizon sweeps across…
const BUILD_START = 0.08; // …and the city starts standing up before it lands
const BUILD_SPREAD = 0.34; // left→right stagger across the whole skyline
const BUILD_WINDOW = 0.28; // how long ONE building takes to grow
const SKY_START = 0.44; // extras arrive once the city is mostly up
const SKY_WINDOW = 0.24;
/** How quickly a part's ink comes up once it starts drawing. Short: the line has
 *  to be visible WHILE it draws, otherwise the draw-on is invisible and the part
 *  just fades in — which is the thing we're replacing. */
const INK_WINDOW = 0.05;

// --- Cursor ------------------------------------------------------------------
/** Share of the frame width the drawing covers at HORIZON.z, used to map the
 *  cursor onto the skyline's own 0..1 axis. An approximation on purpose:
 *  projecting each part through the camera every frame would be exact but costs
 *  a projection per part per frame, and this beat's camera barely moves. */
const CURSOR_SPAN = 0.8;
const CURSOR_SIGMA = 0.11; // width of the light pool the cursor drags along
const PARALLAX_Y = 0.055; // vertical parallax is much smaller than horizontal
const PLANE_CHASE = 0.06; // how far the plane drifts toward the cursor's height

type Role = "building" | "beacon" | "plane" | "balloon" | "cloud" | "ground";

/** Depth (stage-local z) and parallax response per role. Giving the flat drawing
 *  real z is what makes the cursor response read as *depth* rather than a slide:
 *  the foreground water line swings furthest, the sky barely moves. */
const ROLE_DEPTH: Record<Role, { z: number; par: number }> = {
  ground: { z: 0.12, par: 1 },
  building: { z: 0, par: 0.62 },
  beacon: { z: 0, par: 0.62 },
  balloon: { z: -0.24, par: 0.3 },
  plane: { z: -0.3, par: 0.24 },
  cloud: { z: -0.34, par: 0.2 },
};

interface Part {
  id: string;
  role: Role;
  group: Group;
  geometry: BufferGeometry;
  material: LineBasicMaterial;
  home: { x: number; y: number }; // group's resting position, stage-local
  z: number; // depth layer (see ROLE_DEPTH)
  par: number; // cursor-parallax response
  vertexCount: number; // so drawRange can reveal a fraction of the outline
  sweepKey: number; // normalised x [0..1] for the dawn sweep + cursor pool
  drawAt: number; // card-local progress where this part starts drawing
  drawWindow: number; // how much card-local progress it takes to finish
  base: number; // resting opacity
  seed: number; // deterministic per-part 0..1 (phase / jitter)
}

const groupRef = shallowRef<Group | null>(null);
const stageRef = shallowRef<Group | null>(null);
const parts = shallowRef<Part[]>([]);
let worldWidth = TARGET_SIZE;
let worldHeight = TARGET_SIZE;
let disposed = false;
// Smoothed cursor, so a fast flick eases the skyline across instead of snapping
// it. Component-scoped `let`s: written in the loop, never allocated (issue #4).
let curX = 0;
let curY = 0;


// Nearest ancestor id: a path may carry the id itself (Cloud1, airplane, …) or
// sit inside a `<g id="…">` (the buildings). The outer wrapper `<g>` has no id,
// so we stop at the first id we meet climbing up.
const groupIdOf = (node: Element | null | undefined): string | null => {
  let n: Node | null | undefined = node;
  while (n && n.nodeType === 1) {
    const id = (n as Element).getAttribute?.("id");
    if (id) return id;
    n = n.parentNode;
  }
  return null;
};

const roleOf = (id: string): Role => {
  const s = id.toLowerCase();
  if (s.includes("airplane") || s.includes("plane")) return "plane";
  if (s.includes("balloon")) return "balloon";
  if (s.includes("cloud")) return "cloud";
  if (s.includes("bottomline") || s.includes("ground")) return "ground";
  if (s.includes("fernseh")) return "beacon"; // the TV tower
  return "building";
};

// Flatten every sub-path of the parsed SVG into world-space line segments, but
// keep them grouped by their labelled ancestor so each element animates on its own.
const buildFromSvg = (paths: ReturnType<SVGLoader["parse"]>["paths"]) => {
  // 1) Gather raw polylines per group id, tracking the drawing's global bounds.
  const byId = new Map<string, number[][]>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const path of paths) {
    const node = (path.userData as { node?: Element } | undefined)?.node;
    const id = groupIdOf(node) ?? "_misc";
    let bucket = byId.get(id);
    if (!bucket) byId.set(id, (bucket = []));
    for (const sub of path.subPaths) {
      const pts = sub.getPoints(CURVE_DIVISIONS);
      if (pts.length < 2) continue;
      const flat: number[] = [];
      for (const p of pts) {
        flat.push(p.x, p.y);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      bucket.push(flat);
    }
  }
  if (!byId.size) return;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = TARGET_SIZE / (Math.max(maxX - minX, maxY - minY) || 1);
  worldWidth = (maxX - minX) * scale || TARGET_SIZE;
  worldHeight = (maxY - minY) * scale || TARGET_SIZE;
  const halfW = worldWidth / 2;
  // Everything is laid out relative to the BOTTOM of the drawing rather than its
  // centre, so the tunable HORIZON anchor means "where the city stands" and
  // survives a redraw of the SVG that changes its bounding box.
  const baseLift = worldHeight / 2;

  // 2) Per group: world-space segments → recentre on the group's own bbox centre
  //    (so it can translate/scale about itself), build a LineSegments for it.
  const built: Part[] = [];
  for (const [id, polylines] of byId) {
    const role = roleOf(id);
    const segs: number[] = []; // ax,ay,bx,by (drawing space, y-up)
    let gMinX = Infinity;
    let gMinY = Infinity;
    let gMaxX = -Infinity;
    let gMaxY = -Infinity;
    for (const flat of polylines) {
      const count = flat.length / 2;
      for (let i = 0; i < count - 1; i++) {
        // flip Y: SVG is y-down, three is y-up.
        const ax = (flat[i * 2]! - cx) * scale;
        const ay = -(flat[i * 2 + 1]! - cy) * scale;
        const bx = (flat[(i + 1) * 2]! - cx) * scale;
        const by = -(flat[(i + 1) * 2 + 1]! - cy) * scale;
        segs.push(ax, ay, bx, by);
        if (ax < gMinX) gMinX = ax;
        if (ax > gMaxX) gMaxX = ax;
        if (bx < gMinX) gMinX = bx;
        if (bx > gMaxX) gMaxX = bx;
        if (ay < gMinY) gMinY = ay;
        if (ay > gMaxY) gMaxY = ay;
        if (by < gMinY) gMinY = by;
        if (by > gMaxY) gMaxY = by;
      }
    }
    if (!segs.length) continue;

    // 3) THE DRAW ORDER IS THE ANIMATION. `setDrawRange` walks the position
    //    buffer front to back, so the order we write segments in is the order
    //    the pen takes them. Sort accordingly, once, at build time.
    const segCount = segs.length / 4;
    const order: number[] = new Array(segCount);
    for (let i = 0; i < segCount; i++) order[i] = i;
    if (role === "ground") {
      // The horizon draws across the frame, left → right.
      order.sort(
        (a, b) =>
          Math.min(segs[a * 4]!, segs[a * 4 + 2]!) -
          Math.min(segs[b * 4]!, segs[b * 4 + 2]!)
      );
    } else if (role === "building" || role === "beacon") {
      // Buildings grow OUT OF the ground line: lowest segment first. Sorting
      // across sub-paths (rather than per outline) is what makes it read as a
      // building rising instead of several outlines being traced.
      order.sort(
        (a, b) =>
          Math.min(segs[a * 4 + 1]!, segs[a * 4 + 3]!) -
          Math.min(segs[b * 4 + 1]!, segs[b * 4 + 3]!)
      );
    }
    // Sky extras keep their authored order — a plane/cloud/balloon outline reads
    // best traced the way it was drawn.

    const gx = (gMinX + gMaxX) / 2;
    const gy = (gMinY + gMaxY) / 2;
    const seed = hash01(id);

    // 4) EXTRUDE, for the things that have volume. Buildings get a back copy of
    //    their outline and rungs between the two; the ground line and the sky
    //    extras stay flat, because a cloud with a back wall is a box.
    //    Everything is emitted in the pen's order, front → back → rung, so the
    //    draw-on raises a solid rather than drawing a flat city and then
    //    thickening it afterwards.
    const depth =
      role === "building" || role === "beacon" ? EXTRUDE_MIN + seed * EXTRUDE_VAR : 0;
    const pos: number[] = [];
    const tone: number[] = []; // vertex colour: a per-vertex dimmer, see BACK_DIM
    const pushSeg = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      dim: number
    ) => {
      pos.push(ax, ay, az, bx, by, bz);
      tone.push(dim, dim, dim, dim, dim, dim);
    };
    let drawn = 0;
    for (const s of order) {
      const i = s * 4;
      const ax = segs[i]! - gx;
      const ay = segs[i + 1]! - gy;
      const bx = segs[i + 2]! - gx;
      const by = segs[i + 3]! - gy;
      pushSeg(ax, ay, 0, bx, by, 0, 1);
      if (depth > 0) {
        pushSeg(ax, ay, -depth, bx, by, -depth, BACK_DIM);
        if (drawn % CONNECT_EVERY === 0) pushSeg(ax, ay, 0, ax, ay, -depth, RUNG_DIM);
      }
      drawn++;
    }

    const sweepKey = clamp01((gx + halfW) / worldWidth);

    // Entrance schedule per role (left→right stagger for buildings).
    let drawAt = DRAW_START;
    let drawWindow = BUILD_WINDOW;
    let base = 0.55;
    if (role === "ground") {
      drawWindow = GROUND_WINDOW;
      base = 0.42;
    } else if (role === "building" || role === "beacon") {
      drawAt = DRAW_START + BUILD_START + sweepKey * BUILD_SPREAD;
    } else {
      drawAt = SKY_START + seed * 0.06;
      drawWindow = SKY_WINDOW;
      base = 0.62;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    // The extrusion's depth cue. `LineBasicMaterial` multiplies its colour by the
    // vertex colour, so one animated `material.color` still tints the whole part
    // while the back copy and the rungs stay set back behind the front outline.
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(tone), 3));
    geometry.setDrawRange(0, 0); // nothing drawn until the card starts moving
    const material = new LineBasicMaterial({
      color: BASE_COLOR.clone(), // per-part clone: the sweep/cursor tint each individually
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const line = new LineSegments(geometry, material);
    line.frustumCulled = false; // drawn in the overlay pass; don't cull on the main cam

    // Ranks: buildings sit at slightly different depths rather than all on one
    // plane, so the yaw parallaxes them past each other instead of sliding one
    // flat card. Deterministic per id, like every other jitter here.
    const layer = ROLE_DEPTH[role];
    const rank = depth > 0 ? (seed - 0.5) * RANK_DEPTH : 0;
    const g = new Group();
    g.position.set(gx, gy + baseLift, layer.z + rank);
    g.add(line);

    built.push({
      id,
      role,
      group: g,
      geometry,
      material,
      home: { x: gx, y: gy + baseLift },
      z: layer.z + rank,
      par: layer.par,
      vertexCount: pos.length / 3,
      sweepKey,
      drawAt,
      drawWindow,
      base,
      seed,
    });
  }

  parts.value = built;
};

onMounted(() => {
  const loader = new SVGLoader();
  loader.load(
    SVG_URL,
    (data) => {
      if (!disposed) buildFromSvg(data.paths);
    },
    undefined,
    (err) => console.warn(`[BerlinSkyline] could not load ${SVG_URL}`, err)
  );
});

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const group = groupRef.value;
  const stage = stageRef.value;
  if (!group || !stage) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001 && parts.value.length > 0;
  if (!group.visible) return;

  // Read the preference in the loop — it's just a boolean, and reading it here
  // (rather than binding it in the template) is what keeps it out of hydration.
  const still = reducedMotion.value;
  // THE drive: the card's own travel when SceneSetPieces hands it over, else the
  // reveal bloom. Scroll-driven either way — scrolling back up un-draws it.
  const drive = props.cardProgress ?? reveal;

  // The stage carries placement, written imperatively from the tunables (reading
  // a reactive number per frame is fine; patching a reactive prop is not).
  stage.position.set(horizon.x, horizon.y, horizon.z);
  stage.scale.setScalar(stageScale.value * (0.985 + 0.015 * reveal));
  stage.rotation.z = still ? 0 : Math.sin(elapsed * 0.25) * 0.005;

  const amb = smoothstep(0.1, 0.7, reveal) * (still ? 0 : 1); // ambient motion budget
  const sweep = (elapsed % SWEEP_SECONDS) / SWEEP_SECONDS; // dawn light position 0..1

  // Cursor, smoothed frame-rate-independently. Dropped entirely under
  // reduced-motion: it eases back to centre and every response below goes with it.
  const ease = 1 - Math.pow(1 - 0.08, delta * 60);
  curX += ((still ? 0 : pointer.value.x) - curX) * ease;
  curY += ((still ? 0 : pointer.value.y) - curY) * ease;
  const cursorAmt = still ? 0 : 1;
  // THE extrusion's payoff: the city TURNS. A few degrees of yaw with the
  // cursor, plus a slow drift across the card's own travel, walks each back copy
  // out from behind its front outline — and that is the only way a viewer ever
  // finds out the drawing has depth. Set on the stage, so the per-part parallax
  // below still slides the layers within it. The drift is scroll-driven, so it
  // holds its angle when you stop rather than wandering on its own.
  stage.rotation.y = curX * yawAmount.value + (drive - 0.5) * yawDrift.value;
  // Where the cursor falls along the skyline's own 0..1 axis (see CURSOR_SPAN).
  const cursorKey = clamp01(0.5 + curX / (2 * CURSOR_SPAN));
  const par = parallaxAmount.value;

  const TAU = Math.PI * 2;
  for (const p of parts.value) {
    // Draw-on: this part's slice of the card's travel.
    const draw = smoothstep(p.drawAt, p.drawAt + p.drawWindow, drive);
    drawFraction(p.geometry, p.vertexCount, draw);

    // Ink follows the pen closely, then `reveal` fades the whole piece in/out.
    const ink = smoothstep(p.drawAt, p.drawAt + INK_WINDOW, drive) * reveal;
    const g = p.group;
    if (ink <= 0.0005) {
      g.visible = false;
      continue;
    }
    g.visible = true;

    // Depth parallax: near layers swing further than far ones, opposite the
    // cursor, as if the viewpoint moved with it.
    const px = -curX * par * p.par;
    const py = curY * PARALLAX_Y * p.par;
    // The pool of light the cursor drags along the skyline (not wrapped: the
    // cursor doesn't loop round the back of the drawing the way the sweep does).
    const dc = (p.sweepKey - cursorKey) / CURSOR_SIGMA;
    const cg = cursorAmt * Math.exp(-0.5 * dc * dc);
    const phase = p.seed * TAU;

    switch (p.role) {
      case "building":
      case "beacon": {
        // Dawn light: a soft band sweeping the skyline brightens + warms each
        // building as it passes (additive, so higher opacity reads as brighter).
        // The cursor's pool does the same thing, under your control.
        const glow = Math.exp(
          -(wrapDist(p.sweepKey, sweep) ** 2) / (2 * SWEEP_SIGMA * SWEEP_SIGMA)
        );
        const warm = Math.min(1, glow * 0.55 * amb + cg * 0.7);
        p.material.color.copy(BASE_COLOR).lerp(GLOW_COLOR, warm);
        let op = (p.base + 0.5 * glow * amb + 0.45 * cg) * ink;

        if (p.role === "beacon") {
          // Blinking landmark beacon on the TV tower — it answers the cursor by
          // blinking harder, so the one named landmark is also the responsive one.
          const blink = Math.pow(0.5 + 0.5 * Math.sin(elapsed * 1.8), 6);
          op += (0.4 + 0.7 * cg) * blink * amb * ink;
          g.scale.setScalar(1 + 0.018 * blink * amb);
        }

        p.material.opacity = Math.min(1, op);
        g.position.set(p.home.x + px, p.home.y + py, p.z);
        break;
      }

      case "ground": {
        // Faint shimmer like light on water; brightens under the cursor too, so
        // the foreground line reads as the nearest thing in the parallax stack.
        p.material.opacity =
          p.base * ink * (0.82 + 0.18 * Math.sin(elapsed * 0.6 + phase) * amb) +
          0.25 * cg * ink;
        p.material.color.copy(BASE_COLOR).lerp(GLOW_COLOR, cg * 0.5);
        g.position.set(p.home.x + px, p.home.y + py, p.z);
        break;
      }

      case "plane": {
        // Nose points left, so fly right→left and loop. Travel centred on the
        // drawing so it crosses the whole sky; fade at both ends to hide the wrap.
        const u = still
          ? PLANE_PARKED_U
          : (elapsed / PLANE_SECONDS + p.seed) % 1;
        const x = (0.5 - u) * worldWidth * 1.3;
        // Chases the cursor's height and BANKS into it — the plane is the one
        // element that visibly answers the pointer rather than just parallaxing.
        const chase = -curY * PLANE_CHASE;
        const y =
          p.home.y + chase + Math.sin(elapsed * 1.1 + phase) * worldHeight * 0.02 * amb;
        const edge = smoothstep(0, 0.06, u) * (1 - smoothstep(0.94, 1, u));
        g.position.set(x + px, y + py, p.z);
        g.rotation.z = chase * 1.6;
        p.material.opacity = p.base * ink * edge;
        break;
      }

      case "balloon": {
        const y = p.home.y + Math.sin(elapsed * 0.5 + phase) * worldHeight * 0.045 * amb;
        const x = p.home.x + Math.sin(elapsed * 0.27 + phase) * worldWidth * 0.012 * amb;
        g.position.set(x + px, y + py, p.z);
        p.material.opacity = p.base * ink;
        break;
      }

      case "cloud": {
        // Slow drift back and forth near where it was authored (no pop).
        const u = (elapsed / CLOUD_SECONDS + p.seed) % 1;
        const x = p.home.x + Math.sin(u * TAU) * worldWidth * 0.05 * (still ? 0 : 1);
        const y = p.home.y + Math.sin(elapsed * 0.12 + phase) * worldHeight * 0.012 * amb;
        g.position.set(x + px, y + py, p.z);
        p.material.opacity = p.base * ink;
        break;
      }
    }
  }
});

onBeforeUnmount(() => {
  disposed = true;
  for (const p of parts.value) {
    p.geometry.dispose();
    p.material.dispose();
  }
});
</script>

<template>
  <!-- Outer group: the slot position SceneSetPieces assigns. Inner "stage":
       placement + scale, written imperatively in the loop from the tunables. -->
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <TresGroup ref="stageRef">
      <primitive v-for="p in parts" :key="p.id" :object="p.group" />
    </TresGroup>
  </TresGroup>
</template>
