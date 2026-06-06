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
 * Renders the line set-pieces inside the canvas. Two sources:
 * - top-level sections (`section.setPiece`), revealed across the section, and
 * - biography milestones (`milestone.setPiece`), each blooming as its sub-beat
 *   centers within the (single) biography section — restoring the per-milestone
 *   backdrops (skyline, route arc, thread-board, …).
 */
const store = useSectionsStore();
useSections();
const { milestones } = useBiographyMilestones();

const SET_PIECES: Partial<Record<string, Component>> = {
  lattice: Lattice,
  berlinSkyline: BerlinSkyline,
  routeArc: RouteArc,
  threadBoard: ThreadBoard,
  documentGrid: DocumentGrid,
  staffLines: StaffLines,
};

// Keep the primary piece centered on the head; push stacked pieces aside/back so
// two set-pieces in one beat read as distinct motifs, not one tangled mass.
const SLOT_OFFSETS: [number, number, number][] = [
  [0, 0, 0],
  [1.4, 0.1, -0.4],
  [-1.4, 0.1, -0.4],
];
const offsetFor = (slot: number): [number, number, number] =>
  SLOT_OFFSETS[Math.min(slot, SLOT_OFFSETS.length - 1)]!;

const bioIndex = computed(() =>
  store.sections.findIndex((s) => s.type === "biography")
);

const pieces = computed(() => {
  // Section-level backdrops (revealed across the whole section).
  const sectionPieces = store.sections.flatMap((section, index) =>
    section.setPiece
      .map((name, slot) => ({
        key: `s${index}:${slot}:${name}`,
        kind: "section" as const,
        index,
        subIndex: 0,
        subCount: 1,
        variant: section.setPieceVariant,
        position: offsetFor(slot),
        component: SET_PIECES[name],
      }))
      .filter((p) => p.component)
  );

  // Per-milestone backdrops within the biography section.
  const bi = bioIndex.value;
  const count = milestones.value.length || 1;
  const milestonePieces =
    bi < 0
      ? []
      : milestones.value.flatMap((m, j) =>
          m.setPiece
            .map((name, slot) => ({
              key: `m${j}:${slot}:${name}`,
              kind: "milestone" as const,
              index: bi,
              subIndex: j,
              subCount: count,
              variant: m.setPieceVariant,
              position: offsetFor(slot),
              component: SET_PIECES[name],
            }))
            .filter((p) => p.component)
        );

  return [...sectionPieces, ...milestonePieces];
});

const revealOf = (p: {
  kind: "section" | "milestone";
  index: number;
  subIndex: number;
  subCount: number;
}) =>
  p.kind === "milestone"
    ? store.subReveal(p.index, p.subIndex, p.subCount)
    : store.revealFor(p.index);
</script>

<template>
  <component
    :is="piece.component"
    v-for="piece in pieces"
    :key="piece.key"
    :reveal="revealOf(piece)"
    :variant="piece.variant"
    :position="piece.position"
  />
</template>
