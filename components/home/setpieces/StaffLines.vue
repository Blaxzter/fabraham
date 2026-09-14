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
  setDotScale,
  smoothstep,
  type SetPieceProps,
} from "./lineArt";

/**
 * The community chapter's backdrop: a page of the hymnal, PLAYING.
 *
 * What this replaces, and why
 * ---------------------------
 * The first version was five horizontal lines with six square dots bobbing on a
 * sine. It read as "five lines and some dots", because notation is not lines
 * and dots:
 *
 *   - **A note is a head, a stem and a beam.** Adding the stems and the beams
 *     that join eighth notes is what turns dots on a staff into music you can
 *     see the rhythm of, and it is a handful of extra segments.
 *   - **One staff is not a page.** Two systems joined by a brace at the left is
 *     the shape of an opened hymnal, which is the object this chapter is about.
 *   - **Bobbing is not playing.** A PLAYHEAD now sweeps the page, and each note
 *     lights and lifts as it passes — the piece performs its own melody instead
 *     of wobbling. That is also the honest picture of the thing being built: an
 *     app a congregation sings along to.
 *
 * The staff draws itself in left to right off `cardProgress`, the notes are
 * written onto it in reading order, and the playhead runs on its own clock once
 * the page is down. See ./lineArt.ts for the shared moves.
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

const WARM = "#ffd479";
const HOT = "#fff3d0";

/** Page size vs. the frame it sits in — see RouteArc's STAGE_SCALE. */
const STAGE_SCALE = 0.62;
const HALF_WIDTH = 1.22;
const SPACING = 0.055; // gap between staff lines
const SYSTEMS = [0.42, -0.42]; // y centre of each staff
const PER_SYSTEM = 8; // notes per staff
const HEAD_SEGMENTS = 12;
const NOTE_TILT = -0.34;
const HEAD_RX = 0.036;
const HEAD_RY = 0.024;

// Assembly, in card-local progress.
const STAFF_START = 0.04;
const STAFF_WINDOW = 0.26;
const NOTE_START = 0.22;
const NOTE_WINDOW = 0.42;

// The performance.
const BAR_SECONDS = 7.5; // one sweep of the playhead across both systems
const LIGHT_SIGMA = 0.075; // how wide the playhead's pool of light is
const LIFT = 0.035; // how far a note rises as it sounds

const rand = mulberry32(PER_SYSTEM * 7919 + props.variant.length * 101 + 13);

// ---------------------------------------------------------------------------
// The page: two staves, bar lines, and the brace that joins them
// ---------------------------------------------------------------------------
const staff = createLines(
  (() => {
    const segs: number[] = [];
    // Staff lines, emitted in vertical order per x-slice so the whole page draws
    // across left to right rather than one staff at a time.
    const SLICES = 30;
    for (let s = 0; s < SLICES; s++) {
      const xa = -HALF_WIDTH + (s / SLICES) * HALF_WIDTH * 2;
      const xb = -HALF_WIDTH + ((s + 1) / SLICES) * HALF_WIDTH * 2;
      for (const cy of SYSTEMS) {
        for (let i = 0; i < 5; i++) {
          const y = cy + (i - 2) * SPACING;
          segs.push(xa, y, 0, xb, y, 0);
        }
      }
    }
    // Bar lines through each staff, plus the double bar that ends the page.
    for (const cy of SYSTEMS) {
      for (const x of [-HALF_WIDTH, -HALF_WIDTH * 0.2, HALF_WIDTH * 0.55]) {
        segs.push(x, cy - 2 * SPACING, 0, x, cy + 2 * SPACING, 0);
      }
      segs.push(HALF_WIDTH, cy - 2 * SPACING, 0, HALF_WIDTH, cy + 2 * SPACING, 0);
      segs.push(
        HALF_WIDTH - 0.022, cy - 2 * SPACING, 0,
        HALF_WIDTH - 0.022, cy + 2 * SPACING, 0
      );
    }
    // The brace: two mirrored curves bulging left of the staves, the mark that
    // says these two systems are one instrument on one page.
    const top = SYSTEMS[0]! + 2 * SPACING;
    const bot = SYSTEMS[1]! - 2 * SPACING;
    const mid = (top + bot) / 2;
    const bx = -HALF_WIDTH - 0.05;
    const N = 26;
    for (let i = 0; i < N; i++) {
      const t0 = i / N;
      const t1 = (i + 1) / N;
      const y = (t: number) => bot + (top - bot) * t;
      // Bulge outward at the quarter points and pinch at the waist.
      const x = (t: number) =>
        bx - Math.sin(t * Math.PI * 2) * 0.045 - Math.sin(t * Math.PI) * 0.012;
      segs.push(x(t0), y(t0), 0, x(t1), y(t1), 0);
    }
    segs.push(bx - 0.006, mid, 0, bx + 0.02, mid, 0);
    return new Float32Array(segs);
  })(),
  { color: WARM }
);

// ---------------------------------------------------------------------------
// The melody
// ---------------------------------------------------------------------------
interface Note {
  x: number;
  y: number;
  /** Index range of this note's vertices in the note buffer, for the lift. */
  from: number;
  count: number;
}

const notes: Note[] = [];
const noteBuffer: number[] = [];

for (let sys = 0; sys < SYSTEMS.length; sys++) {
  const cy = SYSTEMS[sys]!;
  // A phrase that steps rather than jumps: melodies move by step, and a random
  // walk is the one-line way to get that instead of a scatter.
  let step = sys === 0 ? -1 : 2;
  for (let i = 0; i < PER_SYSTEM; i++) {
    // Grouped in pairs, with a breath between groups — the rhythm you can see.
    const group = Math.floor(i / 2);
    const x =
      -HALF_WIDTH * 0.82 +
      group * (HALF_WIDTH * 1.64) / (PER_SYSTEM / 2) +
      (i % 2) * 0.115;
    step += Math.round(rand() * 2 - 1);
    step = Math.max(-4, Math.min(4, step));
    const y = cy + step * (SPACING * 0.5);
    const from = noteBuffer.length / 3;

    // Head: a tilted ellipse, the way a real note-head is cut.
    const c = Math.cos(NOTE_TILT);
    const s = Math.sin(NOTE_TILT);
    for (let k = 0; k < HEAD_SEGMENTS; k++) {
      const a0 = (k / HEAD_SEGMENTS) * Math.PI * 2;
      const a1 = ((k + 1) / HEAD_SEGMENTS) * Math.PI * 2;
      const px0 = Math.cos(a0) * HEAD_RX;
      const py0 = Math.sin(a0) * HEAD_RY;
      const px1 = Math.cos(a1) * HEAD_RX;
      const py1 = Math.sin(a1) * HEAD_RY;
      noteBuffer.push(
        x + px0 * c - py0 * s, y + px0 * s + py0 * c, 0,
        x + px1 * c - py1 * s, y + px1 * s + py1 * c, 0
      );
    }
    // Stem: up on the low half of the staff, down on the high half, as engraved.
    const up = step < 1;
    const sx = x + (up ? HEAD_RX * 0.92 : -HEAD_RX * 0.92);
    const sy = y + (up ? 0.008 : -0.008);
    const tip = sy + (up ? 0.17 : -0.17);
    noteBuffer.push(sx, sy, 0, sx, tip, 0);
    // Beam across the pair: drawn as two strokes, because a beam has thickness
    // and a single line reads as a tie.
    if (i % 2 === 1) {
      const prev = notes[notes.length - 1]!;
      const pUp = prev.y < cy + SPACING * 0.5;
      const px = prev.x + (pUp ? HEAD_RX * 0.92 : -HEAD_RX * 0.92);
      const py = prev.y + (pUp ? 0.178 : -0.178);
      noteBuffer.push(px, py, 0, sx, tip, 0);
      noteBuffer.push(px, py - 0.014, 0, sx, tip - 0.014, 0);
    }
    notes.push({ x, y, from, count: noteBuffer.length / 3 - from });
  }
}

const noteLines = createLines(new Float32Array(noteBuffer), { color: WARM });
/** Immutable copy: the lift is applied as an offset from these each frame. */
const noteBase = new Float32Array(noteBuffer);
/** Filled heads. A ring is a half note; a hymnal is full of quarter notes. */
const heads = createDots(notes.length, { color: WARM, hot: HOT });
/** The playhead, as a bar across the page. */
const playhead = createLinkPool(2, { color: HOT });

for (let i = 0; i < notes.length; i++) {
  heads.position[i * 3] = notes[i]!.x;
  heads.position[i * 3 + 1] = notes[i]!.y;
  heads.position[i * 3 + 2] = 0.004;
  heads.size[i] = 0.075;
}
heads.flush({ size: true });

const groupRef = shallowRef<Group | null>(null);
const stageRef = shallowRef<Group | null>(null);
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
  setDotScale(heads, height.value);

  const ease = approach(0.07, delta);
  curX += ((still ? 0 : pointer.value.x) - curX) * ease;
  curY += ((still ? 0 : pointer.value.y) - curY) * ease;
  // The page sits at an angle on a stand and turns a little toward you.
  stage.rotation.set(0.1 + curY * 0.1, curX * 0.2, 0);
  group.scale.setScalar(STAGE_SCALE * (0.94 + 0.06 * reveal));

  // --- The playhead ---------------------------------------------------------
  // It reads the page: across the top staff, then across the bottom one. Held
  // still under reduced motion, parked on the first phrase.
  const written = smoothstep(NOTE_START, NOTE_START + NOTE_WINDOW, drive);
  const page = still ? 0.12 : (elapsed / BAR_SECONDS) % 1;
  const system = page < 0.5 ? 0 : 1;
  const headX = -HALF_WIDTH + ((page % 0.5) / 0.5) * HALF_WIDTH * 2;
  const cy = SYSTEMS[system]!;

  playhead.begin();
  if (written > 0.5) {
    playhead.push(headX, cy - SPACING * 3.4, 0.01, headX, cy + SPACING * 3.4, 0.01);
  }
  playhead.end();

  // --- Notes sound as it passes --------------------------------------------
  const pos = noteLines.position;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const onSystem = (i < PER_SYSTEM ? 0 : 1) === system;
    const d = (n.x - headX) / LIGHT_SIGMA;
    const sound = onSystem && written > 0.5 ? Math.exp(-0.5 * d * d) : 0;
    heads.glow[i] = sound;
    heads.size[i] = 0.07 + 0.045 * sound;
    // The lift: the note rises out of the staff while it sounds and settles
    // back after. Applied to the note's own slice of the buffer.
    const dy = sound * LIFT;
    for (let v = 0; v < n.count; v++) {
      const o = (n.from + v) * 3;
      pos[o + 1] = noteBase[o + 1]! + dy;
    }
    heads.position[i * 3 + 1] = n.y + dy;
  }
  noteLines.attr.needsUpdate = true;
  heads.flush({ size: true });

  // --- Ink ------------------------------------------------------------------
  drawFraction(
    staff.geometry,
    staff.vertexCount,
    smoothstep(STAFF_START, STAFF_START + STAFF_WINDOW, drive)
  );
  drawFraction(noteLines.geometry, noteLines.vertexCount, written);
  staff.material.opacity = 0.44 * reveal;
  noteLines.material.opacity = 0.75 * reveal;
  playhead.material.opacity = 0.5 * reveal;
  heads.material.uniforms.uOpacity!.value = 0.95 * reveal;
});

onBeforeUnmount(() => {
  staff.dispose();
  noteLines.dispose();
  heads.dispose();
  playhead.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <TresGroup ref="stageRef">
      <primitive :object="staff.lines" />
      <primitive :object="noteLines.lines" />
      <primitive :object="playhead.lines" />
      <primitive :object="heads.points" />
    </TresGroup>
  </TresGroup>
</template>
