<script setup lang="ts">
import { shallowRef, onBeforeUnmount } from "vue";
import { useWindowSize } from "@vueuse/core";
import { useLoop } from "@tresjs/core";
import type { Group } from "three";
import {
  approach,
  clamp01,
  createDots,
  createLinkPool,
  createLines,
  drawFraction,
  mulberry32,
  setDotScale,
  smoothstep,
  type SetPieceProps,
} from "./lineArt";

/**
 * The Tatort chapter's backdrop: a detective's PINBOARD — notes pinned to a
 * leaning board, threaded together with red string, with the lead travelling
 * from note to note.
 *
 * What this replaces, and why
 * ---------------------------
 * The first version was a scatter of dots wired by proximity, tilted a little
 * and pulsed with a sine. It was trying to be two things at once — a detective
 * board AND a traffic topology — and landed on neither, because it had none of
 * the things that make a pinboard legible:
 *
 *   - **There were no notes.** A board is notes first, string second; bare dots
 *     read as a graph. Every pin here carries a NOTE — a rotated rectangle with
 *     lines of writing in it — which is what makes the motif land at a glance.
 *   - **The string was straight.** String sags. Straight lines between nodes
 *     read as a computer diagram; a catenary droop reads as something physical
 *     someone tied. That one detail does more than any amount of extra wiring.
 *   - **Nothing was being investigated.** Now the board ASSEMBLES as the card
 *     scrolls in — notes pin up one at a time, then the string threads through
 *     them in order — and a lead travels the thread on its own clock, burning
 *     each note as it arrives.
 *
 * The scale story this chapter tells (100k contracted, 18k live, five people)
 * is carried by the card's own numbers and by the embedding cloud beside it;
 * this piece carries the show. See ./lineArt.ts for the shared moves.
 */
const props = withDefaults(defineProps<SetPieceProps>(), {
  reveal: 0,
  variant: "",
  position: () => [0, 0, 0],
  cardProgress: undefined,
});

const { pointer } = usePointer();
const { reducedMotion } = usePreferences();
const { height } = useWindowSize();

const STRING = "#ff6b6b";
const PIN = "#ffb0b0";
const HOT = "#fff1e6";

/** Board size vs. the frame it hangs in — see RouteArc's STAGE_SCALE. */
const STAGE_SCALE = 0.56;
const CARDS = 9;
const SPAN_X = 2.5;
const SPAN_Y = 1.7;
/** Samples per string span. Enough for the droop to read as a curve, few enough
 *  that the whole board is a couple of hundred segments. */
const SAG_STEPS = 9;

// Assembly, in card-local progress. Notes go up first, then the thread.
const PIN_START = 0.05;
const PIN_WINDOW = 0.38;
const THREAD_START = 0.3;
const THREAD_WINDOW = 0.42;

// The lead travelling the thread.
const LEG_SECONDS = 1.5;
const BURN_TAIL = 0.55; // how long a note stays lit after the lead leaves it

const rand = mulberry32(CARDS * 7919 + props.variant.length * 137 + 13);

// ---------------------------------------------------------------------------
// Layout: notes on a leaning board
// ---------------------------------------------------------------------------
interface Note {
  x: number;
  y: number;
  hw: number;
  hh: number;
  rot: number;
  /** Corners, board-local, already rotated — the highlight re-draws from these. */
  corners: number[];
}

const notes: Note[] = [];
for (let i = 0; i < CARDS; i++) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = (col - 1) * (SPAN_X / 2.6) + (rand() - 0.5) * 0.22;
  const y = (1 - row) * (SPAN_Y / 2.7) + (rand() - 0.5) * 0.18;
  // Portrait-ish notes of slightly different sizes, each pinned a little askew.
  const hw = (0.2 + rand() * 0.07) / 2;
  const hh = (0.26 + rand() * 0.08) / 2;
  const rot = (rand() - 0.5) * 0.34;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const corners: number[] = [];
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    corners.push(x + (sx * hw * c - sy * hh * s), y + (sx * hw * s + sy * hh * c));
  }
  notes.push({ x, y, hw, hh, rot, corners });
}

/** The order the lead follows. A deterministic walk that crosses the board
 *  rather than reading it like a page — the thread should tangle a little. */
const chain = [0, 4, 1, 5, 8, 3, 6, 7, 2].filter((i) => i < CARDS);

/** Note index to its position in the chain — the order it pins up in. Looked up
 *  for every note every frame, so it is a table, not a search. */
const chainPos = new Int32Array(CARDS);
chain.forEach((note, at) => (chainPos[note] = at));

/** Where the pin sits on a note: just above its middle, so the string hangs
 *  from the pin and the note hangs under it. */
const pinOf = (n: Note) => ({ x: n.x - Math.sin(n.rot) * n.hh * 0.72, y: n.y + Math.cos(n.rot) * n.hh * 0.72 });

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
/** Notes, built in CHAIN order so a single draw range pins them up one by one. */
const notePositions = (() => {
  const segs: number[] = [];
  for (const i of chain) {
    const n = notes[i]!;
    const c = n.corners;
    for (let e = 0; e < 4; e++) {
      const a = e * 2;
      const b = ((e + 1) % 4) * 2;
      segs.push(c[a]!, c[a + 1]!, 0, c[b]!, c[b + 1]!, 0);
    }
    // Three lines of "writing", inset and rotated with the note. Without these a
    // rectangle is just a rectangle; with them it is a note.
    const cs = Math.cos(n.rot);
    const sn = Math.sin(n.rot);
    for (let l = 0; l < 3; l++) {
      const ly = n.hh * (0.34 - l * 0.34);
      const lw = n.hw * (0.42 + rand() * 0.3);
      segs.push(
        n.x + (-lw * cs - ly * sn), n.y + (-lw * sn + ly * cs), 0,
        n.x + (lw * cs - ly * sn), n.y + (lw * sn + ly * cs), 0
      );
    }
  }
  return new Float32Array(segs);
})();

/** The string: a sagging run between consecutive pins, plus two cross-links so
 *  the board reads as a web rather than a queue. Sampled here once; the lead
 *  rides these same samples, so string and lead can never disagree. */
const threadRuns: Float32Array[] = [];
{
  const runs: [number, number][] = [];
  for (let i = 0; i < chain.length - 1; i++) runs.push([chain[i]!, chain[i + 1]!]);
  runs.push([chain[0]!, chain[chain.length - 1]!]);
  if (CARDS > 5) runs.push([chain[1]!, chain[chain.length - 2]!]);

  for (const [a, b] of runs) {
    const pa = pinOf(notes[a]!);
    const pb = pinOf(notes[b]!);
    const sag = Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.16;
    const pts = new Float32Array((SAG_STEPS + 1) * 3);
    for (let s = 0; s <= SAG_STEPS; s++) {
      const t = s / SAG_STEPS;
      pts[s * 3] = pa.x + (pb.x - pa.x) * t;
      // Parabolic droop: zero at both pins, deepest in the middle.
      pts[s * 3 + 1] = pa.y + (pb.y - pa.y) * t - sag * 4 * t * (1 - t);
      pts[s * 3 + 2] = 0;
    }
    threadRuns.push(pts);
  }
}

const threadPositions = (() => {
  const segs: number[] = [];
  for (const run of threadRuns) {
    for (let s = 0; s < SAG_STEPS; s++) {
      segs.push(
        run[s * 3]!, run[s * 3 + 1]!, run[s * 3 + 2]!,
        run[(s + 1) * 3]!, run[(s + 1) * 3 + 1]!, run[(s + 1) * 3 + 2]!
      );
    }
  }
  return new Float32Array(segs);
})();

const noteLines = createLines(notePositions, { color: STRING });
const thread = createLines(threadPositions, { color: STRING });
const pins = createDots(CARDS, { color: PIN, hot: HOT });
const lead = createDots(1, { color: HOT, hot: HOT });
/** The active note's outline, re-drawn bright over the dim one. */
const burn = createLinkPool(4, { color: HOT });

for (let i = 0; i < CARDS; i++) {
  const p = pinOf(notes[i]!);
  pins.position[i * 3] = p.x;
  pins.position[i * 3 + 1] = p.y;
  pins.position[i * 3 + 2] = 0.012; // a hair proud of the board
  pins.size[i] = 0.085;
}
lead.size[0] = 0.115;
pins.flush({ size: true });
lead.flush({ size: true });

const groupRef = shallowRef<Group | null>(null);
const boardRef = shallowRef<Group | null>(null);
let curX = 0;
let curY = 0;

/** Position along a sampled run, plus which pin it is closest to having reached. */
const runPointAt = (run: Float32Array, t: number, out: number[]) => {
  const u = clamp01(t) * SAG_STEPS;
  const i = Math.min(SAG_STEPS - 1, Math.floor(u));
  const f = u - i;
  out[0] = run[i * 3]! + (run[(i + 1) * 3]! - run[i * 3]!) * f;
  out[1] = run[i * 3 + 1]! + (run[(i + 1) * 3 + 1]! - run[i * 3 + 1]!) * f;
  out[2] = run[i * 3 + 2]! + (run[(i + 1) * 3 + 2]! - run[i * 3 + 2]!) * f;
};
const leadPoint: number[] = [0, 0, 0];

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const group = groupRef.value;
  const board = boardRef.value;
  if (!group || !board) return;
  const reveal = props.reveal;
  group.visible = reveal > 0.001;
  if (!group.visible) return;

  const still = reducedMotion.value;
  const drive = props.cardProgress ?? reveal;
  setDotScale(pins, height.value);
  setDotScale(lead, height.value);

  // --- The board is a physical object ---------------------------------------
  // It leans back on its stand, and turns toward the pointer. Rotating the whole
  // board (rather than sliding the contents) is what sells the notes as pinned
  // TO something instead of floating in front of it.
  const ease = approach(0.07, delta);
  curX += ((still ? 0 : pointer.value.x) - curX) * ease;
  curY += ((still ? 0 : pointer.value.y) - curY) * ease;
  board.rotation.set(-0.1 + curY * 0.16, curX * 0.34, 0.03);
  group.scale.setScalar(STAGE_SCALE * (0.92 + 0.08 * reveal));

  // --- The lead travels the thread ------------------------------------------
  // Legs are the CHAIN runs only (the cross-links are context, not route), so
  // the lead visits every note in order and loops.
  const legs = chain.length - 1;
  let activeNote = -1;
  let activeT = 0;
  if (still) {
    activeNote = chain[0]!;
    runPointAt(threadRuns[0]!, 0, leadPoint);
  } else {
    const phase = elapsed / LEG_SECONDS;
    const leg = Math.floor(phase) % legs;
    const t = phase - Math.floor(phase);
    // Ease into each pin: the lead slows as it arrives, which is where the note
    // burns, then sets off again.
    const eased = smoothstep(0, 1, t);
    runPointAt(threadRuns[leg]!, eased, leadPoint);
    activeNote = chain[eased > 0.5 ? leg + 1 : leg]!;
    activeT = eased > 0.5 ? (eased - 0.5) * 2 : 1 - eased * 2;
  }
  lead.position[0] = leadPoint[0]!;
  lead.position[1] = leadPoint[1]!;
  lead.position[2] = 0.02;
  lead.glow[0] = 1;
  lead.flush();

  // --- Notes light as the lead reaches them ---------------------------------
  const decay = Math.pow(0.9, delta * 60);
  let burnAmt = 0;
  for (let i = 0; i < CARDS; i++) {
    const idx = chainPos[i]!;
    const born = smoothstep(
      PIN_START + (idx / chain.length) * PIN_WINDOW,
      PIN_START + (idx / chain.length) * PIN_WINDOW + 0.05,
      drive
    );
    const hit = i === activeNote ? smoothstep(0, BURN_TAIL, 1 - activeT) : 0;
    pins.glow[i] = Math.max(pins.glow[i]! * decay, hit) * born;
    pins.size[i] = (0.075 + 0.05 * pins.glow[i]!) * born;
    if (i === activeNote) burnAmt = pins.glow[i]!;
  }
  pins.flush({ size: true });

  // The lit note's outline, re-drawn bright on top of the dim one — one note
  // reading as "this is the one" costs four segments.
  burn.begin();
  if (activeNote >= 0 && burnAmt > 0.02) {
    const c = notes[activeNote]!.corners;
    for (let e = 0; e < 4; e++) {
      const a = e * 2;
      const b = ((e + 1) % 4) * 2;
      burn.push(c[a]!, c[a + 1]!, 0.008, c[b]!, c[b + 1]!, 0.008);
    }
  }
  burn.end();

  // --- Ink ------------------------------------------------------------------
  drawFraction(
    noteLines.geometry,
    noteLines.vertexCount,
    smoothstep(PIN_START, PIN_START + PIN_WINDOW, drive)
  );
  drawFraction(
    thread.geometry,
    thread.vertexCount,
    smoothstep(THREAD_START, THREAD_START + THREAD_WINDOW, drive)
  );
  noteLines.material.opacity = 0.62 * reveal;
  thread.material.opacity = 0.66 * reveal;
  burn.material.opacity = 0.85 * burnAmt * reveal;
  pins.material.uniforms.uOpacity!.value = 0.95 * reveal;
  lead.material.uniforms.uOpacity!.value = reveal;
});

onBeforeUnmount(() => {
  noteLines.dispose();
  thread.dispose();
  pins.dispose();
  lead.dispose();
  burn.dispose();
});
</script>

<template>
  <!-- Outer group: the slot position SceneSetPieces assigns. Inner "board":
       the lean and the cursor turn, written imperatively in the loop. -->
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <TresGroup ref="boardRef">
      <primitive :object="thread.lines" />
      <primitive :object="noteLines.lines" />
      <primitive :object="burn.lines" />
      <primitive :object="pins.points" />
      <primitive :object="lead.points" />
    </TresGroup>
  </TresGroup>
</template>
