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
  <div class="hero-entry" :style="{ '--accent': accent }" aria-hidden="false">
    <p class="he-headword" :style="entryStyle">
      <span class="hw-word">fullest-stack</span>
      <span class="hw-pron">/ˈfʊl.ɪst stak/</span>
      <span class="hw-pos">adj.</span>
    </p>
    <p class="he-def" :style="defStyle">
      all the way down: the model, the retrieval, the migration, and the Monday
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
  max-width: min(46ch, 82vw);
  font-family: "Courier New", ui-monospace, monospace;
  pointer-events: none;
  /* The reveal is driven per-element from heroProgress; the transition only
     smooths the gap between scroll ticks. */
  will-change: opacity, transform;
}

.he-headword {
  margin: 0;
  font-size: clamp(1.15rem, 2.6vw, 2.1rem);
  line-height: 1.25;
  letter-spacing: 0.01em;
  transition: opacity 120ms linear, transform 120ms linear;
}

.hw-word {
  color: var(--accent);
  font-weight: 700;
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 45%, transparent);
}

.hw-pron {
  margin-left: 0.6em;
  color: #5c7682;
}

.hw-pos {
  margin-left: 0.45em;
  color: #7fe7ff;
  font-style: italic;
  font-size: 0.82em;
}

.he-def {
  margin: 0;
  padding-left: clamp(12px, 1.4vw, 22px);
  border-left: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  font-size: clamp(0.82rem, 1.35vw, 1.05rem);
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
}

@media (prefers-reduced-motion: reduce) {
  .he-headword,
  .he-def {
    transition: none;
  }
}
</style>
