<script setup lang="ts">
import { computed, reactive, watch, watchEffect } from "vue";
import { ASCIITexture } from "postprocessing";
import { useEffectPmndrs } from "@tresjs/post-processing";
import { DualGridAsciiEffect } from "./hero/DualGridAsciiEffect";
import { glyphTarget } from "./hero/glyphBuffer";

/**
 * The scene's ASCII pass — the same one `ASCIIPmndrs` gave us, plus a second
 * grid for the hero name (see `hero/DualGridAsciiEffect.ts` for the why).
 *
 * Everything about the FACE still comes from the existing pipeline: the charset,
 * font and colour from the SceneControl store (dev panel → ASCII), and the live
 * cell size from `sections.asciiCellSize` → `useScrollTimeline` →
 * `sceneControl.cellSize`. The only thing that moved is where the ramp's
 * ENDPOINTS live: they were module constants in the sections store and are now
 * tunables, so the coarse→fine sweep that reveals the face can be dialled in the
 * panel and saved to `tuning.config.json` like everything else.
 *
 * Mount inside `<EffectComposerPmndrs>` — `useEffectPmndrs` injects the composer
 * from there and owns the pass' lifecycle (add on mount, dispose on unmount).
 */

const store = useSceneControlStore();
const sections = useSectionsStore();

// ---------------------------------------------------------------------------
// Tunables. Two groups, because this pass draws two things on two beats and they
// are tuned in different scenes:
//
//   "Face ASCII grid" → dev panel → scenes → THE FACE (the reveal section)
//   "Hero name grid"  → dev panel → scenes → identity  (the hero)
//
// Splitting them is not tidiness. The face's sweep now belongs to the reveal
// section and the name's grid to the hero, and a slider filed under the wrong
// scene is a slider you go looking for in the scene where its effect is not
// visible.
// ---------------------------------------------------------------------------
const face = useTuning("faceAscii", "Face ASCII grid", "reveal");
const tune = useTuning("heroAscii", "Hero name grid", "identity");

/**
 * The face's grid, as a sweep across the reveal section.
 *
 * This is the site's one real reveal — at the coarse end the head is unreadable
 * blocks, and the scroll is what resolves it into a face — so both ends are
 * art-direction, not constants. Above ~40 the silhouette goes too, which is
 * abstract but stops promising anything; that is the knob to feel out.
 */
const faceCellCoarse = face.num("faceCellCoarse", 45, {
  min: 6,
  max: 80,
  step: 1,
  label: "Face cell — coarse (start)",
});
const faceCellFine = face.num("faceCellFine", 9, {
  min: 2,
  max: 40,
  step: 1,
  label: "Face cell — fine (resolved)",
});

/**
 * WHEN it sweeps, as a window inside the REVEAL section — not the hero.
 *
 * The hero is the name's beat and the face stays coarse across all of it (see
 * `ASCII_RAMP_SECTION` in the sections store). These two are fractions of the
 * section after it, which exists to do this and nothing else.
 *
 * The defaults leave a beat of coarse field at the top — so the section opens on
 * the unreadable version rather than mid-transition — and finish before it ends,
 * so it closes on a resolved face rather than on one still moving. The key light
 * kicks in at t 0.45 (`spotlights.ts`), which lands while the grid is still
 * resolving: the face comes up and the light comes on together.
 */
const faceRampStart = face.num("faceRampStart", 0.05, {
  min: 0,
  max: 0.95,
  step: 0.01,
  label: "Face starts resolving at",
});
const faceRampEnd = face.num("faceRampEnd", 0.5, {
  min: 0.1,
  max: 1,
  step: 0.01,
  label: "Face fully resolved at",
});

/**
 * The name's grid. Constant on purpose: the name is not the puzzle.
 *
 * There is a floor here worth knowing about — below ~4 the cell is smaller than
 * the letterform's own detail and the pass stops being visible at all, i.e. you
 * are paying a shader to draw a letter as itself.
 */
const nameCell = tune.num("nameCell", 6, {
  min: 2,
  max: 24,
  step: 1,
  label: "Name cell",
});

const glyphGain = tune.num("glyphGain", 1.25, {
  min: 0.1,
  max: 3,
  step: 0.05,
  label: "Name brightness over face",
});
const faceDuck = tune.num("faceDuck", 0.85, {
  min: 0,
  max: 1,
  step: 0.01,
  label: "Face duck under name",
});

/**
 * The name's edge, as coverage rather than as a cell boundary.
 *
 * One tap per cell makes "inside the letterform" a yes-or-no question, so a
 * stroke ends on a full-density character and the next cell is empty — a hard,
 * stair-stepped edge that the face (which is a photograph, and shades) never
 * has. The feather mixes each cell with its neighbours, so the edge cells come
 * out part lit and the ramp gives them sparser characters. Small on purpose:
 * this is a soft edge, not a glow, and past ~0.7 the letterform starts losing
 * its own weight to the halo.
 */
const nameFeather = tune.num("nameFeather", 0.5, {
  min: 0,
  max: 1,
  step: 0.01,
  label: "Name edge feather",
});
const nameFeatherSpread = tune.num("nameFeatherSpread", 1, {
  min: 0.25,
  max: 3,
  step: 0.05,
  label: "Name feather — reach (cells)",
});

/**
 * How the name GOES: every cell of it a fleck, drifting off on its own.
 *
 * It used to leave by translating out of frame, which is a title card sliding
 * off — and a strange ending for a name that spent the whole section assembling
 * itself out of scattered characters. Taking it apart on the grid is the same
 * move run backwards, in the grid's own vocabulary: a cell starts drifting,
 * thins through the ramp as it dims (solid character, sparse character, none),
 * and is gone. `HeroGlyphs` owns WHEN (`exitAt`) and publishes it; these three
 * shape what it looks like.
 *
 * - `reach` is how far a fleck travels, in cells. Too far and the ash reads as a
 *   separate cloud that was never the name.
 * - `spread` is the stagger. At 0 every cell goes on the same clock and the name
 *   slides off in formation — the exact thing this replaced.
 * - `rise` trades the seeded scatter for a shared upward drift. All the way over
 *   and the ash goes straight up as a column; all the way back and it bursts.
 */
const nameDissolveReach = tune.num("nameDissolveReach", 12, {
  min: 0,
  max: 40,
  step: 0.5,
  label: "Name exit — fleck travel (cells)",
});
const nameDissolveSpread = tune.num("nameDissolveSpread", 0.7, {
  min: 0,
  max: 1,
  step: 0.01,
  label: "Name exit — stagger",
});
const nameDissolveRise = tune.num("nameDissolveRise", 0.55, {
  min: 0,
  max: 1,
  step: 0.01,
  label: "Name exit — rise vs scatter",
});

// Reduced motion keeps the exit but not the flight: the cells still go out one
// after another, in place. The stagger IS the effect; the drift is the flourish.
const { reducedMotion } = usePreferences();
const dissolveReach = computed(() => (reducedMotion.value ? 0 : nameDissolveReach.value));

// The ramp is evaluated in the sections store (it is a function of scroll, and
// that store owns scroll); only its endpoints are tuned here. One direction, so
// there is still exactly one source of truth for the live cell size.
watchEffect(() => {
  sections.asciiCellStart = faceCellCoarse.value;
  sections.asciiCellEnd = faceCellFine.value;
  sections.asciiRampStart = faceRampStart.value;
  sections.asciiRampEnd = faceRampEnd.value;
});

// ---------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------

/** The character ramp sheet. Rebuilt only when its inputs change — it rasterises
 *  a whole texture, so it must not be rebuilt per frame. */
const makeAsciiTexture = () =>
  new ASCIITexture({
    characters: store.characters,
    font: store.font,
    fontSize: store.fontSize,
    size: store.textureSize,
    cellCount: store.cellCount,
  });

const overrideColor = computed(() => (store.useSceneColor ? null : store.asciiColor));

// What the composer watches to know a re-render is needed.
const deps = reactive({
  cellSize: computed(() => store.cellSize),
  nameCell: computed(() => nameCell.value),
  inverted: computed(() => store.inverted),
  color: overrideColor,
  opacity: computed(() => store.opacity),
  glyphGain: computed(() => glyphGain.value),
  faceDuck: computed(() => faceDuck.value),
  nameFeather: computed(() => nameFeather.value),
  nameFeatherSpread: computed(() => nameFeatherSpread.value),
  nameDissolveReach: dissolveReach,
  nameDissolveSpread: computed(() => nameDissolveSpread.value),
  nameDissolveRise: computed(() => nameDissolveRise.value),
});

const { effect } = useEffectPmndrs(
  () =>
    new DualGridAsciiEffect({
      asciiTexture: makeAsciiTexture(),
      cellSize: store.cellSize,
      glyphCellSize: nameCell.value,
      color: overrideColor.value,
      inverted: store.inverted,
      glyphGain: glyphGain.value,
      faceDuck: faceDuck.value,
      nameFeather: nameFeather.value,
      nameFeatherSpread: nameFeatherSpread.value,
      nameDissolveReach: dissolveReach.value,
      nameDissolveSpread: nameDissolveSpread.value,
      nameDissolveRise: nameDissolveRise.value,
    }),
  deps
);

// Live updates, without recreating the pass. `blendFunction` is how the panel's
// "enable ASCII" switch works (it sets SKIP), so it has to stay reactive.
watchEffect(() => {
  const fx = effect.value;
  if (!fx) return;
  fx.cellSize = store.cellSize;
  fx.glyphCellSize = nameCell.value;
  fx.inverted = store.inverted;
  fx.color = overrideColor.value;
  fx.glyphGain = glyphGain.value;
  fx.faceDuck = faceDuck.value;
  fx.nameFeather = nameFeather.value;
  fx.nameFeatherSpread = nameFeatherSpread.value;
  fx.nameDissolveReach = dissolveReach.value;
  fx.nameDissolveSpread = nameDissolveSpread.value;
  fx.nameDissolveRise = nameDissolveRise.value;
  fx.blendMode.blendFunction = store.effectProps.blendFunction;
  fx.blendMode.opacity.value = store.opacity;
});

// The hero's offscreen buffer appears once HeroGlyphs has mounted and sized it,
// and is replaced on resize. Until then the effect samples its own 1×1 black
// texture and renders exactly like the single-grid effect.
watchEffect(() => {
  const fx = effect.value;
  if (!fx) return;
  fx.glyphBuffer = glyphTarget.value?.texture ?? null;
});

watch(
  () => [store.characters, store.font, store.fontSize, store.textureSize, store.cellCount],
  () => {
    if (effect.value) effect.value.asciiTexture = makeAsciiTexture();
  }
);
</script>

<template>
  <!-- No DOM and no Three object of its own: this component exists to register a
       pass on the composer it is mounted inside. The slot keeps the template
       root valid and renders nothing. -->
  <slot />
</template>
