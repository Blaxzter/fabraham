<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementVisibility } from "@vueuse/core";
import type { Component } from "vue";
import type { Section } from "~/types/section";
import BiographySection from "./sections/BiographySection.vue";
import ContactSection from "./sections/ContactSection.vue";
import InterludeSection from "./sections/InterludeSection.vue";

// Renders one peer section: provides the scroll-length + alignment shell and
// dispatches to the right component by `type`. Card-type sections are pinned and
// centered (with per-section alignment/offset); the biography flows full-height.
const props = defineProps<{ section: Section; doc: unknown; index: number }>();

const COMPONENTS: Partial<Record<Section["type"], Component>> = {
  biography: BiographySection,
  contact: ContactSection,
  interlude: InterludeSection,
  // 'tech-stack' deferred → falls back to InterludeSection for now.
};
const cmp = computed(() => COMPONENTS[props.section.type] ?? InterludeSection);

// The biography is a tall flowing cluster; everything else is a pinned card.
const pinned = computed(() => props.section.type !== "biography");

const sectionRef = ref<HTMLElement | null>(null);
const isVisible = useElementVisibility(sectionRef, { threshold: 0.25 });

const minHeight = computed(() => `${(props.section.weight || 1) * 100}vh`);
const accent = computed(() => props.section.accent ?? "#00ff9c");

const justifyContent = computed(() => {
  const a = props.section.layout.align;
  if (a === "left") return "flex-start";
  if (a === "right") return "flex-end";
  return "center";
});
const alignItems = computed(() => {
  const a = props.section.layout.align;
  if (a === "top") return "flex-start";
  if (a === "bottom") return "flex-end";
  return "center";
});
const offsetTransform = computed(() => {
  const o = props.section.layout.offset;
  if (!o) return undefined;
  return `translate(${o.x ?? 0}vw, ${o.y ?? 0}vh)`;
});
const maxWidth = computed(() => props.section.layout.maxWidth ?? "36rem");
</script>

<template>
  <section
    ref="sectionRef"
    class="section"
    :style="{ minHeight, '--accent': accent }"
  >
    <!-- Pinned card sections (contact, interlude, …) -->
    <div
      v-if="pinned"
      class="section-sticky"
      :style="{ justifyContent, alignItems }"
    >
      <div class="section-card" :style="{ transform: offsetTransform, maxWidth }">
        <component
          :is="cmp"
          :section="section"
          :doc="doc"
          :visible="isVisible"
        />
      </div>
    </div>

    <!-- Flowing sections (biography cluster) fill the section height. -->
    <component
      v-else
      :is="cmp"
      :section="section"
      :doc="doc"
      :visible="isVisible"
    />
  </section>
</template>

<style scoped>
.section {
  position: relative;
}
.section-sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  padding: 0 1.5rem;
  pointer-events: none;
}
.section-card {
  pointer-events: auto;
  width: 100%;
}
</style>
