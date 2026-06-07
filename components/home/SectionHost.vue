<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementVisibility } from "@vueuse/core";
import type { SectionDef } from "./sections/registry";

// Renders one peer section: provides the scroll-length + alignment shell and
// renders the section's own dedicated component (from the registry) in one of
// three layout modes:
//   flow   → the component fills the section height (the biography cluster);
//   pinned → a sticky, centered card using the section's layout align/offset;
//   bare   → just a height spacer, the component positions itself (the hero).
const props = defineProps<{ def: SectionDef; index: number }>();

const sectionRef = ref<HTMLElement | null>(null);
const isVisible = useElementVisibility(sectionRef, { threshold: 0.25 });

const minHeight = computed(() => `${(props.def.weight || 1) * 100}vh`);
const accent = computed(() => props.def.accent ?? "#00ff9c");

const justifyContent = computed(() => {
  const a = props.def.layout.align;
  if (a === "left") return "flex-start";
  if (a === "right") return "flex-end";
  return "center";
});
const alignItems = computed(() => {
  const a = props.def.layout.align;
  if (a === "top") return "flex-start";
  if (a === "bottom") return "flex-end";
  return "center";
});
const offsetTransform = computed(() => {
  const o = props.def.layout.offset;
  if (!o) return undefined;
  return `translate(${o.x ?? 0}vw, ${o.y ?? 0}vh)`;
});
const maxWidth = computed(() => props.def.layout.maxWidth ?? "36rem");
</script>

<template>
  <section
    ref="sectionRef"
    class="section"
    :style="{ minHeight, '--accent': accent }"
  >
    <!-- Pinned card sections (contact, interludes). -->
    <div
      v-if="def.mode === 'pinned'"
      class="section-sticky"
      :style="{ justifyContent, alignItems }"
    >
      <div class="section-card" :style="{ transform: offsetTransform, maxWidth }">
        <component :is="def.component" :section="def" :visible="isVisible" />
      </div>
    </div>

    <!-- Bare sections (the hero): the component owns its own positioning. -->
    <component
      v-else-if="def.mode === 'bare'"
      :is="def.component"
      :section="def"
      :visible="isVisible"
    />

    <!-- Flowing sections (the biography cluster) fill the section height. -->
    <component
      v-else
      :is="def.component"
      :section="def"
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
