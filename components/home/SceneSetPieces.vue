<script setup lang="ts">
import { computed, shallowRef, onBeforeUnmount, watchEffect } from "vue";
import type { Component } from "vue";
import { useLoop, useTresContext } from "@tresjs/core";
import { MeshBasicMaterial } from "three";
import type { Group } from "three";
import { bioMilestoneCenter, bioMilestonePieceHalfWindow } from "~/stores/sections";
import Lattice from "./setpieces/Lattice.vue";
import BerlinSkyline from "./setpieces/BerlinSkyline.vue";
import RouteArc from "./setpieces/RouteArc.vue";
import ThreadBoard from "./setpieces/ThreadBoard.vue";
import DocumentGrid from "./setpieces/DocumentGrid.vue";
import StaffLines from "./setpieces/StaffLines.vue";
import SignalField from "./setpieces/SignalField.vue";
import StackFlight from "./setpieces/StackFlight.vue";

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
 *   1. on-top backdrops (route arc, thread-board, …) draw over the ASCII'd head;
 *   2. the head is stamped into the depth buffer (depth only);
 *   3. depth-occluded pieces (the graph cloud, the stack flight, the Berlin
 *      skyline) draw depth-tested against that, so the head hides whatever sits
 *      behind it — the face reads *inside* the graph, *in front of* the horizon.
 *
 * Lines stay sharp and fully 3D/camera-coupled. No second rAF, no per-frame
 * layout reads, nothing allocated per frame (issue #4).
 *
 * Each piece gets `reveal` (the bloom) and, if it opts in by name, `cardProgress`
 * — its beat's raw local travel, for entrances that need the whole window rather
 * than the reveal ramp (see `cardProgressOf`).
 */
const store = useSectionsStore();
useSections();
const { milestones } = useBiographyMilestones();

// Keep the store's milestone count current so milestone-anchored keyframes
// (camera + spotlights) resolve against the live biography cards.
watchEffect(() => store.setMilestoneCount(milestones.value.length));

const SET_PIECES: Partial<Record<string, Component>> = {
  lattice: Lattice,
  berlinSkyline: BerlinSkyline,
  routeArc: RouteArc,
  threadBoard: ThreadBoard,
  documentGrid: DocumentGrid,
  staffLines: StaffLines,
  signalField: SignalField,
  stackFlight: StackFlight,
};

// Pieces that should be DEPTH-OCCLUDED by the head (the head hides whatever of
// them sits behind it, so the face stays readable and the piece reads as being
// *in the scene* rather than pasted over it). The lattice is a 3D cloud that
// wraps the head, the stack flight streams past and behind it, and the Berlin
// skyline is a horizon the head rises above.
//
// The remaining flat backdrops still draw fully on top, for the original reason:
// they play during CLOSE-UP beats where the head fills the frame and would
// simply hide them. That caveat does NOT apply to the skyline — the biography
// camera sits back at z≈1.3, which leaves room for a piece placed low and pushed
// back (see BerlinSkyline's HORIZON default).
const OCCLUDED_PIECES = new Set(["lattice", "stackFlight", "berlinSkyline"]);

// Keep the primary piece centered on the head; push stacked pieces aside and
// BACK so two set-pieces in one beat read as distinct motifs, not one tangled
// mass.
//
// Mind the frame these numbers live in. At the biography camera (z ≈ 1.3) the
// visible world is only about 1.9 x 1.1 units across, so the old sideways shove
// of 1.4 put a stacked piece's CENTRE past the right edge — fine when the
// stacked pieces were sparse dot fields reading as "a field continuing offscreen",
// wrong now that they are legible objects (a pinboard, a document shelf) you are
// meant to be able to look at. Most of the offset is now depth: pushing a piece
// back widens the frame it is composed into, which buys more room than sliding
// it sideways ever did, and it sits behind the head where a backdrop belongs.
const SLOT_OFFSETS: [number, number, number][] = [
  [0, 0, 0],
  [0.45, 0.06, -0.55],
  [-0.45, 0.06, -0.55],
];
const offsetFor = (slot: number): [number, number, number] =>
  SLOT_OFFSETS[Math.min(slot, SLOT_OFFSETS.length - 1)]!;

// Set-pieces that also want their beat's RAW LOCAL PROGRESS, not just `reveal`
// (see `cardProgressOf` below). Opt-in by name so every other set-piece keeps
// exactly the props it had — nothing extra is bound to a component that hasn't
// declared it.
//
// Every milestone backdrop is now in here: each one ASSEMBLES over its card's
// scroll (draws its own lines on, in an order chosen at build time) rather than
// blooming in fully formed, which also means scrolling back up un-draws it. The
// skills chapter's `stackFlight` is the exception — it already rides the skills
// chapter's own travel formula (sections/skills.ts), so it needs nothing here.
const PROGRESS_DRIVEN = new Set([
  "berlinSkyline",
  "routeArc",
  "lattice",
  "threadBoard",
  "documentGrid",
  "staffLines",
]);

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
        sectionId: section.id,
        subIndex: 0,
        subCount: 1,
        variant: section.setPieceVariant,
        position: offsetFor(slot),
        occluded: OCCLUDED_PIECES.has(name),
        progressDriven: PROGRESS_DRIVEN.has(name),
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
              sectionId: store.sections[bi]?.id ?? "",
              subIndex: j,
              subCount: count,
              variant: m.setPieceVariant,
              position: offsetFor(slot),
              occluded: OCCLUDED_PIECES.has(name),
              progressDriven: PROGRESS_DRIVEN.has(name),
              component: SET_PIECES[name],
            }))
            .filter((p) => p.component)
        );

  return [...sectionPieces, ...milestonePieces];
});

type Piece = (typeof pieces.value)[number];

const revealOf = (p: Piece) =>
  p.kind === "milestone"
    ? store.subReveal(p.index, p.subIndex, p.subCount)
    : store.revealFor(p.index);

// --- Card-local progress (the slow lane) --------------------------------------
// `reveal` is a BLOOM: `subReveal` ramps it over only REVEAL_FADE (0.25) of the
// beat's window, holds, then ramps back out. A set-piece that drives an entrance
// off it therefore assembles in a quarter of its card's scroll — one notch of a
// mouse wheel — and reads as a flicker rather than an animation. (The skills
// backdrop hit exactly this, and fixed it by driving its draw-on off the card's
// real travel instead — see StackFlight.)
//
// So we also hand progress-driven pieces their beat's RAW local travel: 0 as the
// beat's window opens → 1 as it closes, unshaped. It spans the same window
// `reveal` fades over, so `reveal` still owns the fade in/out while the piece
// spends the *whole* window assembling.
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const cardProgressOf = (p: Piece) => {
  if (p.kind !== "milestone") {
    // Section-level pieces: their beat IS the section (0.5 outside it, which is
    // moot — `reveal` has them hidden there anyway).
    return store.localFracAt(p.sectionId, store.progress);
  }
  // Same window `subReveal` uses, so the two can never drift: centred on the
  // milestone card's own position, ± its half-window. That is the PIECE window
  // (BIO_PIECE_SPAN), which is deliberately wider than the one milestone-pinned
  // keyframes are anchored across — see stores/sections.ts.
  const bs = store.boundaries;
  const start = bs[p.index] ?? 0;
  const range = (bs[p.index + 1] ?? 1) - start || 1;
  const center = start + bioMilestoneCenter(p.subIndex, p.subCount) * range;
  const half = (bioMilestonePieceHalfWindow(p.subCount) || 0.0001) * range;
  return clamp01((store.progress - (center - half)) / (2 * half));
};

// Bound with `v-bind` rather than as a plain attribute so the prop only ever
// reaches components that declare it — a stray `card-progress` falling through
// to a set-piece's root `<TresGroup>` would be patched onto the Object3D.
const NO_EXTRA = Object.freeze({});
const extraPropsOf = (p: Piece) =>
  p.progressDriven ? { cardProgress: cardProgressOf(p) } : NO_EXTRA;

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
      v-bind="extraPropsOf(piece)"
    />
  </TresGroup>
</template>
