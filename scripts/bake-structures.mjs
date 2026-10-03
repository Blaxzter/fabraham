#!/usr/bin/env node
/**
 * Bakes the Maastricht chapter's backdrop: real GAN-generated Angry Birds
 * structures from the master thesis, each knocked over by a bird.
 *
 *   node scripts/bake-structures.mjs <dir of level XMLs> [count]
 *     → public/setpieces/structures.json
 *
 * The source is the AIIDE 2023 paper repo's `generated_levels/main_set`: 8,000
 * levels from the best-performing GAN, decoded into Science Birds block lists.
 * Next to it, `main_set_data.json` holds what Science Birds itself measured for
 * each one, including `is_stable`. When that file is there (`<dir>_data.json`)
 * only levels the game called stable are considered.
 *
 * Why bake instead of simulating in the browser
 * ---------------------------------------------
 * A collapse is a few seconds of rigid-body physics. Running it live would mean
 * shipping a physics engine for one backdrop and paying for it every frame, and
 * the result would differ from machine to machine. Baked, the piece only
 * interpolates poses, and every visitor sees the same collapse, which also makes
 * the selection below meaningful: the levels shipped are the ones that were
 * checked to stand on their own and to come down well.
 *
 * Selection, in the thesis's own terms
 * ------------------------------------
 *   1. Stable: Science Birds' own verdict first, then ours. Box2D is not
 *      Unity's physics, so a level the game held can still slump here, and the
 *      settled pose is what gets drawn: either way it is dropped rather than
 *      shown failing. Stability is the property the thesis was about.
 *   2. Collapses: after the bird hits, enough of it has to come down to read
 *      as a hit from across the page.
 *
 * Output format (all integers, so the file compresses well)
 * ---------------------------------------------------------
 * Positions are centimetres, angles centiradians. The structure is recentred
 * so its footprint is centred on x = 0 with the ground at y = 0. Every channel
 * of every track is DELTA-encoded: once things come to rest the deltas are runs
 * of zeros, which is most of the file and exactly what gzip/brotli eat.
 *
 *   { fps, levels: [{
 *       bodies: [[kind, w, h, material]],  // kind 0 block, 1 hole block, 2 pig
 *       frames: n,
 *       tracks: [[dx0, dy0, da0, dx1, …]],  // per body, n frames × 3, deltas
 *       bird:   [dx0, dy0, …],              // n frames × 2, deltas
 *       launch, impact,                     // frame indices
 *       pops:   [frame | -1],               // per body: when a pig was hit
 *       sling:  [x, y],                     // slingshot, cm
 *   }]}
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { World, Vec2, Box, Circle, Edge } from "planck";

const SRC = process.argv[2];
const COUNT = Number(process.argv[3] ?? 8);
if (!SRC) {
  console.error("usage: node scripts/bake-structures.mjs <levels dir> [count]");
  process.exit(1);
}
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "setpieces",
  "structures.json"
);

// Science Birds block footprints (thesis: converter/to_text_converter).
const SIZES = {
  SquareHole: [0.84, 0.84],
  RectFat: [0.85, 0.43],
  SquareSmall: [0.43, 0.43],
  SquareTiny: [0.22, 0.22],
  RectTiny: [0.43, 0.22],
  RectSmall: [0.85, 0.22],
  RectMedium: [1.68, 0.22],
  RectBig: [2.06, 0.22],
};
const MATERIALS = { wood: 0, ice: 1, stone: 2 };
// Relative densities: stone is what holds a structure down, ice what shatters.
const DENSITY = [1.0, 0.7, 2.6];
const PIG_R = 0.25;
const GROUND = -3.5;

const FPS = 20;
const STEP = 1 / 120;
const STEPS_PER_FRAME = 120 / FPS;
const SETTLE_SECONDS = 3;
const PRE_LAUNCH_FRAMES = 2; // a beat of stillness before the bird leaves
const RECORD_SECONDS = 5.5;
const BIRD_R = 0.22;
const PIG_BREAK_IMPULSE = 0.9;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : undefined;
};

const parseLevel = (xml) => {
  const bodies = [];
  for (const tag of xml.match(/<(Block|Pig|Platform|TNT)\b[^>]*>/g) ?? []) {
    const kind = tag.match(/^<(\w+)/)[1];
    const x = Number(attr(tag, "x"));
    const y = Number(attr(tag, "y"));
    const rot = Number(attr(tag, "rotation") ?? 0);
    if (kind === "Pig") {
      bodies.push({ kind: 2, w: PIG_R * 2, h: PIG_R * 2, mat: 0, x, y, rot: 0 });
      continue;
    }
    if (kind !== "Block") return null; // platforms/TNT: not part of this story
    const type = attr(tag, "type");
    const size = SIZES[type];
    const mat = MATERIALS[attr(tag, "material")];
    if (!size || mat === undefined) return null; // circles/triangles: skip level
    // Rotation is always 0 or 90 in the generated set; fold it into the size so
    // a body's angle starts at 0 and the track only carries what physics adds.
    const upright = Math.round(rot / 90) % 2 !== 0;
    const [w, h] = upright ? [size[1], size[0]] : size;
    bodies.push({ kind: type === "SquareHole" ? 1 : 0, w, h, mat, x, y, rot: 0 });
  }
  return bodies.length ? bodies : null;
};

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
const buildWorld = (bodies) => {
  const world = new World({ gravity: Vec2(0, -9.81) });
  const ground = world.createBody();
  ground.createFixture(new Edge(Vec2(-60, GROUND), Vec2(60, GROUND)), {
    friction: 0.9,
  });
  const handles = bodies.map((b, i) => {
    const body = world.createBody({
      type: "dynamic",
      position: Vec2(b.x, b.y),
      angle: b.rot,
      // Box2D circles have no rolling resistance, so a pig on a block that is
      // a hair off level rolls away forever. Science Birds pigs don't.
      angularDamping: b.kind === 2 ? 4 : 0.1,
    });
    const shape = b.kind === 2 ? new Circle(PIG_R) : new Box(b.w / 2, b.h / 2);
    body.createFixture(shape, {
      density: b.kind === 2 ? 0.6 : DENSITY[b.mat],
      friction: 0.7,
      restitution: 0.02,
    });
    body.setUserData({ index: i, pig: b.kind === 2 });
    return body;
  });
  return { world, handles };
};

const step = (world, n) => {
  for (let i = 0; i < n; i++) world.step(STEP, 10, 6);
};

/** Settle with nothing touching it. Returns settled poses, or null if it moved. */
const settle = (bodies) => {
  const { world, handles } = buildWorld(bodies);
  // Decoded blocks can overlap by a few millimetres, and Box2D resolves an
  // overlap with a kick that can topple a tower Science Birds would hold. So
  // the first second runs heavily damped, letting overlaps ease apart, then the
  // damping comes off and the structure has to stand on its own.
  handles.forEach((h) => {
    h.setLinearDamping(8);
    h.setAngularDamping(8);
  });
  step(world, 1 / STEP);
  handles.forEach((h, i) => {
    h.setLinearDamping(0);
    h.setAngularDamping(bodies[i].kind === 2 ? 4 : 0.1);
  });
  step(world, SETTLE_SECONDS / STEP);
  // Blocks only: a pig is a ball and will roll off a ledge a block would hold.
  // Generated levels are decoded from a grid, so a block can start a little
  // above its support and drop onto it when the level loads (Science Birds
  // does exactly this); that is settling, not failing. Sliding sideways, or
  // tipping, is.
  let moved = 0;
  const poses = handles.map((h, i) => {
    const p = h.getPosition();
    if (bodies[i].kind !== 2) {
      const side = Math.abs(p.x - bodies[i].x);
      const drop = bodies[i].y - p.y;
      if (side > 0.1 || drop > 0.3 || Math.abs(h.getAngle()) > 0.12) moved++;
    }
    return { x: p.x, y: p.y, rot: h.getAngle() };
  });
  return moved === 0 ? poses : null;
};

/** Initial velocity for a projectile from `a` to hit `b` at launch angle `theta`. */
const aim = (a, b, theta) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c = Math.cos(theta);
  const denom = 2 * c * c * (dx * Math.tan(theta) - dy);
  if (denom <= 0) return null;
  const v = Math.sqrt((9.81 * dx * dx) / denom);
  return Vec2(v * c, v * Math.sin(theta));
};

const shoot = (bodies, poses, target, theta) => {
  const settled = bodies.map((b, i) => ({ ...b, ...poses[i] }));
  const { world, handles } = buildWorld(settled);
  const minX = Math.min(...settled.map((b) => b.x - b.w / 2));
  const sling = Vec2(minX - 4.2, GROUND + 1.1);
  const vel = aim(sling, target, theta);
  if (!vel) return null;

  const bird = world.createBody({ type: "dynamic", position: sling, bullet: true });
  bird.createFixture(new Circle(BIRD_R), { density: 7, friction: 0.5, restitution: 0.15 });
  bird.setActive(false);

  const doomed = new Set();
  const pops = new Array(bodies.length).fill(-1);
  let impact = -1;
  let frame = 0;
  world.on("post-solve", (contact, impulse) => {
    const a = contact.getFixtureA().getBody();
    const b = contact.getFixtureB().getBody();
    if ((a === bird || b === bird) && impact < 0) impact = frame;
    const hit = Math.max(...impulse.normalImpulses);
    for (const body of [a, b]) {
      const data = body.getUserData();
      if (data?.pig && hit > PIG_BREAK_IMPULSE && pops[data.index] < 0) {
        doomed.add(body);
      }
    }
  });

  const frames = Math.round(RECORD_SECONDS * FPS);
  const track = handles.map(() => []);
  const birdTrack = [];
  for (frame = 0; frame < frames; frame++) {
    if (frame === PRE_LAUNCH_FRAMES) {
      bird.setActive(true);
      bird.setLinearVelocity(vel);
    }
    handles.forEach((h, i) => {
      const p = h.getPosition();
      track[i].push(p.x, p.y, h.getAngle());
    });
    const bp = bird.getPosition();
    birdTrack.push(bp.x, bp.y);
    for (let s = 0; s < STEPS_PER_FRAME; s++) {
      world.step(STEP, 10, 6);
      for (const body of doomed) {
        const i = body.getUserData().index;
        pops[i] = frame;
        // Out of the simulation, parked where it was hit; the piece hides it.
        body.setActive(false);
      }
      doomed.clear();
    }
  }

  // A pig that never took a hard enough hit can still be knocked off its perch;
  // in the game the fall would finish it. Pop it once it has been carried away.
  handles.forEach((_, i) => {
    if (bodies[i].kind !== 2 || pops[i] >= 0) return;
    const t = track[i];
    for (let f = 0; f < frames; f++) {
      if (Math.hypot(t[f * 3] - t[0], t[f * 3 + 1] - t[1]) > 0.4) {
        pops[i] = f;
        break;
      }
    }
  });

  // How much came down: blocks that ended up displaced or tipped.
  let fallen = 0;
  handles.forEach((h, i) => {
    if (bodies[i].kind === 2) return;
    const n = track[i].length;
    const d = Math.hypot(track[i][n - 3] - track[i][0], track[i][n - 2] - track[i][1]);
    if (d > 0.35 || Math.abs(track[i][n - 1] - track[i][2]) > 0.5) fallen++;
  });
  const blocks = bodies.filter((b) => b.kind !== 2).length;
  return {
    sling,
    frames,
    track,
    birdTrack,
    pops,
    impact,
    score: impact < 0 ? 0 : fallen / blocks,
  };
};

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------
const delta = (values, scale) => {
  const out = [];
  let prev = 0;
  for (const v of values) {
    const q = Math.round(v * scale);
    out.push(q - prev);
    prev = q;
  }
  return out;
};

/** Interleaved xyz… → per-channel quantised deltas, re-interleaved. */
const encodeTrack = (flat, stride, scales, offset) => {
  const n = flat.length / stride;
  const channels = scales.map((s, c) => {
    const vals = [];
    for (let f = 0; f < n; f++) vals.push(flat[f * stride + c] - (offset[c] ?? 0));
    return delta(vals, s);
  });
  const out = [];
  for (let f = 0; f < n; f++) for (let c = 0; c < stride; c++) out.push(channels[c][f]);
  return out;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const files = fs
  .readdirSync(SRC)
  .filter((f) => f.endsWith(".xml"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// Science Birds' measurements, if the set ships with them.
const META_PATH = `${SRC.replace(/[\\/]+$/, "")}_data.json`;
const meta = fs.existsSync(META_PATH)
  ? JSON.parse(fs.readFileSync(META_PATH, "utf8"))
  : null;

const candidates = [];
for (const file of files) {
  if (meta && meta[file.replace(/\.xml$/, "")]?.is_stable !== true) continue;
  const bodies = parseLevel(fs.readFileSync(path.join(SRC, file), "utf8"));
  if (!bodies) continue;
  const blocks = bodies.filter((b) => b.kind !== 2);
  const pigs = bodies.length - blocks.length;
  if (blocks.length < 8 || blocks.length > 34 || pigs < 1) continue;
  const minX = Math.min(...blocks.map((b) => b.x - b.w / 2));
  const maxX = Math.max(...blocks.map((b) => b.x + b.w / 2));
  const maxY = Math.max(...blocks.map((b) => b.y + b.h / 2));
  // Wide, flat levels read as a smear at this scale; keep the ones with a shape.
  if (maxX - minX > 6.5 || maxY - GROUND < 1.6) continue;

  const poses = settle(bodies);
  if (!poses) continue;

  // A few shots per level; keep the one that brings the most down.
  let best = null;
  for (const [fy, theta] of [[0.55, 0.32], [0.75, 0.38], [0.4, 0.28], [0.85, 0.5]]) {
    const target = Vec2(minX + 0.15, GROUND + (maxY - GROUND) * fy);
    const shot = shoot(bodies, poses, target, theta);
    if (shot && (!best || shot.score > best.score)) best = shot;
  }
  if (!best || best.score < 0.45) continue;
  candidates.push({ file, bodies, minX, maxX, height: maxY - GROUND, shot: best });
  process.stdout.write(`  ${file}: ${blocks.length} blocks, ${(best.score * 100) | 0}% down\n`);
}

// Variety over raw score: spread the picks across heights so consecutive
// levels look different, not five versions of the same low wall.
candidates.sort((a, b) => a.height - b.height);
const picks = [];
const stride = Math.max(1, candidates.length / COUNT);
for (let i = 0; i < COUNT && Math.floor(i * stride) < candidates.length; i++) {
  picks.push(candidates[Math.floor(i * stride)]);
}
// Interleave tall and short so the cycle alternates.
picks.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));

const levels = picks.map(({ bodies, minX, maxX, shot }) => {
  const cx = (minX + maxX) / 2;
  const offset = [cx, GROUND, 0];
  return {
    bodies: bodies.map((b) => [b.kind, Math.round(b.w * 100), Math.round(b.h * 100), b.mat]),
    frames: shot.frames,
    tracks: shot.track.map((t) => encodeTrack(t, 3, [100, 100, 100], offset)),
    bird: encodeTrack(shot.birdTrack, 2, [100, 100], offset),
    launch: PRE_LAUNCH_FRAMES,
    impact: shot.impact,
    pops: shot.pops,
    sling: [Math.round((shot.sling.x - cx) * 100), Math.round((shot.sling.y - GROUND) * 100)],
  };
});

fs.writeFileSync(OUT, JSON.stringify({ fps: FPS, levels }));
console.log(
  `\n${candidates.length} candidates, wrote ${levels.length} levels → ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`
);
