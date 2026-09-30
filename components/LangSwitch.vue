<script setup lang="ts">
/**
 * EN / DE, top-right on every page.
 *
 * `setLocale` rather than a plain link to `switchLocalePath`: it navigates AND
 * writes the locale cookie, and the cookie is what stops the browser-language
 * redirect on `/` from sending a German browser back to /de after the visitor
 * chose English.
 *
 * z 15: above the scroll content (z 10, which comes later in the DOM and would
 * otherwise win the tie and swallow every click), under the boot overlay
 * (z 20/30), so it only shows once the boot is done, and under explore mode's
 * chrome (z 60). In dev it moves left of the dev panel's ⚙, which owns the
 * corner.
 */
const { locale, locales, setLocale, t } = useI18n();

const options = computed(() =>
  locales.value.map((l) => ({ code: l.code, name: l.name ?? l.code }))
);
const isDev = import.meta.dev;
</script>

<template>
  <nav class="lang" :class="{ dev: isDev }" :aria-label="t('common.lang.label')">
    <button
      v-for="(o, i) in options"
      :key="o.code"
      type="button"
      class="lang-opt"
      :class="{ on: o.code === locale }"
      :aria-pressed="o.code === locale"
      :lang="o.code"
      :title="o.name"
      @click="o.code !== locale && setLocale(o.code)"
    >
      <span v-if="i > 0" class="sep" aria-hidden="true">/</span>{{ o.code }}
    </button>
  </nav>
</template>

<style scoped>
.lang {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 15;
  display: flex;
  align-items: center;
  padding: 0.25rem 0.55rem;
  border: 1px solid rgba(0, 255, 156, 0.25);
  border-radius: 0.4rem;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  font-family: "Courier New", monospace;
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
.lang.dev {
  right: 3.75rem;
}
.lang-opt {
  padding: 0.1rem 0.15rem;
  border: 0;
  background: none;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
  transition: color 0.2s ease;
}
.lang-opt:hover,
.lang-opt:focus-visible {
  color: #fff;
}
.lang-opt.on {
  color: #00ff9c;
  cursor: default;
}
.sep {
  margin-right: 0.3rem;
  color: rgba(255, 255, 255, 0.3);
}
</style>
