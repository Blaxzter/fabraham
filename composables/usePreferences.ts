import { ref, computed, watch } from "vue";

/**
 * Visitor-facing preferences, persisted to localStorage and shared app-wide.
 * Set from the /setup Preferences page; read by the experience.
 *
 * - `motion`  — "system" honours the OS prefers-reduced-motion; "reduced"/"full"
 *   force it. `reducedMotion` is the resolved boolean (Scene3D reads it for the
 *   head/cursor motion, and a `reduce-motion` class is mirrored onto <html> as a
 *   CSS hook).
 * - `skipBootIntro` — bypass the BIOS boot intro on load.
 *
 * Theme is intentionally NOT here — it's owned by `useColorMode()`
 * (@nuxtjs/color-mode), which already persists and SSR-syncs the theme class.
 *
 * SSR-safe: module-level refs default to the "no preference" state, and
 * localStorage / matchMedia are only touched on the client, so first-paint
 * matches the server (preferences apply after hydration, like the boot reveal).
 */
export type MotionPref = "system" | "reduced" | "full";

const LS_KEY = "fab:prefs";

const motion = ref<MotionPref>("system");
const skipBootIntro = ref(false);
const systemReduced = ref(false);

let initialized = false;

function init() {
  initialized = true;

  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    if (saved.motion === "reduced" || saved.motion === "full") motion.value = saved.motion;
    skipBootIntro.value = !!saved.skipBootIntro;
  } catch {
    /* corrupt / blocked storage — keep defaults */
  }

  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  systemReduced.value = mq.matches;
  mq.addEventListener("change", (e) => (systemReduced.value = e.matches));

  // Persist on any change.
  watch(
    [motion, skipBootIntro],
    () => {
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({ motion: motion.value, skipBootIntro: skipBootIntro.value })
        );
      } catch {
        /* quota / privacy mode — ignore */
      }
    },
    { deep: false }
  );

  // Mirror the resolved reduced-motion state onto <html> as a CSS hook.
  watch(
    resolvedReducedMotion,
    (on) => document.documentElement.classList.toggle("reduce-motion", on),
    { immediate: true }
  );
}

const resolvedReducedMotion = computed(
  () => motion.value === "reduced" || (motion.value === "system" && systemReduced.value)
);

export function usePreferences() {
  if (import.meta.client && !initialized) init();
  return {
    motion,
    skipBootIntro,
    reducedMotion: resolvedReducedMotion,
  };
}
