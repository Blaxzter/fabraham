<script setup lang="ts">
// A collapsible section inside the dev panel. Chrome only — all styling comes
// from the global `.dvp-*` sheet in DevPanel.vue so every section matches.
import { ref } from "vue";

const props = withDefaults(
  defineProps<{ title: string; defaultOpen?: boolean }>(),
  { defaultOpen: false }
);

const open = ref(props.defaultOpen);
</script>

<template>
  <section class="dvp-sec">
    <header class="dvp-sec-head">
      <button class="dvp-sec-toggle" @click="open = !open">
        <span class="dvp-caret">{{ open ? "▾" : "▸" }}</span>
        <span class="dvp-sec-title">{{ title }}</span>
      </button>
      <span class="dvp-sec-actions">
        <slot name="actions" />
      </span>
    </header>
    <div v-if="open" class="dvp-sec-body">
      <slot />
    </div>
  </section>
</template>
