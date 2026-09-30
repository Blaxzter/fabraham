<template>
  <div class="setup">
    <div class="setup-card">
      <header class="setup-top">
        <span class="setup-tag">BIOS</span>
        <h1 class="setup-title">{{ t("shell.setup.title") }}</h1>
      </header>

      <!-- Appearance / theme -->
      <section class="setup-sec">
        <h2 class="setup-h">{{ t("shell.setup.appearance") }}</h2>
        <p class="setup-desc">{{ t("shell.setup.appearanceDesc") }}</p>
        <div class="setup-seg">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            class="setup-opt"
            :class="{ active: colorMode.preference === opt.value }"
            @click="colorMode.preference = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </section>

      <!-- Motion -->
      <section class="setup-sec">
        <h2 class="setup-h">{{ t("shell.setup.motion") }}</h2>
        <p class="setup-desc">{{ t("shell.setup.motionDesc") }}</p>
        <div class="setup-seg">
          <button
            v-for="opt in motionOptions"
            :key="opt.value"
            class="setup-opt"
            :class="{ active: motion === opt.value }"
            @click="motion = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </section>

      <!-- Startup -->
      <section class="setup-sec">
        <h2 class="setup-h">{{ t("shell.setup.startup") }}</h2>
        <label class="setup-toggle">
          <input v-model="skipBootIntro" type="checkbox" />
          <span>{{ t("shell.setup.skipBoot") }}</span>
        </label>
      </section>

      <footer class="setup-foot">
        <NuxtLink :to="localePath('/')" class="setup-link">{{ t("shell.setup.back") }}</NuxtLink>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MotionPref } from "~/composables/usePreferences";

const colorMode = useColorMode();
const { motion, skipBootIntro } = usePreferences();

const { t } = useI18n();
const localePath = useLocalePath();

const themeOptions = computed(() =>
  (["system", "light", "dark"] as const).map((value) => ({
    value,
    label: t(`shell.setup.opt.${value}`),
  }))
);

const motionOptions = computed<{ value: MotionPref; label: string }[]>(() =>
  (["system", "full", "reduced"] as const).map((value) => ({
    value,
    label: t(`shell.setup.opt.${value}`),
  }))
);

useSeoMeta({
  title: () => t("shell.setup.metaTitle"),
  description: () => t("shell.setup.metaDescription"),
  robots: "noindex",
});
</script>

<style scoped>
/* BIOS/terminal aesthetic — matches the boot screen this page is reached from,
   so it reads as a single dark settings surface regardless of the chosen theme. */
.setup {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background:
    radial-gradient(120% 120% at 50% 0%, #0a1410 0%, #04080a 60%, #02050a 100%);
  color: #d6ffe9;
  font-family: "Courier New", monospace;
}
.setup-card {
  width: 100%;
  max-width: 34rem;
  border: 1px solid rgba(0, 255, 156, 0.35);
  border-radius: 0.6rem;
  background: rgba(4, 10, 8, 0.7);
  box-shadow: 0 0 40px rgba(0, 255, 156, 0.08);
  padding: 1.6rem 1.6rem 1.2rem;
}
.setup-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid rgba(0, 255, 156, 0.2);
  padding-bottom: 0.9rem;
  margin-bottom: 1.2rem;
}
.setup-tag {
  font-size: 0.6rem;
  letter-spacing: 0.25em;
  padding: 0.15rem 0.4rem;
  border: 1px solid rgba(0, 255, 156, 0.4);
  border-radius: 0.25rem;
  color: #00ff9c;
}
.setup-title {
  font-size: 0.95rem;
  letter-spacing: 0.18em;
  color: #00ff9c;
  margin: 0;
}
.setup-sec {
  margin-bottom: 1.4rem;
}
.setup-h {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #9fe;
  margin: 0 0 0.3rem;
}
.setup-desc {
  font-size: 0.72rem;
  line-height: 1.4;
  opacity: 0.6;
  margin: 0 0 0.7rem;
}
.setup-seg {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.setup-opt {
  flex: 1;
  min-width: 5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(0, 255, 156, 0.3);
  border-radius: 0.35rem;
  background: transparent;
  color: #d6ffe9;
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.setup-opt:hover {
  background: rgba(0, 255, 156, 0.08);
}
.setup-opt.active {
  background: rgba(0, 255, 156, 0.16);
  border-color: #00ff9c;
  color: #00ff9c;
}
.setup-toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.setup-toggle input {
  width: 1rem;
  height: 1rem;
  accent-color: #00ff9c;
}
.setup-foot {
  border-top: 1px solid rgba(0, 255, 156, 0.2);
  padding-top: 1rem;
  margin-top: 0.4rem;
}
.setup-link {
  color: #00ff9c;
  text-decoration: none;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}
.setup-link:hover {
  text-decoration: underline;
}
</style>
