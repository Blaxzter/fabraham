<template>
  <div class="relative">
    <!-- Boot screen is client-only and skipped in dev for faster iteration. -->
    <ClientOnly>
      <BootScreen v-if="!isDev && !bootState.bootCompleted && !skipBootIntro" />
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
        contentRevealed && !orbitInspect
          ? 'opacity-100'
          : 'opacity-0 pointer-events-none',
      ]"
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
const bootState = useBootStateStore();

// `import.meta.dev` is build-time constant — no hostname sniffing, no stale ref.
const isDev = import.meta.dev;

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
const contentRevealed = computed(() => isDev || bootState.bootCompleted);

// Start loading the scene while the boot sequence runs (hides perceived latency).
const shouldLoadScene = computed(
  () =>
    isDev ||
    bootState.phase === "booting" ||
    bootState.phase === "loading-scene" ||
    bootState.bootCompleted
);

// Meta data
useSeoMeta({
  title: "Frederic Abraham — Fullest-Stack Developer",
  description:
    "The career of Frederic Abraham as a scroll-driven 3D timeline: TU Berlin (B.Sc.), an M.Sc. in AI at Maastricht, and scaling AI products at Respeak in Berlin — GANs, embeddings, and RAG.",
  ogTitle: "Frederic Abraham — Fullest-Stack Developer",
  ogDescription:
    "A biographical 3D timeline: Berlin → Maastricht → Berlin. Generative AI, embeddings at scale, and retrieval-augmented generation.",
  ogType: "website",
});
</script>
