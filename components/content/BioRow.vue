<script setup lang="ts">
/**
 * One entry on a biography card's timeline:
 *
 *   ::bio-row{when="2017–2020" kind="work" name="GT-ARC" href="https://gt-arc.com" role="Student developer"}
 *   Any amount of markdown: a line, a paragraph, or nothing at all.
 *   ::
 *
 * The card is a short timeline (dot + rail per entry), so study and work sit in
 * the same shape and read as one sequence. `kind` gives the entry its tag
 * (outlined for study / volunteer, filled for work); `name` is the place, as a
 * link when `href` is set; `role` is what Frederic was there.
 */
import BioKind from "~/components/home/sections/BioKind.vue";
import type { BioKindName } from "~/components/home/sections/BioKind.vue";

defineProps<{
  when?: string;
  kind?: BioKindName;
  name: string;
  href?: string;
  role?: string;
}>();
</script>

<template>
  <div class="bio-row">
    <span class="dot" aria-hidden="true" />
    <div v-if="when || kind" class="meta">
      <span v-if="when" class="when">{{ when }}</span>
      <BioKind v-if="kind" :kind="kind" />
    </div>
    <div class="who">
      <a v-if="href" :href="href" target="_blank" rel="noopener" class="name">{{ name }}</a>
      <span v-else class="name">{{ name }}</span>
      <span v-if="role" class="role">{{ role }}</span>
    </div>
    <div v-if="$slots.default" class="body"><slot /></div>
  </div>
</template>

<style scoped>
.bio-row {
  position: relative;
  padding: 0 0 1rem 1.1rem;
  border-left: 1px solid color-mix(in srgb, var(--accent, #00ff9c) 35%, transparent);
}
.bio-row:last-child {
  padding-bottom: 0;
}
.dot {
  position: absolute;
  left: -5px;
  top: 0.3rem;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent, #00ff9c);
}
.meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}
.when {
  font-family: "Courier New", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  opacity: 0.7;
}
.who {
  margin: 0.3rem 0 0;
  line-height: 1.3;
}
.name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}
a.name {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent, #00ff9c) 60%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.2em;
}
a.name:hover,
a.name:focus-visible {
  text-decoration-color: var(--accent, #00ff9c);
}
.role {
  margin-left: 0.45rem;
  font-size: 0.8rem;
  opacity: 0.65;
}
.body {
  margin-top: 0.25rem;
}
</style>
