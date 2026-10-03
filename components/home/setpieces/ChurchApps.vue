<script setup lang="ts">
import { shallowRef, onBeforeUnmount } from "vue";
import { useWindowSize } from "@vueuse/core";
import { useLoop } from "@tresjs/core";
import type { Group } from "three";
import {
  approach,
  createDots,
  createLinkPool,
  createLines,
  drawFraction,
  mulberry32,
  orderSegments,
  setDotScale,
  smoothstep,
  type SetPieceProps,
} from "./lineArt";

/**
 * The church chapter's backdrop: the two apps, running side by side.
 *
 * The chapter covers more than the hymnal, and the backdrop says so with the
 * two things people actually hold in their hands:
 *
 *   - **A tablet with the hymnal app.** A song header, two staves with the
 *     lyrics under them, and a player bar. A playhead reads the page; each note
 *     lifts as it sounds, its syllable lights, and the progress bar fills. (This
 *     is what the old `StaffLines` backdrop drew on its own, now inside the
 *     screen it belongs on.)
 *   - **A phone with the Kirchentag app.** The header, the live stream at the
 *     top with its red dot, the strip of days, and the programme scrolling
 *     underneath. When the list has run through, the next day is selected.
 *
 * Both are one piece, laid out together, so they cannot land on each other the
 * way two set-pieces in two slots do. Frames draw first, then the screens fill
 * top to bottom off `cardProgress`, then the apps start moving. See
 * ./lineArt.ts for the shared moves.
 */
const props = withDefaults(defineProps<SetPieceProps>(), {
  reveal: 0,
  variant: "",
  position: () => [0, 0, 0],
  cardProgress: undefined,
});

const { pointer } = usePointer();
const { reducedMotion } = usePreferences();
const { width, height } = useWindowSize();

const WARM = "#ffd479";
const HOT = "#fff3d0";
const ON_AIR = "#ff6b6b";

/** Whole composition vs. the frame; see RouteArc's STAGE_SCALE. */
const STAGE_SCALE = 1;
const NUDGE: [number, number, number] = [0, -0.05, 0];

// Devices, each built around its own centre and then placed on the stage.
const TAB = { x: 0, y: 0, w: 0.9, h: 0.6, bezel: 0.035, r: 0.04 };
const PHONE = { x: 0, y: 0, w: 0.29, h: 0.58, bezel: 0.016, r: 0.04 };

// Placement. The two FLANK the head rather than cover it: the tablet out to
// the left, turned toward the camera, and the phone, drawn larger, in the gap
// between the head and the card.
//
// The tablet's x follows the frame's width: on a wide screen it can sit far
// out, on a narrower one it has to come in to stay on screen. The frame's
// half-height at this depth is a constant of the biography camera (the
// visible half-WIDTH is that times the aspect).
const HALF_H = 0.86;
const TAB_Y = 0.03;
const TAB_SCALE = 0.9;
const TAB_TURN = 0.5; // radians about y: the right edge recedes, the face turns in
const TAB_TILT = 0;
const TAB_FAR_X = -1.1; // how far out it goes when there is room
const TAB_EDGE = 0.6; // and how far in from the frame's left edge otherwise
// Below this aspect the tablet also shrinks (to no less than TAB_MIN_FIT of its
// size), since turned toward the camera its near edge grows.
const TAB_FULL_ASPECT = 2.1;
const TAB_MIN_FIT = 0.7;
const PHONE_AT: [number, number, number] = [0.24, -0.02, 0.06];
const PHONE_SCALE = 1.35;
// Portrait screens have no room beside the head; there the pair stands
// together, flatter, and shrinks to fit.
const PORTRAIT_TAB_X = -0.3;
const PORTRAIT_PHONE_X = 0.32;
const PORTRAIT_WIDTH = 1.15;
const PORTRAIT_CENTRE_X = 0.12;

// Assembly, in card-local progress.
const FRAME_START = 0.04;
const FRAME_WINDOW = 0.22;
const CONTENT_START = 0.16;
const CONTENT_WINDOW = 0.34;
const NOTE_START = 0.3;
const NOTE_WINDOW = 0.3;

// The performance.
const BAR_SECONDS = 7.5; // one sweep of the playhead across both staves
const LIGHT_SIGMA = 0.03; // how wide the playhead's pool of light is
const LIFT = 0.012; // how far a note rises as it sounds
const SCROLL_SPEED = 0.045; // the programme, in stage units per second

const rand = mulberry32(9157 + props.variant.length * 101);

// ---------------------------------------------------------------------------
// Drawing helpers: everything is axis-aligned strokes, arcs and ellipses
// ---------------------------------------------------------------------------
type Segs = number[];
const seg = (s: Segs, ax: number, ay: number, bx: number, by: number, z = 0) =>
  s.push(ax, ay, z, bx, by, z);
const rect = (s: Segs, x0: number, y0: number, x1: number, y1: number, z = 0) => {
  seg(s, x0, y0, x1, y0, z);
  seg(s, x1, y0, x1, y1, z);
  seg(s, x1, y1, x0, y1, z);
  seg(s, x0, y1, x0, y0, z);
};
const roundRect = (
  s: Segs,
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
  z = 0
) => {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  seg(s, x0 + r, y1, x1 - r, y1, z);
  seg(s, x1, y1 - r, x1, y0 + r, z);
  seg(s, x1 - r, y0, x0 + r, y0, z);
  seg(s, x0, y0 + r, x0, y1 - r, z);
  const corners: [number, number, number][] = [
    [x1 - r, y1 - r, 0],
    [x1 - r, y0 + r, -Math.PI / 2],
    [x0 + r, y0 + r, Math.PI],
    [x0 + r, y1 - r, Math.PI / 2],
  ];
  for (const [ccx, ccy, a0] of corners) {
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k / 4) * (Math.PI / 2);
      const b = a0 + ((k + 1) / 4) * (Math.PI / 2);
      seg(s, ccx + Math.cos(a) * r, ccy + Math.sin(a) * r, ccx + Math.cos(b) * r, ccy + Math.sin(b) * r, z);
    }
  }
};
const ellipse = (
  s: Segs,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number,
  tilt = 0,
  z = 0
) => {
  const c = Math.cos(tilt);
  const si = Math.sin(tilt);
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    const px0 = Math.cos(a0) * rx;
    const py0 = Math.sin(a0) * ry;
    const px1 = Math.cos(a1) * rx;
    const py1 = Math.sin(a1) * ry;
    seg(s, cx + px0 * c - py0 * si, cy + px0 * si + py0 * c, cx + px1 * c - py1 * si, cy + px1 * si + py1 * c, z);
  }
};
/** A play triangle pointing right, centred on (cx, cy). */
const play = (s: Segs, cx: number, cy: number, size: number, z = 0) => {
  const ax = cx - size * 0.45;
  const bx = cx + size * 0.6;
  seg(s, ax, cy - size * 0.6, ax, cy + size * 0.6, z);
  seg(s, ax, cy + size * 0.6, bx, cy, z);
  seg(s, bx, cy, ax, cy - size * 0.6, z);
};

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------
const tabFrameSegs: Segs = [];
roundRect(tabFrameSegs, TAB.x, TAB.y, TAB.w, TAB.h, TAB.r);
roundRect(tabFrameSegs, TAB.x, TAB.y, TAB.w - TAB.bezel * 2, TAB.h - TAB.bezel * 2, 0.008);
ellipse(tabFrameSegs, TAB.x - TAB.w / 2 + TAB.bezel / 2, TAB.y, 0.005, 0.005, 6); // camera
const tabFrames = createLines(new Float32Array(tabFrameSegs), { color: WARM });
const phoneFrameSegs: Segs = [];
roundRect(phoneFrameSegs, PHONE.x, PHONE.y, PHONE.w, PHONE.h, PHONE.r);
roundRect(phoneFrameSegs, PHONE.x, PHONE.y, PHONE.w - PHONE.bezel * 2, PHONE.h - PHONE.bezel * 2 - 0.02, 0.02);
const phoneFrames = createLines(new Float32Array(phoneFrameSegs), { color: WARM });

// ---------------------------------------------------------------------------
// The tablet: the hymnal app
// ---------------------------------------------------------------------------
const content: Segs = [];

const tL = TAB.x - TAB.w / 2 + TAB.bezel;
const tR = TAB.x + TAB.w / 2 - TAB.bezel;
const tT = TAB.y + TAB.h / 2 - TAB.bezel;
const tB = TAB.y - TAB.h / 2 + TAB.bezel;

// Song header: the hymn's number in a circle, its title, the line under it.
const barY = tT - 0.04;
ellipse(content, tL + 0.04, barY, 0.017, 0.017, 12);
seg(content, tL + 0.032, barY, tL + 0.048, barY);
seg(content, tL + 0.075, barY + 0.008, tL + 0.33, barY + 0.008);
seg(content, tL + 0.075, barY + 0.004, tL + 0.33, barY + 0.004);
seg(content, tL + 0.075, barY - 0.012, tL + 0.22, barY - 0.012);
rect(content, tR - 0.05, barY - 0.01, tR - 0.03, barY + 0.01);
rect(content, tR - 0.085, barY - 0.01, tR - 0.065, barY + 0.01);
seg(content, tL, tT - 0.075, tR, tT - 0.075);

// Staves.
const SPACING = 0.017;
const SYSTEMS = [tT - 0.15, tT - 0.31];
const LYRIC_DROP = 0.072;
const PER_SYSTEM = 8;
const sL = tL + 0.04;
const sR = tR - 0.03;
for (const cy of SYSTEMS) {
  for (let i = 0; i < 5; i++) {
    const y = cy + (i - 2) * SPACING;
    seg(content, sL, y, sR, y);
  }
  for (const x of [sL, sL + (sR - sL) * 0.5, sR]) {
    seg(content, x, cy - 2 * SPACING, x, cy + 2 * SPACING);
  }
}

// Notes and their syllables.
interface Note {
  x: number;
  y: number;
  sys: number;
  /** This note's vertices in the note buffer, for the lift. */
  from: number;
  count: number;
  /** The syllable sung on it. */
  lx0: number;
  lx1: number;
  ly: number;
}
const HEAD_RX = 0.013;
const HEAD_RY = 0.009;
const NOTE_TILT = -0.34;
const STEM = 0.06;
const notes: Note[] = [];
const noteSegs: Segs = [];
for (let sys = 0; sys < SYSTEMS.length; sys++) {
  const cy = SYSTEMS[sys]!;
  // Melodies move by step, so a random walk rather than a scatter.
  let step = sys === 0 ? -1 : 2;
  const groupW = (sR - sL) / (PER_SYSTEM / 2);
  for (let i = 0; i < PER_SYSTEM; i++) {
    const group = Math.floor(i / 2);
    const x = sL + group * groupW + groupW * 0.32 + (i % 2) * 0.05;
    step += Math.round(rand() * 2 - 1);
    step = Math.max(-4, Math.min(4, step));
    const y = cy + step * (SPACING * 0.5);
    const from = noteSegs.length / 3;
    ellipse(noteSegs, x, y, HEAD_RX, HEAD_RY, 10, NOTE_TILT);
    const up = step < 1;
    const sx = x + (up ? HEAD_RX * 0.92 : -HEAD_RX * 0.92);
    const tip = y + (up ? STEM : -STEM);
    seg(noteSegs, sx, y, sx, tip);
    if (i % 2 === 1) {
      const prev = notes[notes.length - 1]!;
      const pUp = prev.y < cy + SPACING * 0.5;
      const px = prev.x + (pUp ? HEAD_RX * 0.92 : -HEAD_RX * 0.92);
      const py = prev.y + (pUp ? STEM : -STEM);
      seg(noteSegs, px, py, sx, tip);
      seg(noteSegs, px, py - 0.005, sx, tip - 0.005);
    }
    const half = 0.012 + rand() * 0.01;
    const ly = cy - LYRIC_DROP;
    seg(content, x - half, ly, x + half, ly);
    notes.push({ x, y, sys, from, count: noteSegs.length / 3 - from, lx0: x - half, lx1: x + half, ly });
  }
}
const noteLines = createLines(new Float32Array(noteSegs), { color: WARM });
const noteBase = new Float32Array(noteSegs);

// Player bar.
const playerY = tB + 0.04;
const progL = tL + 0.08;
const progR = tR - 0.04;
play(content, tL + 0.045, playerY, 0.022);
seg(content, progL, playerY, progR, playerY);

const tabContent = createLines(
  orderSegments(new Float32Array(content), (_x, y) => -y),
  { color: WARM }
);

// ---------------------------------------------------------------------------
// The phone: the Kirchentag app
// ---------------------------------------------------------------------------
const phoneSegs: Segs = [];
const pL = PHONE.x - PHONE.w / 2 + PHONE.bezel;
const pR = PHONE.x + PHONE.w / 2 - PHONE.bezel;
const pT = PHONE.y + PHONE.h / 2 - PHONE.bezel - 0.01;
const pB = PHONE.y - PHONE.h / 2 + PHONE.bezel + 0.01;

// Speaker slot in the top bezel.
seg(phoneSegs, PHONE.x - 0.03, PHONE.y + PHONE.h / 2 - 0.012, PHONE.x + 0.03, PHONE.y + PHONE.h / 2 - 0.012);

// Header: the cross, the wordmark, the menu.
const hdrB = pT - 0.05;
seg(phoneSegs, pL, hdrB, pR, hdrB);
seg(phoneSegs, pL + 0.025, pT - 0.008, pL + 0.025, hdrB + 0.008);
seg(phoneSegs, pL + 0.014, pT - 0.02, pL + 0.036, pT - 0.02);
seg(phoneSegs, pL + 0.05, (pT + hdrB) / 2, pL + 0.16, (pT + hdrB) / 2);
for (let i = -1; i <= 1; i++) {
  const y = (pT + hdrB) / 2 + i * 0.008;
  seg(phoneSegs, pR - 0.038, y, pR - 0.016, y);
}

// The live stream.
const vL = pL + 0.01;
const vR = pR - 0.01;
const vT = hdrB - 0.012;
const vB = vT - ((vR - vL) * 9) / 16;
rect(phoneSegs, vL, vB, vR, vT);
play(phoneSegs, (vL + vR) / 2, (vT + vB) / 2, 0.03);
seg(phoneSegs, vL + 0.032, vT - 0.016, vL + 0.07, vT - 0.016);
const liveDotAt: [number, number] = [vL + 0.018, vT - 0.016];

// The days.
const DAYS = 7;
const dT = vB - 0.014;
const dB = dT - 0.036;
const dayW = (vR - vL) / DAYS;
const dayBox = (d: number) => [vL + d * dayW + 0.002, dB, vL + (d + 1) * dayW - 0.002, dT] as const;
for (let d = 0; d < DAYS; d++) {
  const [x0, y0, x1, y1] = dayBox(d);
  rect(phoneSegs, x0, y0, x1, y1);
  const mx = (x0 + x1) / 2;
  seg(phoneSegs, mx - 0.008, y1 - 0.011, mx + 0.008, y1 - 0.011);
  seg(phoneSegs, mx - 0.006, y0 + 0.011, mx + 0.006, y0 + 0.011);
}

// The programme: a day's worth of items, laid out once; it scrolls in a pool.
const listT = dB - 0.012;
const listB = pB;
interface Item {
  h: number;
  /** [ax, ay, bx, by] per stroke, y measured down from the item's top. */
  strokes: number[];
}
const items: Item[] = [];
const cL = pL + 0.01;
const cR = pR - 0.01;
const addHeader = () => {
  const s: number[] = [];
  const h = 0.032;
  s.push(cL, 0, cR, 0, cR, 0, cR, -h, cR, -h, cL, -h, cL, -h, cL, 0);
  const w = 0.07 + rand() * 0.05;
  s.push(cL + 0.012, -0.014, cL + 0.012 + w, -0.014);
  s.push(cL + 0.012, -0.018, cL + 0.012 + w, -0.018);
  // The coloured tag in the corner.
  s.push(cR - 0.055, 0, cR - 0.055, -0.012, cR - 0.055, -0.012, cR, -0.012);
  items.push({ h, strokes: s });
};
const addEvent = () => {
  const s: number[] = [];
  const h = 0.082;
  s.push(cL, 0, cR, 0, cR, 0, cR, -h, cR, -h, cL, -h, cL, -h, cL, 0);
  // Time.
  s.push(cL + 0.012, -0.016, cL + 0.058, -0.016);
  s.push(cL + 0.012, -0.02, cL + 0.058, -0.02);
  // Place and audience chips.
  const chips = rand() < 0.5 ? 1 : 2;
  let x1 = cR - 0.01;
  for (let c = 0; c < chips; c++) {
    const w = 0.026 + rand() * 0.022;
    const x0 = x1 - w;
    s.push(x0, -0.01, x1, -0.01, x1, -0.01, x1, -0.024, x1, -0.024, x0, -0.024, x0, -0.024, x0, -0.01);
    x1 = x0 - 0.005;
  }
  // Title, description, "Mehr".
  s.push(cL + 0.012, -0.04, cL + 0.012 + 0.1 + rand() * 0.09, -0.04);
  s.push(cL + 0.012, -0.056, cL + 0.012 + 0.08 + rand() * 0.1, -0.056);
  s.push(cR - 0.036, -0.072, cR - 0.012, -0.072);
  items.push({ h, strokes: s });
};
addHeader();
for (let i = 0, n = 3 + Math.floor(rand() * 2); i < n; i++) addEvent();
addHeader();
for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) addEvent();
const ITEM_GAP = 0.012;
const itemTop: number[] = [];
let listLen = 0;
for (const it of items) {
  itemTop.push(listLen);
  listLen += it.h + ITEM_GAP;
}
const listStrokes = items.reduce((n, it) => n + it.strokes.length / 4, 0);

const phoneContent = createLines(
  orderSegments(new Float32Array(phoneSegs), (_x, y) => -y),
  { color: WARM }
);

// ---------------------------------------------------------------------------
// What moves
// ---------------------------------------------------------------------------
/** The programme, rewritten every frame as it scrolls (two copies cover the wrap). */
const listPool = createLinkPool(listStrokes * 2, { color: WARM });
/** Tablet highlights: playhead, sounding syllable, progress. */
const hot = createLinkPool(8, { color: HOT });
/** Phone highlight: the selected day. */
const dayHot = createLinkPool(4, { color: HOT });
/** Note heads plus the player's knob. */
const dots = createDots(notes.length + 1, { color: WARM, hot: HOT });
const KNOB = notes.length;
for (let i = 0; i < notes.length; i++) {
  dots.position[i * 3] = notes[i]!.x;
  dots.position[i * 3 + 1] = notes[i]!.y;
  dots.position[i * 3 + 2] = 0.004;
  dots.size[i] = 0.03;
}
dots.position[KNOB * 3 + 1] = playerY;
dots.position[KNOB * 3 + 2] = 0.004;
dots.flush({ size: true });
/** The stream's live dot. */
const live = createDots(1, { color: ON_AIR, hot: ON_AIR });
live.position[0] = liveDotAt[0];
live.position[1] = liveDotAt[1];
live.position[2] = 0.004;
live.flush({ size: true });

const pushClipped = (ax: number, ay: number, bx: number, by: number) => {
  if (ay === by) {
    if (ay > listT || ay < listB) return;
    listPool.push(ax, ay, 0, bx, by, 0);
    return;
  }
  const lo = Math.max(Math.min(ay, by), listB);
  const hi = Math.min(Math.max(ay, by), listT);
  if (hi <= lo) return;
  listPool.push(ax, lo, 0, bx, hi, 0);
};

const groupRef = shallowRef<Group | null>(null);
const stageRef = shallowRef<Group | null>(null);
const tabletRef = shallowRef<Group | null>(null);
const phoneRef = shallowRef<Group | null>(null);
let curX = 0;
let curY = 0;

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const group = groupRef.value;
  const stage = stageRef.value;
  if (!group || !stage) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;

  const still = reducedMotion.value;
  const drive = props.cardProgress ?? reveal;
  setDotScale(dots, height.value);
  setDotScale(live, height.value);

  const ease = approach(0.07, delta);
  curX += ((still ? 0 : pointer.value.x) - curX) * ease;
  curY += ((still ? 0 : pointer.value.y) - curY) * ease;
  stage.rotation.set(0.06 + curY * 0.08, curX * 0.18, 0);
  const aspect = width.value / Math.max(1, height.value);
  const tablet = tabletRef.value;
  const phone = phoneRef.value;
  let fit = 1;
  if (tablet && phone) {
    if (aspect < 1) {
      fit = Math.min(1, (2 * HALF_H * aspect * 0.92) / PORTRAIT_WIDTH);
      stage.position.x = PORTRAIT_CENTRE_X;
      tablet.position.set(PORTRAIT_TAB_X, TAB_Y, 0);
      tablet.rotation.set(TAB_TILT, TAB_TURN * 0.4, 0);
      tablet.scale.setScalar(1);
      phone.position.set(PORTRAIT_PHONE_X, PHONE_AT[1], PHONE_AT[2]);
      phone.scale.setScalar(1);
    } else {
      stage.position.x = NUDGE[0];
      const tabFit = Math.min(1, Math.max(TAB_MIN_FIT, aspect / TAB_FULL_ASPECT));
      tablet.position.set(Math.max(TAB_FAR_X, -HALF_H * aspect + TAB_EDGE * tabFit), TAB_Y, 0);
      tablet.rotation.set(TAB_TILT, TAB_TURN, 0);
      tablet.scale.setScalar(TAB_SCALE * tabFit);
      phone.position.set(...PHONE_AT);
      phone.scale.setScalar(PHONE_SCALE);
    }
  }
  group.scale.setScalar(STAGE_SCALE * fit * (0.94 + 0.06 * reveal));

  const framed = smoothstep(FRAME_START, FRAME_START + FRAME_WINDOW, drive);
  const filled = smoothstep(CONTENT_START, CONTENT_START + CONTENT_WINDOW, drive);
  const written = smoothstep(NOTE_START, NOTE_START + NOTE_WINDOW, drive);
  const running = written > 0.5;

  // --- Tablet: the song plays ------------------------------------------------
  // Under reduced motion the playhead is parked on the first phrase.
  const page = still ? 0.12 : (elapsed / BAR_SECONDS) % 1;
  const system = page < 0.5 ? 0 : 1;
  const headX = sL + ((page % 0.5) / 0.5) * (sR - sL);
  const cy = SYSTEMS[system]!;

  hot.begin();
  if (running) {
    hot.push(headX, cy - SPACING * 3.4, 0.01, headX, cy + SPACING * 3.4, 0.01);
    const knobX = progL + page * (progR - progL);
    hot.push(progL, playerY, 0.006, knobX, playerY, 0.006);
    dots.position[KNOB * 3] = knobX;
  }

  const pos = noteLines.position;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const d = (n.x - headX) / LIGHT_SIGMA;
    const sound = running && n.sys === system ? Math.exp(-0.5 * d * d) : 0;
    dots.glow[i] = sound;
    dots.size[i] = 0.03 + 0.02 * sound;
    const dy = sound * LIFT;
    for (let v = 0; v < n.count; v++) {
      const o = (n.from + v) * 3;
      pos[o + 1] = noteBase[o + 1]! + dy;
    }
    dots.position[i * 3 + 1] = n.y + dy;
    if (sound > 0.5) hot.push(n.lx0, n.ly, 0.006, n.lx1, n.ly, 0.006);
  }
  hot.end();
  noteLines.attr.needsUpdate = true;
  dots.size[KNOB] = running ? 0.04 : 0;
  dots.glow[KNOB] = 1;
  dots.flush({ size: true });

  // --- Phone: the programme scrolls -------------------------------------------
  // Each pass through the list is a day; at the wrap the next day is selected.
  const travel = still ? listLen * 0.3 + listLen : elapsed * SCROLL_SPEED;
  const offset = travel % listLen;
  const day = Math.floor(travel / listLen) % DAYS;
  dayHot.begin();
  if (running) {
    const [x0, y0, x1, y1] = dayBox(day);
    const i = 0.004;
    dayHot.push(x0 + i, y0 + i, 0.004, x1 - i, y0 + i, 0.004);
    dayHot.push(x1 - i, y0 + i, 0.004, x1 - i, y1 - i, 0.004);
    dayHot.push(x1 - i, y1 - i, 0.004, x0 + i, y1 - i, 0.004);
    dayHot.push(x0 + i, y1 - i, 0.004, x0 + i, y0 + i, 0.004);
  }
  dayHot.end();

  listPool.begin();
  if (filled > 0.5) {
    for (let copy = 0; copy < 2; copy++) {
      for (let k = 0; k < items.length; k++) {
        const it = items[k]!;
        const top = listT + offset - itemTop[k]! - copy * listLen;
        if (top - it.h > listT || top < listB) continue;
        const s = it.strokes;
        for (let j = 0; j < s.length; j += 4) {
          pushClipped(s[j]!, top + s[j + 1]!, s[j + 2]!, top + s[j + 3]!);
        }
      }
    }
  }
  listPool.end();

  // The live dot breathes.
  const pulse = still ? 1 : 0.6 + 0.4 * Math.sin(elapsed * 4);
  live.size[0] = running ? 0.03 + 0.01 * pulse : 0;
  live.glow[0] = pulse;
  live.flush({ size: true });

  // --- Ink ------------------------------------------------------------------
  drawFraction(tabFrames.geometry, tabFrames.vertexCount, framed);
  drawFraction(phoneFrames.geometry, phoneFrames.vertexCount, framed);
  drawFraction(tabContent.geometry, tabContent.vertexCount, filled);
  drawFraction(phoneContent.geometry, phoneContent.vertexCount, filled);
  drawFraction(noteLines.geometry, noteLines.vertexCount, written);
  tabFrames.material.opacity = 0.55 * reveal;
  phoneFrames.material.opacity = 0.55 * reveal;
  tabContent.material.opacity = 0.5 * reveal;
  phoneContent.material.opacity = 0.5 * reveal;
  noteLines.material.opacity = 0.75 * reveal;
  listPool.material.opacity = 0.5 * reveal * smoothstep(0.5, 1, filled);
  hot.material.opacity = 0.7 * reveal;
  dayHot.material.opacity = 0.7 * reveal;
  dots.material.uniforms.uOpacity!.value = 0.95 * reveal * written;
  live.material.uniforms.uOpacity!.value = 0.95 * reveal;
});

onBeforeUnmount(() => {
  tabFrames.dispose();
  phoneFrames.dispose();
  tabContent.dispose();
  phoneContent.dispose();
  dayHot.dispose();
  noteLines.dispose();
  listPool.dispose();
  hot.dispose();
  dots.dispose();
  live.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <TresGroup ref="stageRef" :position="NUDGE">
      <TresGroup ref="tabletRef">
        <primitive :object="tabFrames.lines" />
        <primitive :object="tabContent.lines" />
        <primitive :object="noteLines.lines" />
        <primitive :object="hot.lines" />
        <primitive :object="dots.points" />
      </TresGroup>
      <TresGroup ref="phoneRef">
        <primitive :object="phoneFrames.lines" />
        <primitive :object="phoneContent.lines" />
        <primitive :object="listPool.lines" />
        <primitive :object="dayHot.lines" />
        <primitive :object="live.points" />
      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
