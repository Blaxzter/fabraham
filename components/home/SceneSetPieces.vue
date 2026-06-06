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
 * Maps each section's `setPiece` to its 3D line component and renders it inside
 * the canvas, fading via the section's scroll-driven `reveal`. New set-pieces
 * only need to be added to `SET_PIECES` — the section markdown references them.
 */
const store = useSectionsStore();
// Ensure the section data is loaded even if the scene mounts before the content.
useSections();

const SET_PIECES: Partial<Record<string, Component>> = {
  lattice: Lattice,
  berlinSkyline: BerlinSkyline,
  routeArc: RouteArc,
  threadBoard: ThreadBoard,
  documentGrid: DocumentGrid,
  staffLines: StaffLines,
};

// Keep the primary piece centered on the head (e.g. the lattice that surrounds
// it); push stacked pieces aside and back so two set-pieces in one section read
// as distinct motifs instead of one tangled mass at the origin.
const SLOT_OFFSETS: [number, number, number][] = [
  [0, 0, 0],
  [1.4, 0.1, -0.4],
  [-1.4, 0.1, -0.4],
];
const offsetFor = (slot: number): [number, number, number] =>
  SLOT_OFFSETS[Math.min(slot, SLOT_OFFSETS.length - 1)]!;

// Flatten sections → individual set-pieces (a section may stack several).
const pieces = computed(() =>
  store.sections.flatMap((section, index) =>
    section.setPiece
      .map((name, slot) => ({
        key: `${section.id}:${name}`,
        index,
        section,
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
    :reveal="store.revealFor(piece.index)"
    :variant="piece.section.setPieceVariant"
    :position="piece.position"
  />
</template>
