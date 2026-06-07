<script setup lang="ts">
import SectionHost from "./SectionHost.vue";
import ScrollIndicator from "./utils/ScrollIndicator.vue";

// One source of truth for the whole scroll experience: the typed section
// registry (via useSections) drives the sequence, scroll length and camera
// spine; each section renders its own dedicated component through SectionHost.
const store = useSectionsStore();
const { defs } = useSections();

// Owns Lenis + the single ScrollTrigger that writes `store.progress`,
// plus its teardown (replaces the old in-store rAF loop, issue #4).
useScrollTimeline();
</script>

<template>
  <!-- Data-driven peer sections (hero → pause → biography → contact). The hero is
       just the first registry entry (a "bare" section whose component owns the
       fixed-overlay ASCII treatment) — no special-case needed. -->
  <div class="relative z-10">
    <SectionHost
      v-for="(def, i) in defs"
      :key="def.id"
      :def="def"
      :index="i"
    />
  </div>

  <ScrollIndicator
    :scroll-progress="store.heroProgress"
    :fade-out-threshold="0.05"
  />
</template>
