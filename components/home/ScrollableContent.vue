<script setup lang="ts">
import { computed } from "vue";
import AsciiTextAnimation from "./AsciiTextAnimation.vue";
import Chapter from "./Chapter.vue";
import ScrollIndicator from "./utils/ScrollIndicator.vue";

// One source of truth for the whole scroll experience.
const timeline = useTimelineStore();
const { docs } = useTimelineChapters();

// Owns Lenis + the single ScrollTrigger that writes `timeline.progress`,
// plus its teardown (replaces the old in-store rAF loop, issue #4).
useScrollTimeline();

// Chapter 0 (identity) is the ASCII hero; the rest are prose cards.
const heroDoc = computed(() => docs.value[0]);
const heroWeight = computed(
  () => (heroDoc.value as { weight?: number } | undefined)?.weight ?? 2
);
const heroHeight = computed(() => `${heroWeight.value * 100}vh`);
const restDocs = computed(() => docs.value.slice(1));
</script>

<template>
  <!-- Hero: the ASCII identity assembles across the first chapter's scroll range. -->
  <section class="relative z-10" :style="{ height: heroHeight }">
    <!-- Real identity text (H1 + intro) for screen readers and crawlers; the
         ASCII hero is the visual treatment of the same content. Keeps the
         authored 00-identity.md body live and SSG-ready (#5). -->
    <div class="sr-only">
      <ContentRenderer v-if="heroDoc" :value="heroDoc" />
    </div>
    <AsciiTextAnimation :scroll-progress="timeline.heroProgress" />
  </section>

  <!-- Data-driven biographical chapters. Add a milestone = add a markdown file. -->
  <div class="relative z-10">
    <Chapter
      v-for="(doc, i) in restDocs"
      :key="doc.path ?? i"
      :doc="doc"
      :index="i + 1"
    />
  </div>

  <ScrollIndicator
    :scroll-progress="timeline.heroProgress"
    :fade-out-threshold="0.05"
  />
</template>
