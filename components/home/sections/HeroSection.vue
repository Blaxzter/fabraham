<script setup lang="ts">
import type { Section } from "~/types/section";
import AsciiTextAnimation from "../AsciiTextAnimation.vue";

// The hero section (mode "bare"): the ASCII identity treatment assembles
// character-by-character across the first section's scroll range. The visible
// name is JS-injected into a fixed overlay (not crawlable), so the same identity
// text is mirrored here as real `sr-only` HTML for screen readers and crawlers
// (SSG-ready for SEO, #5) — replacing the old `content/sections/00-identity.md`
// body that used to feed a hidden <ContentRenderer>.
defineProps<{ section?: Section; visible?: boolean }>();

const store = useSectionsStore();
</script>

<template>
  <!-- Accessible / crawlable identity (the ASCII overlay is the visual treatment
       of the same content). -->
  <div class="sr-only">
    <h1>Frederic Abraham</h1>
    <p>
      Senior fullest-stack developer in Berlin. I build systems that have to hold
      up under real load, and I bet on semantic AI early — generative models, then
      embeddings, now retrieval. Scroll to follow the path: Berlin → Maastricht →
      Berlin.
    </p>
  </div>

  <AsciiTextAnimation :scroll-progress="store.heroProgress" />
</template>
