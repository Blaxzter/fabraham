<template>
  <div class="relative">
    <!-- Boot screen is client-only and skipped in dev for faster iteration. -->
    <ClientOnly>
      <BootScreen
        v-if="bootEnabled && !bootState.bootCompleted && !skipBootIntro"
        :stage="sceneStage"
      />
    </ClientOnly>

    <!-- Fixed 3D scene background. Client-only so the page stays SSG-compatible
         (the canvas + GLB loader never run during prerender, issue #5). -->
    <ClientOnly>
      <!-- The canvas is normally inert: it is a BACKDROP, and every pointer has
           to reach the content scrolling over it. Orbit mode inverts that — the
           scene is the thing being dragged — so it takes the pointer back for as
           long as it is on. Without this OrbitControls mounts and silently never
           receives an event, which looks exactly like a frozen camera. -->
      <div
        v-if="shouldLoadScene"
        ref="sceneStage"
        class="fixed inset-0 w-full h-screen"
        :class="orbitInspect ? 'pointer-events-auto' : 'pointer-events-none'"
      >
        <HomeScene3D />
      </div>
    </ClientOnly>

    <!-- Data-driven biographical timeline. ALWAYS rendered so the prose
         prerenders to static HTML for crawlers (#5). Kept visually hidden +
         non-interactive until the boot intro finishes, then fades in. Using
         opacity (not v-if) keeps SSR and client-first-paint identical — no
         hydration mismatch, no pre-boot content flash — and the text stays
         indexable. -->
    <div
      :class="[
        'transition-opacity duration-700',
        contentRevealed && !orbitInspect ? 'opacity-100' : 'opacity-0 content-inert',
      ]"
      :inert="contentRevealed && !orbitInspect ? undefined : true"
    >
      <HomeScrollableContent />
    </div>

    <!-- Free-camera overlay: the scrubber + exit, shown while a visitor is
         exploring the scene off the rails. Outside the block above on purpose —
         that one is hidden in orbit mode, and this is the only way back. -->
    <ClientOnly>
      <HomeExploreMode />
    </ClientOnly>

    <!-- Dev-only unified control panel (camera/positioning, scene, ASCII,
         lights + registered tuning groups). -->
    <ClientOnly>
      <HomeDevPanel v-if="isDev" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { scrollToTopUnlessLocaleSwitch } from "~/utils/localeSwitch";

// Fixed key + no scroll reset: `/` and `/de` are two routes, and without this a
// language switch remounts the page, which rebuilds the whole 3D scene and
// throws the visitor back to the top of the scroll.
definePageMeta({ key: "home", scrollToTop: scrollToTopUnlessLocaleSwitch });

const bootState = useBootStateStore();

// The scene's layer, handed to the boot so it can shrink it onto the monitor's
// tube and zoom out of the boot into it.
const sceneStage = ref<HTMLElement | null>(null);

// `import.meta.dev` is build-time constant — no hostname sniffing, no stale ref.
const isDev = import.meta.dev;

// Dev skips the boot so a reload lands in the scene. `?boot=1` brings it back
// for working on the boot against the real page — /boot-demo has no model to
// load, so its memory test has nothing to count. Same value on server and
// client for a given URL, so the first paint matches.
const route = useRoute();
const bootEnabled = !isDev || route.query.boot === "1";

// Orbit mode hands the camera to the user, so the scroll overlay has to go: its
// cards are positioned in SCREEN space against a camera that is no longer where
// they assume, and it would swallow the drags meant for OrbitControls. Two ways
// in now — the dev panel's camera mode, and a visitor running `orbit` in the
// finale — so this is no longer dev-gated.
const { cameraControlMode } = storeToRefs(useSceneControlStore());
const orbitInspect = computed(() => cameraControlMode.value === "orbit");

// Visitor preference (from /setup): skip the boot intro and go straight in.
// Read client-side only, so this completes boot after hydration — no SSR/first-
// paint mismatch (mirrors the post-boot content reveal).
const { skipBootIntro } = usePreferences();
onMounted(() => {
  if (skipBootIntro.value && !bootState.bootCompleted) bootState.completeBootSequence();
});

// Reveal the page content once the boot intro completes (instant in dev). The
// content is always in the DOM (for prerender/SEO); this only toggles its
// visibility, so the value must match on server and client-first-paint.
const contentRevealed = computed(() => !bootEnabled || bootState.bootCompleted);

// Start loading the scene while the boot sequence runs (hides perceived latency).
const shouldLoadScene = computed(
  () =>
    !bootEnabled ||
    bootState.phase === "booting" ||
    bootState.phase === "loading-scene" ||
    bootState.bootCompleted
);

// Meta data
const { t } = useI18n();
useSeoMeta({
  title: () => t("home.meta.title"),
  description: () => t("home.meta.description"),
  ogTitle: () => t("home.meta.title"),
  ogDescription: () => t("home.meta.ogDescription"),
  ogType: "website",
  // The logo as the social card (public/og.png, built by scripts/build-icons.cjs
  // from public/logo.svg). Absolute on purpose: scrapers do not resolve
  // relative URLs, and the site is static so there is no request to read a
  // host from.
  ogImage: "https://fabraham.dev/og.png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: "fabraham.dev",
  twitterCard: "summary_large_image",
});

// Structured data, so search engines and AI assistants can tie the name to the
// job and the projects. One Person, the site, and the live projects with him
// as their creator. `sameAs` lists only profiles of him, not the products.
const person = { "@id": "https://fabraham.dev/#person" };
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Person",
            ...person,
            name: "Frederic Abraham",
            url: "https://fabraham.dev",
            image: "https://fabraham.dev/og.png",
            jobTitle: "Senior Full-Stack Developer",
            worksFor: { "@type": "Organization", name: "Respeak", url: "https://respeak.io" },
            alumniOf: [
              { "@type": "CollegeOrUniversity", name: "Technische Universität Berlin" },
              { "@type": "CollegeOrUniversity", name: "Maastricht University" },
            ],
            knowsAbout: ["Full-stack development", "Retrieval-augmented generation", "Sentence embeddings", "Generative adversarial networks"],
            knowsLanguage: ["de", "en"],
            sameAs: ["https://github.com/Blaxzter"],
          },
          {
            "@type": "WebSite",
            "@id": "https://fabraham.dev/#website",
            url: "https://fabraham.dev",
            name: "fabraham.dev",
            inLanguage: ["en", "de"],
            author: person,
          },
          {
            "@type": "SoftwareApplication",
            name: "LogoLab",
            url: "https://logolab.fabraham.dev",
            applicationCategory: "DesignApplication",
            operatingSystem: "Web",
            creator: person,
          },
          {
            "@type": "SoftwareApplication",
            name: "Episko",
            url: "https://episko.dev",
            applicationCategory: "DeveloperApplication",
            // Built with the team at Respeak, so a contributor, not the creator.
            contributor: person,
          },
          {
            "@type": "SoftwareApplication",
            name: "Speeden & Cuben",
            url: "https://speeden-and-cuben.fabraham.dev",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            creator: person,
          },
          {
            "@type": "SoftwareApplication",
            name: "Putty Party",
            url: "https://puttyparty.de",
            applicationCategory: "SportsApplication",
            operatingSystem: "Web",
            creator: person,
          },
        ],
      }),
    },
  ],
});
</script>

<style scoped>
/**
 * The fence around the hidden content — and it has to be a fence, because
 * `pointer-events` alone is not one.
 *
 * The property is INHERITED, so `pointer-events: none` on this wrapper is only a
 * default its subtree is free to overrule: `.section-card` (SectionHost),
 * `.skill-card` and the terminal's `.token` each declare `auto`, and each hands
 * it straight back down to everything inside it. At opacity 0 those elements are
 * invisible and still hit-testable — and in orbit mode they sit over a canvas
 * whose ONE interaction is a drag. The finale's card is 32rem wide, on the right,
 * exactly where the cursor is left by the button that starts explore mode: the
 * visitor drags, an invisible `<p>` takes the pointerdown, OrbitControls never
 * sees it, and the free camera reads as frozen.
 *
 * `visibility: hidden` would not have been enough either — SkillsSection writes
 * `visibility: visible` inline on every card in flight, which the scrubber can
 * bring back at any point of the run.
 *
 * This rule is NOT the fence any more, the `inert` attribute on the wrapper is.
 * Specificity alone could not hold: this compiles to `.content-inert[data-v] *`,
 * (0,2,0), and a child component's SCOPED rule carries its own attribute too —
 * ProjectsSection's `.bud-card { pointer-events: auto }` is also (0,2,0), loads
 * later, and won. So in orbit mode, with the scrubber in the projects chapter,
 * the invisible vine buds and the timeline label took the drag wherever they
 * sat, and the free camera froze "sometimes". `inert` hit-tests the whole
 * subtree as if it were `pointer-events: none` (and keeps it out of the tab
 * order), and no descendant can opt back out. This stays as a second layer.
 */
.content-inert,
.content-inert :deep(*) {
  pointer-events: none;
}
</style>
