<script setup lang="ts">
/**
 * The study / work / volunteer tag on the biography cards. Outlined for study
 * and volunteer, filled for work, so "this was a job" reads the same whether it
 * heads a whole card or a block inside one (`::bio-work` in the markdown).
 */
export type BioKindName = "study" | "work" | "volunteer";

const props = defineProps<{ kind: BioKindName }>();
const { t } = useI18n();
</script>

<template>
  <span class="bio-kind" :class="`is-${props.kind}`">{{ t(`common.kind.${props.kind}`) }}</span>
</template>

<style scoped>
.bio-kind {
  display: inline-block;
  padding: 0.05rem 0.4rem;
  border: 1px solid color-mix(in srgb, var(--accent, #00ff9c) 70%, transparent);
  border-radius: 0.25rem;
  font-family: "Courier New", monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  line-height: 1.4;
  color: var(--accent, #00ff9c);
}
.bio-kind.is-work {
  background: color-mix(in srgb, var(--accent, #00ff9c) 85%, transparent);
  color: #000;
}
</style>
