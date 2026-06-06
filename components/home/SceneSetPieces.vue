<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { Component } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import type { Group } from "three";
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
 *
 * Legibility through the ASCII post-process (issue #17)
 * ------------------------------------------------------
 * The ASCII `EffectComposer` quantizes the WHOLE rendered scene, so thin lines
 * rendered the normal way get mangled into the same character grid as the head
 * and barely read (the Berlin skyline was effectively invisible). To fix that
 * WITHOUT changing the set-piece contract, we render them selectively:
 *
 *   1. every set-piece object is put on a dedicated render layer
 *      (`SETPIECE_LAYER`). The composer's RenderPass renders with a camera that
 *      only sees layer 0, so the set-pieces are excluded from the ASCII'd image
 *      — only the head/backdrop get quantized.
 *   2. after the composer has drawn the ASCII'd scene to the canvas, we make ONE
 *      extra draw call that re-renders just the set-piece layer, crisp, on top.
 *
 * This keeps the lines sharp and fully 3D/camera-coupled (they are the same
 * Three objects, drawn with the same camera and pose) while the head stays
 * ASCII. It runs inside the single TresJS render loop (`onRender` fires right
 * after the composer) — no second rAF, no per-frame layout reads, nothing
 * retained or allocated per frame (issue #4). The six set-piece components are
 * untouched: only how/where they render changes.
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

// Per-piece "fit" scale (a where-they-render concern, so it lives here, not in
// the components). Most set-pieces are roughly spherical and frame well at 1×.
// The Berlin skyline is a wide, flat silhouette (~2.6 units across) — at 1× the
// camera frustum crops everything but the central mast, so it never reads as a
// skyline. Scaling it down lets the whole silhouette (tower + flanking blocks)
// sit inside the frame.
const FIT_SCALE: Partial<Record<string, number>> = {
  berlinSkyline: 0.45,
};
const scaleFor = (name: string): number => FIT_SCALE[name] ?? 1;

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
        scale: scaleFor(name),
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
              scale: scaleFor(name),
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

// --- Selective render (issue #17) ---------------------------------------------
// Layer the set-pieces sit on. Anything that is NOT this layer (the head, the
// backdrop, dev helpers) renders through the ASCII pass on layer 0 as before.
const SETPIECE_LAYER = 1;

const { scene, camera, renderer } = useTresContext();
const setPiecesRoot = shallowRef<Group | null>(null);

// Set-pieces mount once (after the async content loads) and never swap, so the
// only time the layer assignment needs to (re)run is when the number of mounted
// pieces changes. Steady state is a single integer compare per frame.
let layeredChildCount = -1;
const assignLayer = (root: Group) => {
  // Layers are per-object (not inherited), so tag the whole subtree.
  root.traverse((o) => o.layers.set(SETPIECE_LAYER));
  layeredChildCount = root.children.length;
};

const { onRender } = useLoop();
onRender(() => {
  const root = setPiecesRoot.value;
  const gl = renderer.instance;
  const cam = camera.activeCamera.value;
  const scn = scene.value;
  if (!root || !gl || !cam || !scn) return;

  if (root.children.length !== layeredChildCount) assignLayer(root);

  // Composite the crisp set-pieces over the ASCII'd scene the composer just drew
  // to the canvas: aim the camera at the set-piece layer only, keep the existing
  // colour buffer (autoClear=false), clear depth so no line is clipped by stale
  // depth, draw, then restore the camera/renderer so the next composer frame
  // renders the ASCII'd scene (layer 0) exactly as before.
  const prevAutoClear = gl.autoClear;
  const prevBackground = scn.background;
  gl.autoClear = false;
  scn.background = null;
  cam.layers.set(SETPIECE_LAYER);
  gl.clearDepth();
  gl.render(scn, cam);
  cam.layers.set(0);
  scn.background = prevBackground;
  gl.autoClear = prevAutoClear;
});
</script>

<template>
  <TresGroup ref="setPiecesRoot">
    <!-- Wrapper carries the per-piece fit scale (composes with the component's
         own reveal-driven scale); the component still positions itself via the
         :position prop. -->
    <TresGroup
      v-for="piece in pieces"
      :key="piece.key"
      :scale="[piece.scale, piece.scale, piece.scale]"
    >
      <component
        :is="piece.component"
        :reveal="revealOf(piece)"
        :variant="piece.variant"
        :position="piece.position"
      />
    </TresGroup>
  </TresGroup>
</template>
