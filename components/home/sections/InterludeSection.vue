<script setup lang="ts">
import type { Section } from "~/types/section";

// An "interlude" is a beat with no content card — just a camera move and whatever
// background 3D set-pieces bloom. Renders at most a faint eyebrow label. Also the
// dispatcher fallback for not-yet-implemented section types.
defineProps<{ section: Section; doc?: unknown; visible?: boolean }>();
</script>

<template>
  <p v-if="section.subtitle" class="interlude-eyebrow">{{ section.subtitle }}</p>
</template>

<style scoped>
.interlude-eyebrow {
  font-family: "Courier New", monospace;
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent, #00ff9c);
  opacity: 0.5;
  text-align: center;
}
</style>
