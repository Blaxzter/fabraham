<script setup lang="ts">
import { ref } from "vue";
import { useElementVisibility } from "@vueuse/core";
import type { BiographyMilestone } from "~/types/section";

// One milestone in the biography cluster. Owns its own staggered fade-in
// (IntersectionObserver — no rAF). `side` (-1 left, +1 right) decides which way
// it extends from its node on the connector line.
const props = defineProps<{
  doc: unknown;
  milestone: BiographyMilestone;
  side: number;
}>();

const el = ref<HTMLElement | null>(null);
const visible = useElementVisibility(el, { threshold: 0.5 });
</script>

<template>
  <article
    ref="el"
    class="bio-card"
    :class="{ 'is-visible': visible, left: side < 0, right: side >= 0 }"
  >
    <p v-if="milestone.location" class="bio-loc">{{ milestone.location }}</p>
    <p v-if="milestone.subtitle" class="bio-sub">{{ milestone.subtitle }}</p>
    <div class="bio-prose">
      <ContentRenderer v-if="doc" :value="doc" />
    </div>
  </article>
</template>

<style scoped>
.bio-card {
  width: min(22rem, 38vw);
  padding: 1rem 1.2rem;
  border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  color: #fff;
  opacity: 0;
  transition: opacity 0.55s ease, transform 0.55s ease;
}
.bio-card.left {
  border-right: 3px solid var(--accent, #00ff9c);
  text-align: right;
  transform: translateX(-24px);
}
.bio-card.right {
  border-left: 3px solid var(--accent, #00ff9c);
  text-align: left;
  transform: translateX(24px);
}
.bio-card.is-visible {
  opacity: 1;
  transform: translateX(0);
}
.bio-loc {
  font-family: "Courier New", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--accent, #00ff9c);
  margin: 0 0 0.35rem;
}
.bio-sub {
  font-size: 0.82rem;
  opacity: 0.7;
  margin: 0 0 0.5rem;
}
.bio-prose :deep(h2),
.bio-prose :deep(h1) {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  line-height: 1.2;
}
.bio-prose :deep(p) {
  font-size: 0.9rem;
  line-height: 1.5;
  opacity: 0.85;
  margin: 0 0 0.6rem;
}
.bio-prose :deep(p:last-child) {
  margin-bottom: 0;
}
.bio-prose :deep(strong) {
  color: var(--accent, #00ff9c);
  font-weight: 700;
}

@media (max-width: 768px) {
  .bio-card {
    width: min(20rem, 80vw);
    text-align: left;
  }
  .bio-card.left {
    text-align: left;
    border-right: none;
    border-left: 3px solid var(--accent, #00ff9c);
  }
}
</style>
