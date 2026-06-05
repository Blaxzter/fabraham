<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import Lattice from "./setpieces/Lattice.vue";
import BerlinSkyline from "./setpieces/BerlinSkyline.vue";
import RouteArc from "./setpieces/RouteArc.vue";
import ThreadBoard from "./setpieces/ThreadBoard.vue";
import DocumentGrid from "./setpieces/DocumentGrid.vue";
import StaffLines from "./setpieces/StaffLines.vue";

/**
 * Maps each chapter's `setPiece` to its 3D line component and renders it inside
 * the canvas, fading via the chapter's scroll-driven `reveal`. New set-pieces
 * (BerlinSkyline, RouteArc, ThreadBoard, DocumentGrid, StaffLines) only need to
 * be added to `SET_PIECES` — the chapter markdown already references them.
 */
const timeline = useTimelineStore();
// Ensure the chapter data is loaded even if the scene mounts before the content.
useTimelineChapters();

const SET_PIECES: Partial<Record<string, Component>> = {
  lattice: Lattice,
  berlinSkyline: BerlinSkyline,
  routeArc: RouteArc,
  threadBoard: ThreadBoard,
  documentGrid: DocumentGrid,
  staffLines: StaffLines,
};

// Keep the primary piece centered on the head (e.g. the lattice that surrounds
// it); push stacked pieces aside and back so two set-pieces in one chapter
// (Tatort: lattice + thread-board; Experte: lattice + document-grid) read as
// distinct motifs instead of one tangled mass at the origin.
const SLOT_OFFSETS: [number, number, number][] = [
  [0, 0, 0],
  [1.4, 0.1, -0.4],
  [-1.4, 0.1, -0.4],
];
const offsetFor = (slot: number): [number, number, number] =>
  SLOT_OFFSETS[Math.min(slot, SLOT_OFFSETS.length - 1)]!;

// Flatten chapters → individual set-pieces (a chapter may stack several).
const pieces = computed(() =>
  timeline.chapters.flatMap((chapter, index) =>
    chapter.setPiece
      .map((name, slot) => ({
        key: `${chapter.id}:${name}`,
        index,
        chapter,
        position: offsetFor(slot),
        component: SET_PIECES[name],
      }))
      .filter((p) => p.component)
  )
);
</script>

<template>
  <component
    :is="piece.component"
    v-for="piece in pieces"
    :key="piece.key"
    :reveal="timeline.revealFor(piece.index)"
    :variant="piece.chapter.setPieceVariant"
    :position="piece.position"
  />
</template>
