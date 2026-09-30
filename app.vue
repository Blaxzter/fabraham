<script setup lang="ts">
// `lang` on <html>, hreflang alternates between / and /de, og:locale. Both
// languages are prerendered, so these land in the static HTML crawlers read.
const i18nHead = useLocaleHead({ seo: true });
useHead(() => ({
  htmlAttrs: { lang: i18nHead.value.htmlAttrs?.lang },
  link: [...(i18nHead.value.link ?? [])],
  meta: [...(i18nHead.value.meta ?? [])],
}));
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />

    <LangSwitch />

    <!-- Main Content -->
    <main>
      <NuxtPage />
    </main>
  </div>
</template>
