<script setup lang="ts">
import { computed } from "vue";
import AsciiTextAnimation from "./AsciiTextAnimation.vue";
import SectionHost from "./SectionHost.vue";
import ScrollIndicator from "./utils/ScrollIndicator.vue";

// One source of truth for the whole scroll experience.
const store = useSectionsStore();
const { docs, sections } = useSections();

// Owns Lenis + the single ScrollTrigger that writes `store.progress`,
// plus its teardown (replaces the old in-store rAF loop, issue #4).
useScrollTimeline();

// Section 0 (identity) is the ASCII hero; the rest dispatch by type.
const heroDoc = computed(() => docs.value[0]);
const heroHeight = computed(() => `${(sections.value[0]?.weight ?? 2) * 100}vh`);

const rest = computed(() =>
  sections.value.slice(1).map((section, i) => ({
    section,
    doc: docs.value[i + 1],
    index: i + 1,
  }))
);
</script>

<template>
  <!-- Hero: the ASCII identity assembles across the first section's scroll range. -->
  <section class="relative z-10" :style="{ height: heroHeight }">
    <!-- Real identity text (H1 + intro) for screen readers and crawlers; the
         ASCII hero is the visual treatment of the same content. -->
    <div class="sr-only">
      <ContentRenderer v-if="heroDoc" :value="heroDoc" />
    </div>
    <AsciiTextAnimation :scroll-progress="store.heroProgress" />
  </section>

  <!-- Data-driven peer sections (biography cluster, contact, …). -->
  <div class="relative z-10">
    <SectionHost
      v-for="item in rest"
      :key="item.section.id"
      :section="item.section"
      :doc="item.doc"
      :index="item.index"
    />
  </div>

  <ScrollIndicator
    :scroll-progress="store.heroProgress"
    :fade-out-threshold="0.05"
  />
</template>
