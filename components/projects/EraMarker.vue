<script setup lang="ts">
import type { Era } from "./eras";

// A moment on the line, not a heading above a group: the marker sits at its own
// date, and the era it opens runs UPWARD from it (forward in time) to the next
// marker — which is why the pill reads "from …".
defineProps<{ era: Era }>();
</script>

<template>
  <div class="era-inner" :style="{ '--era': era.accent }">
    <span class="era-when">{{ era.when }}</span>
    <h2>{{ era.title }}</h2>
    <p class="era-place">{{ era.place }}</p>
    <p class="era-note">{{ era.note }}</p>
  </div>
</template>

<style scoped>
.era-inner {
  display: flex;
  flex-direction: column;
  align-items: inherit;
  text-align: inherit;
  gap: 0;
}
.era-inner > * { max-width: 46ch; }

.era-when {
  align-self: flex-start;
  font-family: var(--vp-mono);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--era);
  padding: 0.28rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--era) 34%, transparent);
  border-radius: 100px;
  background: color-mix(in srgb, var(--era) 9%, var(--vp-ground));
}
h2 {
  margin: 0.7rem 0 0.25rem;
  font-size: clamp(1.25rem, 3vw, 1.7rem);
  font-weight: 800;
  letter-spacing: -0.015em;
  text-wrap: balance;
  color: var(--vp-ink);
}
.era-place { margin: 0; font-family: var(--vp-mono); font-size: 0.75rem; color: var(--era); opacity: 0.85; }
.era-note { margin: 0.55rem 0 0; font-size: 0.86rem; color: var(--vp-muted); text-wrap: balance; }
</style>
