<script setup lang="ts">
/**
 * Markdown links. External ones open in a new tab, like every other outbound
 * link on the site (the bud cards, the terminal), so a click in a biography
 * card does not throw the visitor out of the scroll they were halfway through.
 * The only ContentRenderer is the biography card's, so this is scoped to it in
 * practice.
 */
const props = defineProps<{ href?: string; target?: string }>();
const external = computed(() => /^https?:\/\//.test(props.href ?? ""));
</script>

<template>
  <a
    :href="href"
    :target="target ?? (external ? '_blank' : undefined)"
    :rel="external ? 'noopener' : undefined"
  ><slot /></a>
</template>
