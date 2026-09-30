<script setup lang="ts">
/**
 * A job held alongside a degree, inside a biography card:
 *
 *   ::bio-work{when="2017–2020"}
 *   Student developer at **GT-ARC** …
 *   ::
 *
 * The study cards (Berlin, Maastricht) each carry a part-time job, and without
 * this the two ran together as one paragraph. The block wears the same filled
 * "Work" chip a whole work card wears in its header, so the chip is the one
 * visual code for "this was a job" wherever it appears.
 */
import BioKind from "~/components/home/sections/BioKind.vue";

defineProps<{ when?: string }>();
</script>

<template>
  <div class="bio-work">
    <p class="bio-work-head">
      <BioKind kind="work" />
      <span v-if="when" class="bio-work-when">{{ when }}</span>
    </p>
    <slot />
  </div>
</template>

<style scoped>
.bio-work {
  margin: 0.75rem 0 0;
  padding-top: 0.6rem;
  border-top: 1px dashed color-mix(in srgb, var(--accent, #00ff9c) 40%, transparent);
}
.bio-work-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.35rem;
  /* Follows the card: left-hand cards are right-aligned (BiographyCard sets it). */
  justify-content: var(--bio-align, flex-start);
}
.bio-work-when {
  font-family: "Courier New", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  opacity: 0.7;
}
</style>
