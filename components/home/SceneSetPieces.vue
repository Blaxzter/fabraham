<script setup lang="ts">
import { computed, shallowRef, onBeforeUnmount } from "vue";
import type { Component } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import { MeshBasicMaterial } from "three";
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
 * and barely read (the Berlin skyline was effectively invisible). We render them
 * selectively instead: set-pieces live on dedicated layers the composer's
 * RenderPass (camera on layer 0) never sees, so only the head/backdrop get
 * ASCII'd. Then, in the same TresJS render loop (`onRender` fires right after
 * the composer), we re-draw the set-pieces crisp on top:
 *
 *   1. on-top backdrops (skyline, route arc, …) draw over the ASCII'd head;
 *   2. the head is stamped into the depth buffer (depth only);
 *   3. the graph cloud (lattice) draws depth-tested against that, so the head
 *      occludes its back half — the face sits *inside* the graph.
 *
 * Lines stay sharp and fully 3D/camera-coupled. No second rAF, no per-frame
 * layout reads, nothing allocated per frame (issue #4).
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

// Pieces that should be DEPTH-OCCLUDED by the head (the head hides their back
// half, so the face sits inside them). The lattice is a 3D cloud that wraps the
// head; the rest are flat backdrops that read best drawn fully on top (otherwise
// the close-up beats would hide them behind the head).
const OCCLUDED_PIECES = new Set(["lattice"]);

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
        occluded: OCCLUDED_PIECES.has(name),
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
              occluded: OCCLUDED_PIECES.has(name),
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
// Render layers. The composer's ASCII RenderPass uses the camera on layer 0, so
// anything NOT on layer 0 is excluded from the ASCII'd image and instead drawn
// crisp in the overlay below.
//   1 = set-pieces drawn on top (flat backdrops: skyline, staff lines, …)
//   3 = set-pieces depth-occluded by the head (the graph cloud → head inside it)
//   2 = the head, used as a depth-only occluder (tagged in Scene3D.vue)
const SETPIECE_LAYER = 1;
const OCCLUDED_LAYER = 3;
const HEAD_LAYER = 2;

// Writes depth only (no colour): used to stamp the head's silhouette into the
// depth buffer so the occluded set-pieces test against it.
const depthOnlyMat = new MeshBasicMaterial({ colorWrite: false });

const { scene, camera, renderer } = useTresContext();
const setPiecesRoot = shallowRef<Group | null>(null);

const { onRender } = useLoop();
onRender(() => {
  const root = setPiecesRoot.value;
  const gl = renderer.instance;
  const cam = camera.activeCamera.value;
  const scn = scene.value;
  if (!root || !gl || !cam || !scn) return;

  // Tag each piece's subtree onto its layer (1 = on-top, 3 = occluded). Layers
  // are per-object (not inherited) and some pieces add geometry asynchronously
  // (e.g. the SVG skyline mounts its lines after a fetch), so we re-tag every
  // frame — idempotent, a handful of objects, no allocation/layout read (stays
  // within the issue #4 budget). Children render in `pieces` order; if that ever
  // doesn't line up, fall back to tagging everything on-top.
  const kids = root.children;
  const ps = pieces.value;
  if (kids.length === ps.length) {
    for (let i = 0; i < kids.length; i++) {
      kids[i]!.traverse((o) =>
        o.layers.set(ps[i]!.occluded ? OCCLUDED_LAYER : SETPIECE_LAYER)
      );
    }
  } else {
    root.traverse((o) => o.layers.set(SETPIECE_LAYER));
  }

  // Composite the crisp set-pieces over the ASCII'd scene the composer just drew
  // to the canvas. Keep the existing colour buffer (autoClear=false) and clear
  // depth so nothing is clipped by stale depth.
  const prevAutoClear = gl.autoClear;
  const prevBackground = scn.background;
  const prevOverride = scn.overrideMaterial;
  gl.autoClear = false;
  scn.background = null;
  gl.clearDepth();

  // 1) On-top backdrops (no occluder yet → all visible over the head).
  cam.layers.set(SETPIECE_LAYER);
  gl.render(scn, cam);

  // 2) Stamp the head into the depth buffer (depth only, no colour).
  cam.layers.set(HEAD_LAYER);
  scn.overrideMaterial = depthOnlyMat;
  gl.render(scn, cam);
  scn.overrideMaterial = prevOverride;

  // 3) Occluded pieces (the graph): depth-tested against the head, so the head
  //    hides the back of the cloud and the face reads as being *inside* it.
  cam.layers.set(OCCLUDED_LAYER);
  gl.render(scn, cam);

  cam.layers.set(0);
  scn.background = prevBackground;
  gl.autoClear = prevAutoClear;
});

onBeforeUnmount(() => {
  depthOnlyMat.dispose();
});
</script>

<template>
  <TresGroup ref="setPiecesRoot">
    <component
      :is="piece.component"
      v-for="piece in pieces"
      :key="piece.key"
      :reveal="revealOf(piece)"
      :variant="piece.variant"
      :position="piece.position"
    />
  </TresGroup>
</template>
