<script setup lang="ts">
import { computed } from "vue";
import type { Section } from "~/types/section";

// The hero section (mode "bare"), which is now half of a two-part treatment.
//
// The NAME lives in the 3D scene (`HeroGlyphs` + `HeroAscii`): one quad per
// character on its own layer, composited by the ASCII pass at its own cell size.
// This file owns the other half — the `fullest-stack` entry and its definition —
// and they stay in the DOM on purpose, for two reasons that both matter:
//
//   1. They are PROSE. Re-sampling a definition onto a character grid turns it
//      into mush at any cell size still coarse enough to read as ASCII. The name
//      survives that treatment because it is eight big letters; a sentence does
//      not.
//   2. The scene is pixels in a canvas. This block and the `sr-only` one below
//      are the only text on the page a crawler or a screen reader can read.
//
// Revealed off `heroProgress` so it arrives after the name has assembled and
// leaves with it — the same windows `HeroGlyphs` uses, one beat later.
const props = defineProps<{ section?: Section; visible?: boolean }>();

const store = useSectionsStore();

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

/** The entry lands just after the name settles (`assembleAt` ≈ 0.42). */
const entryIn = computed(() => smooth(clamp01((store.heroProgress - 0.44) / 0.2)));
/** The definition follows it, so the word arrives before its meaning. */
const defIn = computed(() => smooth(clamp01((store.heroProgress - 0.58) / 0.26)));
/** Leaves with the name (`exitAt` = 0.86). */
const out = computed(() => clamp01((store.heroProgress - 0.86) / 0.14));

const accent = computed(() => props.section?.accent ?? "#00ff9c");

// ---------------------------------------------------------------------------
// Tunables — dev panel → scenes tab → "identity" → "Hero entry", saved to
// tuning.config.json by the panel's "save to config file".
//
// Unlike every other tuning group on this page this one is DOM, not scene
// geometry, so the values land as CSS custom properties on the block rather than
// as numbers read in a render loop. What they all are is TYPE SIZE — and type
// size is the one thing in this treatment that cannot be settled from a source
// file. The headword is long, the transcription is set beside it, the whole
// thing is laid over a moving canvas, and whether the line still reads depends
// on the frame it lands in. So it gets knobs instead of a guess.
// ---------------------------------------------------------------------------
const tune = useTuning("heroEntry", "Hero entry", "identity");

/**
 * The headword's size, as the three parts of its `clamp()`: the floor a phone
 * gets, the rate it grows with the viewport, and the ceiling it stops at.
 *
 * Everything else in the entry is a MULTIPLE of whatever this resolves to, so
 * this is the single lever for the block's weight — move it and the
 * transcription, the part of speech and the definition all follow, in
 * proportion. Reach for this before any of the three below.
 */
const sizeMin = tune.num("sizeMin", 1.3, { min: 0.6, max: 3, step: 0.05, label: "Headword — smallest (rem)" });
const sizeVw = tune.num("sizeVw", 3, { min: 0.5, max: 8, step: 0.1, label: "Headword — growth (vw)" });
const sizeMax = tune.num("sizeMax", 2.4, { min: 0.8, max: 5, step: 0.05, label: "Headword — largest (rem)" });

/** The rest of the entry, relative to the headword. 1 is "the same size as the
 *  headword", which is where the transcription and the definition now sit. */
const pronScale = tune.num("pronScale", 1, { min: 0.3, max: 1.6, step: 0.01, label: "Transcription — × headword" });
const posScale = tune.num("posScale", 0.62, { min: 0.3, max: 1.6, step: 0.01, label: "adj. — × headword" });
const defScale = tune.num("defScale", 1, { min: 0.3, max: 1.6, step: 0.01, label: "Definition — × headword" });
/**
 * The definition's measure, in CHARACTERS.
 *
 * `ch` against a monospace face is exactly one character, so this is a line
 * length that holds at any type size — which is what you want from a measure,
 * and also what makes it the knob to reach for after `defScale`: matching the
 * definition to the headword's size makes the same 46 characters a much wider
 * block, and this is where you buy that back.
 */
const defMeasure = tune.num("defMeasure", 46, { min: 16, max: 90, step: 1, label: "Definition — line length (chars)" });

/** The knobs, as the custom properties the styles below are written against. */
const entryVars = computed(() => ({
  "--accent": accent.value,
  "--hw-size": `clamp(${sizeMin.value}rem, ${sizeVw.value}vw, ${sizeMax.value}rem)`,
  "--hw-pron": String(pronScale.value),
  "--hw-pos": String(posScale.value),
  "--hd-size": String(defScale.value),
  "--hd-measure": `${defMeasure.value}ch`,
}));

const entryStyle = computed(() => ({
  opacity: entryIn.value * (1 - out.value),
  transform: `translateY(${(1 - entryIn.value) * 12 - out.value * 40}px)`,
}));
const defStyle = computed(() => ({
  opacity: defIn.value * (1 - out.value),
  transform: `translateY(${(1 - defIn.value) * 12 - out.value * 40}px)`,
}));
</script>

<template>
  <!-- Accessible / crawlable identity. The name is canvas pixels, so this is the
       only copy of it on the page — if it drifts from the scene, the site is
       wrong. -->
  <div class="sr-only">
    <h1>Frederic Abraham</h1>
    <p>
      Senior fullest-stack developer in Berlin. I build systems that have to hold
      up under real load, and I bet on semantic AI early — generative models, then
      embeddings, now retrieval. Scroll to follow the path: Berlin → Maastricht →
      Berlin.
    </p>
  </div>

  <!-- The entry, under the name the scene is assembling above it. -->
  <div class="hero-entry" :style="entryVars" aria-hidden="false">
    <!-- One line, in the shape a dictionary gives a compound: the coinage, its
         transcription, then the noun it attaches to. The NOUN is the point —
         "fullest-stack" on its own is an adjective, and an adjective never says
         what the job is, which on a hero screen where the name itself is canvas
         geometry leaves the page with nothing on it that does.
         `adj.` sits between the two halves rather than at the end, where it
         reads as what it is — a note on the word to its left, not on the phrase.
         The line is allowed to run wider than the definition's measure to stay
         on one line (see `.hero-entry`), and the transcription never breaks. -->
    <p class="he-headword" :style="entryStyle">
      <span class="hw-word">fullest-stack</span>
      <span class="hw-pron">/ˈfʊl.ɪst stak/</span>
      <span class="hw-pos">adj.</span>
      <span class="hw-word hw-noun">developer</span>
    </p>
    <p class="he-def" :style="defStyle">
      all the way down — the model, the retrieval, the migration, and the Monday
      morning after the release.
    </p>
  </div>
</template>

<style scoped>
/* Fixed, like the hero treatment it belongs to: the section itself is only a
   height spacer (mode "bare"), and this has to hold its place against the canvas
   rather than scroll with the page. */
.hero-entry {
  position: fixed;
  left: clamp(20px, 7vw, 132px);
  top: 58%;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.4vw, 20px);
  /* Two different measures, which is why the cap here is only "stay on screen".
     The DEFINITION is prose and wants a measure in characters (`defMeasure`);
     the HEADWORD line is a dictionary entry and wants to stay on ONE line, which
     with the noun and the transcription on it is ~26em — far past any measure
     prose should be set at. One max-width for both meant the headword broke, and
     it broke inside the transcription. So the block is capped at the frame it
     has, `.he-def` keeps the prose measure, and `align-items` lets each line take
     only the width it needs. */
  align-items: flex-start;
  max-width: calc(100vw - 2 * clamp(20px, 7vw, 132px));
  font-family: "Courier New", ui-monospace, monospace;
  pointer-events: none;
  /* The reveal is driven per-element from heroProgress; the transition only
     smooths the gap between scroll ticks. */
  will-change: opacity, transform;
}

.he-headword {
  margin: 0;
  font-size: var(--hw-size);
  line-height: 1.25;
  letter-spacing: 0.01em;
  /* One line. A dictionary entry that wraps between its headword and its
     transcription stops looking like an entry and starts looking like a
     paragraph that begins with a bold word. Lifted on a phone, below. */
  white-space: nowrap;
  transition: opacity 120ms linear, transform 120ms linear;
}

/* Both halves of the term, so it reads as ONE thing with the transcription set
   into the middle of it rather than as a green word followed by a grey one. */
.hw-word {
  color: var(--accent);
  font-weight: 700;
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 45%, transparent);
}

/* The template's own newline between the spans is not a space — Vue condenses
   whitespace-only text nodes that contain one — so every gap on this line is a
   margin. */
.hw-noun {
  margin-left: 0.6em;
}

/* Blue, italic and smaller: a grammatical note set apart from the term it
   annotates, which is the only way it reads as an aside rather than as a third
   word of the phrase it is sitting inside. */
.hw-pos {
  margin-left: 0.45em;
  color: #7fe7ff;
  font-style: italic;
  font-size: calc(1em * var(--hw-pos));
}

/* Behind the headword, at whatever `pronScale` says relative to it (1 — the
   same size — by default). Kept `nowrap` even where the line above is allowed
   to wrap: the transcription has a SPACE in it (`/ˈfʊl.ɪst stak/` is two
   syllable groups), which is a legal break the browser will happily take, and a
   transcription broken across two lines is not a transcription. When there is
   genuinely no room it comes down whole instead. */
.hw-pron {
  white-space: nowrap;
  margin-left: 0.6em;
  font-size: calc(1em * var(--hw-pron));
  letter-spacing: 0.02em;
  color: #7d99a6;
}

.he-def {
  margin: 0;
  /* The prose measure, held here rather than on the block — see `.hero-entry`.
     In `ch`, so it stays the same number of CHARACTERS however the size below
     is retuned. */
  max-width: min(var(--hd-measure), 82vw);
  padding-left: clamp(12px, 1.4vw, 22px);
  border-left: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  /* Off the headword, not its own clamp: the two are meant to be read as one
     entry, and two independent curves drift apart at viewport sizes neither was
     tuned at. */
  font-size: calc(var(--hw-size) * var(--hd-size));
  line-height: 1.65;
  color: color-mix(in srgb, #dfe9ee 80%, transparent);
  transition: opacity 120ms linear, transform 120ms linear;
}

/* On a phone the head fills the frame and there is no room beside it, so the
   entry drops to the bottom and runs the full width. */
@media (max-width: 640px) {
  .hero-entry {
    left: 20px;
    right: 20px;
    top: auto;
    bottom: 12vh;
    max-width: none;
  }

  /* One line is a nicety; fitting on the screen is not. Below this width the
     entry is allowed to wrap after the headword — which is a break between two
     whole units, not the one through the middle of the transcription that
     `.hw-pron` is still holding shut. */
  .he-headword {
    white-space: normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .he-headword,
  .he-def {
    transition: none;
  }
}
</style>
