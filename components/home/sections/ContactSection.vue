<script setup lang="ts">
import type { Section } from "~/types/section";

// A peer "contact" section: the prose body + clear CTA buttons. Pinned/centered
// by SectionHost. The markdown body stays SSG-ready for SEO.
defineProps<{ section: Section; doc: unknown; visible?: boolean }>();
</script>

<template>
  <article class="contact-card" :class="{ 'is-visible': visible }">
    <p v-if="section.subtitle" class="contact-eyebrow">{{ section.subtitle }}</p>
    <div class="contact-prose">
      <ContentRenderer v-if="doc" :value="doc" />
    </div>
    <div class="contact-actions">
      <a
        href="https://github.com/Blaxzter"
        target="_blank"
        rel="noopener"
        class="contact-btn"
        >GitHub</a
      >
      <a
        href="https://respeak.io"
        target="_blank"
        rel="noopener"
        class="contact-btn ghost"
        >Respeak</a
      >
    </div>
  </article>
</template>

<style scoped>
.contact-card {
  max-width: 36rem;
  margin: 0 auto;
  padding: 2rem 2.25rem;
  border-radius: 0.75rem;
  border-left: 3px solid var(--accent, #00ff9c);
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  color: #fff;
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.contact-card.is-visible {
  opacity: 1;
  transform: translateY(0);
}
.contact-eyebrow {
  font-size: 0.9rem;
  opacity: 0.7;
  margin: 0 0 0.75rem;
}
.contact-prose :deep(h2),
.contact-prose :deep(h1) {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  line-height: 1.15;
}
.contact-prose :deep(p) {
  font-size: 1.02rem;
  line-height: 1.6;
  opacity: 0.88;
  margin: 0 0 0.85rem;
}
.contact-prose :deep(a) {
  color: var(--accent, #00ff9c);
  text-decoration: underline;
}
.contact-prose :deep(strong) {
  color: var(--accent, #00ff9c);
  font-weight: 700;
}
.contact-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
.contact-btn {
  padding: 0.55rem 1.1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  background: var(--accent, #00ff9c);
  color: #0a0a0a;
  text-decoration: none;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.contact-btn.ghost {
  background: transparent;
  color: var(--accent, #00ff9c);
  border: 1px solid var(--accent, #00ff9c);
}
.contact-btn:hover {
  transform: translateY(-2px);
  opacity: 0.92;
}
</style>
