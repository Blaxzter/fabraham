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
  easeOutCubic,
  mulberry32,
  setDotScale,
  smoothstep,
  type SetPieceProps,
} from "./lineArt";

/**
 * The Experte chapter's backdrop: RETRIEVAL, IN THE OPEN. A shelf of documents
 * is scanned by a query, the few that match pull out of the shelf, and the
 * answer writes itself on the right — one line at a time, each line tied back
 * by a citation beam to the document it came from.
 *
 * What this replaces, and why
 * ---------------------------
 * The first version was nine empty rectangles breathing toward the centre with
 * a white line pulsing beside them. It said "boxes"; it did not say retrieval:
 *
 *   - **The boxes were empty.** A rectangle is a rectangle. Four short strokes
 *     inside it is a page of text, and that is the whole difference between a
 *     shape and a document.
 *   - **Nothing was retrieved.** Everything moved at once, all the time, so no
 *     document was ever singled out. The point of RAG is that a FEW documents
 *     answer a question — so a query scans, three light up, and the rest stay
 *     where they are.
 *   - **The answer was a line.** The product's whole claim is CITED answers, so
 *     the answer is now a panel that composes itself, and no line of it appears
 *     without a beam running back to the page it came from.
 *
 * The shelf assembles off `cardProgress` (scroll back up and it un-shelves);
 * the retrieval cycle runs on its own clock. See ./lineArt.ts for the moves.
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

const DOC = "#7fe7ff";
const HOT = "#ffffff";

/** Shelf size vs. the frame it stands in — see RouteArc's STAGE_SCALE. */
const STAGE_SCALE = 0.5;
const PAGES = 12;
const PAGE_W = 0.3;
const PAGE_H = 0.4;
const PAGE_LINES = 4;
const SEG_PER_PAGE = 4 + PAGE_LINES;
const TOP_K = 3;

// Where the answer panel stands, and how big.
const ANSWER_X = 1.02;
const ANSWER_W = 0.66;
const ANSWER_H = 0.86;
const ANSWER_LINES = 6;

// Assembly, in card-local progress.
const SHELF_START = 0.05;
const SHELF_WINDOW = 0.4;
const PANEL_START = 0.34;
const PANEL_WINDOW = 0.22;

// The retrieval cycle, in seconds, and the beats inside one turn of it.
const CYCLE = 5.4;
const SCAN_FROM = 0.02;
const SCAN_TO = 0.3;
const PULL_AT = 0.26;
const WRITE_FROM = 0.42;
const WRITE_TO = 0.82;
const RELEASE_AT = 0.88;

const rand = mulberry32(9311 + props.variant.length * 137 + 3);

// ---------------------------------------------------------------------------
// The shelf
// ---------------------------------------------------------------------------
interface Page {
  x: number;
  y: number;
  z: number;
  /** Vertices relative to the page centre, so the page can be pulled forward
   *  and scaled per frame without rebuilding it. */
  local: Float32Array;
}

const pages: Page[] = [];
for (let i = 0; i < PAGES; i++) {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = -1.28 + col * 0.34 + (rand() - 0.5) * 0.05;
  const y = (1 - row) * 0.47 + (rand() - 0.5) * 0.06;
  // The shelf recedes to the left, so it reads as a corpus going back in depth
  // rather than a wall of tiles.
  const z = -0.42 + col * 0.13 + (rand() - 0.5) * 0.05;
  const hw = PAGE_W / 2;
  const hh = PAGE_H / 2;
  const local: number[] = [];
  const corners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  for (let e = 0; e < 4; e++) {
    const a = corners[e]!;
    const b = corners[(e + 1) % 4]!;
    local.push(a[0], a[1], 0, b[0], b[1], 0);
  }
  // Lines of text: a full-width first line, then ragged ones. The ragged right
  // edge is what reads as prose rather than as a ruled form.
  for (let l = 0; l < PAGE_LINES; l++) {
    const ly = hh * (0.5 - l * 0.32);
    const lw = hw * (l === 0 ? 0.74 : 0.4 + rand() * 0.32);
    local.push(-hw * 0.62, ly, 0, -hw * 0.62 + lw * 1.6, ly, 0);
  }
  pages.push({ x, y, z, local: new Float32Array(local) });
}

/** One buffer for the whole shelf; per-page movement is written into it each
 *  frame. Pages are laid out FRONT TO BACK so a single draw range shelves them
 *  in that order. */
const shelf = createLines(new Float32Array(PAGES * SEG_PER_PAGE * 6), { color: DOC });

// ---------------------------------------------------------------------------
// The answer panel
// ---------------------------------------------------------------------------
/** The frame arrives with the scroll; the writing is driven by the cycle, so
 *  the two live in separate buffers with separate draw ranges. */
const panelFrame = createLines(
  (() => {
    const hw = ANSWER_W / 2;
    const hh = ANSWER_H / 2;
    const segs: number[] = [];
    const corners: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
    for (let e = 0; e < 4; e++) {
      const a = corners[e]!;
      const b = corners[(e + 1) % 4]!;
      segs.push(ANSWER_X + a[0], a[1], 0, ANSWER_X + b[0], b[1], 0);
    }
    return new Float32Array(segs);
  })(),
  { color: DOC }
);

/** Where each written line sits, and the citation tick at the end of it. */
const answerLineY: number[] = [];
const panelText = createLines(
  (() => {
    const hw = ANSWER_W / 2;
    const hh = ANSWER_H / 2;
    const segs: number[] = [];
    for (let l = 0; l < ANSWER_LINES; l++) {
      const ly = hh * 0.66 - l * (hh * 1.34) / (ANSWER_LINES - 1);
      const lw = hw * (0.55 + rand() * 0.3);
      answerLineY.push(ly);
      segs.push(
        ANSWER_X - hw * 0.72, ly, 0,
        ANSWER_X - hw * 0.72 + lw * 1.5, ly, 0
      );
    }
    return new Float32Array(segs);
  })(),
  { color: HOT }
);

/** Live wires: the scan line, the beams from matched pages to the answer. */
const wires = createLinkPool(TOP_K * 2 + 2, { color: HOT });
/** Citation markers — one dot per written line, plus the query dot leading the
 *  scan. The dots are what make a written line look CITED rather than typed. */
const marks = createDots(ANSWER_LINES + 1, { color: DOC, hot: HOT });
const QUERY_DOT = ANSWER_LINES;
for (let l = 0; l < ANSWER_LINES; l++) {
  marks.position[l * 3] = ANSWER_X + ANSWER_W * 0.42;
  marks.position[l * 3 + 1] = answerLineY[l]!;
  marks.position[l * 3 + 2] = 0;
  marks.size[l] = 0.06;
}
marks.size[QUERY_DOT] = 0.16;
marks.flush({ size: true });

/** Which pages a given cycle retrieves. Deterministic, and deliberately spread
 *  across the shelf so the beams cross it rather than bunching in one corner. */
const pickFor = (cycle: number, slot: number) =>
  (cycle * 5 + slot * 4 + slot) % PAGES;

const groupRef = shallowRef<Group | null>(null);
const stageRef = shallowRef<Group | null>(null);
let curX = 0;
let curY = 0;
/** Per-page pull-out, eased toward its target every frame so a page that stops
 *  being a match slides back instead of snapping. */
const pull = new Float32Array(PAGES);

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
  setDotScale(marks, height.value);

  const ease = approach(0.07, delta);
  curX += ((still ? 0 : pointer.value.x) - curX) * ease;
  curY += ((still ? 0 : pointer.value.y) - curY) * ease;
  stage.rotation.set(curY * 0.1, -0.16 + curX * 0.26, 0);
  group.scale.setScalar(STAGE_SCALE * (0.92 + 0.08 * reveal));

  // --- Where the cycle is ---------------------------------------------------
  // Under reduced motion the cycle parks mid-answer: three pages out, beams up,
  // the answer written. Nothing moves, and the piece still says what it means.
  const phase = still ? 0.8 : elapsed / CYCLE;
  const cycle = Math.floor(phase);
  const u = still ? 0.8 : phase - cycle;
  const scan = smoothstep(SCAN_FROM, SCAN_TO, u);
  const writing = smoothstep(WRITE_FROM, WRITE_TO, u);
  const release = smoothstep(RELEASE_AT, 1, u);
  const live = (1 - release) * reveal;

  // --- Pages ----------------------------------------------------------------
  const pos = shelf.position;
  const damp = approach(0.12, delta);
  for (let p = 0; p < PAGES; p++) {
    const page = pages[p]!;
    // Is this page one of this cycle's matches, and has the scan reached it?
    let matched = 0;
    for (let s = 0; s < TOP_K; s++) {
      if (pickFor(cycle, s) === p) {
        matched = smoothstep(PULL_AT, PULL_AT + 0.14, u) * (1 - release);
        break;
      }
    }
    const out = pull[p]! + (matched - pull[p]!) * damp;
    pull[p] = out;
    // A match steps out of the shelf toward the viewer and grows a little; the
    // rest hold their place. Movement confined to the few is what makes those
    // few read as chosen.
    const px = page.x + out * 0.1;
    const py = page.y + out * 0.05;
    const pz = page.z + out * 0.62;
    const sc = 1 + out * 0.16;
    const local = page.local;
    const base = p * SEG_PER_PAGE * 6;
    for (let v = 0; v < SEG_PER_PAGE * 2; v++) {
      const o = base + v * 3;
      pos[o] = px + local[v * 3]! * sc;
      pos[o + 1] = py + local[v * 3 + 1]! * sc;
      pos[o + 2] = pz;
    }
  }
  shelf.attr.needsUpdate = true;

  // --- Query scan and citation beams ---------------------------------------
  wires.begin();
  const scanX = -1.5 + scan * 2.1;
  if (scan > 0.002 && scan < 0.998 && !still) {
    // A vertical scan line crossing the shelf: the query going through the
    // corpus. It is the only thing moving before the matches answer.
    wires.push(scanX, -0.72, 0.2, scanX, 0.78, 0.2);
    marks.position[QUERY_DOT * 3] = scanX;
    marks.position[QUERY_DOT * 3 + 1] = 0.78;
    marks.position[QUERY_DOT * 3 + 2] = 0.2;
    marks.glow[QUERY_DOT] = 1;
  } else {
    marks.glow[QUERY_DOT] = 0;
  }

  for (let s = 0; s < TOP_K; s++) {
    const p = pickFor(cycle, s);
    const out = pull[p]!;
    if (out < 0.03) continue;
    const page = pages[p]!;
    // The beam GROWS from the page toward the line it will support, so the
    // evidence visibly arrives before the sentence does.
    const g = easeOutCubic(clamp01((writing * ANSWER_LINES - s * 1.6) / 1.4));
    if (g <= 0.01) continue;
    const ax = page.x + out * 0.1 + PAGE_W * 0.5;
    const ay = page.y + out * 0.05;
    const az = page.z + out * 0.62;
    const bx = ANSWER_X - ANSWER_W * 0.5;
    const by = answerLineY[Math.min(ANSWER_LINES - 1, s * 2)]!;
    wires.push(ax, ay, az, ax + (bx - ax) * g, ay + (by - ay) * g, az + (0 - az) * g);
  }
  wires.end();

  // --- The answer writes itself --------------------------------------------
  const written = writing * ANSWER_LINES;
  drawFraction(panelText.geometry, panelText.vertexCount, written / ANSWER_LINES);
  for (let l = 0; l < ANSWER_LINES; l++) {
    // A citation mark lands as its line finishes, then holds.
    marks.glow[l] = clamp01(written - l - 0.6) * (1 - release);
  }
  marks.flush();

  // --- Ink ------------------------------------------------------------------
  drawFraction(
    shelf.geometry,
    shelf.vertexCount,
    smoothstep(SHELF_START, SHELF_START + SHELF_WINDOW, drive)
  );
  drawFraction(
    panelFrame.geometry,
    panelFrame.vertexCount,
    smoothstep(PANEL_START, PANEL_START + PANEL_WINDOW, drive)
  );
  shelf.material.opacity = 0.5 * reveal;
  panelFrame.material.opacity = 0.62 * reveal;
  panelText.material.opacity = 0.9 * live;
  wires.material.opacity = 0.85 * live;
  marks.material.uniforms.uOpacity!.value = 0.95 * reveal;
});

onBeforeUnmount(() => {
  shelf.dispose();
  panelFrame.dispose();
  panelText.dispose();
  wires.dispose();
  marks.dispose();
});
</script>

<template>
  <TresGroup ref="groupRef" :position="props.position" :visible="false">
    <TresGroup ref="stageRef">
      <primitive :object="shelf.lines" />
      <primitive :object="panelFrame.lines" />
      <primitive :object="panelText.lines" />
      <primitive :object="wires.lines" />
      <primitive :object="marks.points" />
    </TresGroup>
  </TresGroup>
</template>
