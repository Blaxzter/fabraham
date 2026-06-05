<script setup lang="ts">
import { ref, computed } from "vue";
import { useElementVisibility } from "@vueuse/core";

/**
 * Renders one timeline chapter's prose as a centered, sticky card over the 3D
 * scene. The markdown body is rendered with `<ContentRenderer>` so it stays real,
 * indexable HTML for SSG (#5). Height scales with the chapter `weight`, which is
 * the same value that drives the camera segment width — one source of truth.
 */
interface ChapterDoc {
  path?: string;
  title?: string;
  subtitle?: string;
  location?: string;
  weight?: number;
  accent?: string;
}

const props = defineProps<{
  doc: ChapterDoc;
  index: number;
}>();

const sectionRef = ref<HTMLElement | null>(null);
const isVisible = useElementVisibility(sectionRef, { threshold: 0.4 });

const minHeight = computed(() => `${(props.doc.weight ?? 1) * 100}vh`);
const accent = computed(() => props.doc.accent ?? "#00ff9c");
</script>

<template>
  <section
    ref="sectionRef"
    class="chapter"
    :style="{ minHeight, '--accent': accent }"
  >
    <div class="chapter-sticky">
      <article class="chapter-card" :class="{ 'is-visible': isVisible }">
        <p v-if="doc.location" class="chapter-location">{{ doc.location }}</p>
        <p v-if="doc.subtitle" class="chapter-eyebrow">{{ doc.subtitle }}</p>
        <div class="chapter-prose">
          <ContentRenderer :value="doc" />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.chapter {
  position: relative;
}

.chapter-sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.chapter-card {
  max-width: 36rem;
  margin: 0 1.5rem;
  padding: 2rem 2.25rem;
  border-radius: 0.75rem;
  border-left: 3px solid var(--accent, #00ff9c);
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  color: #fff;
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.6s ease, transform 0.6s ease;
  pointer-events: auto;
}

.chapter-card.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.chapter-location {
  font-family: "Courier New", monospace;
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent, #00ff9c);
  margin: 0 0 0.5rem;
}

.chapter-eyebrow {
  font-size: 0.9rem;
  opacity: 0.7;
  margin: 0 0 0.75rem;
}

.chapter-prose :deep(h2) {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  line-height: 1.15;
}

.chapter-prose :deep(h1) {
  font-size: 1.9rem;
  font-weight: 800;
  margin: 0 0 0.75rem;
}

.chapter-prose :deep(p) {
  font-size: 1.02rem;
  line-height: 1.6;
  opacity: 0.88;
  margin: 0 0 0.85rem;
}

.chapter-prose :deep(p:last-child) {
  margin-bottom: 0;
}

.chapter-prose :deep(strong) {
  color: var(--accent, #00ff9c);
  font-weight: 700;
}

@media (max-width: 640px) {
  .chapter-card {
    padding: 1.5rem 1.5rem;
  }
  .chapter-prose :deep(h2) {
    font-size: 1.35rem;
  }
}
</style>
