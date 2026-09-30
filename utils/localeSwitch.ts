import type { RouteLocationNormalized } from "vue-router";

/**
 * True when a navigation only changes the language: `/` ↔ `/de`, `/projects` ↔
 * `/de/projects`. @nuxtjs/i18n names the per-locale copies of a route
 * `<name>___<code>`, so the part before the suffix is the page.
 *
 * Pages that must survive a language switch (the home scroll, the projects
 * timeline) use it as `scrollToTop`, together with a fixed page `key` so the
 * page is patched in place rather than remounted: a remount rebuilds the whole
 * 3D scene and the scroll starts over.
 */
const pageOf = (r: RouteLocationNormalized) => String(r.name ?? "").split("___")[0];

export const isLocaleSwitch = (to: RouteLocationNormalized, from: RouteLocationNormalized) =>
  !!pageOf(to) && pageOf(to) === pageOf(from);

/** For `definePageMeta({ scrollToTop })`: keep the position on a language switch. */
export const scrollToTopUnlessLocaleSwitch = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
) => !isLocaleSwitch(to, from);
