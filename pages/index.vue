<template>
  <div class="relative">
    <!-- Boot screen is client-only and skipped in dev for faster iteration. -->
    <ClientOnly>
      <BootScreen v-if="!isDev && !bootState.bootCompleted" />
    </ClientOnly>

    <!-- Fixed 3D scene background. Client-only so the page stays SSG-compatible
         (the canvas + GLB loader never run during prerender, issue #5). -->
    <ClientOnly>
      <div
        v-if="shouldLoadScene"
        class="fixed inset-0 w-full h-screen pointer-events-none"
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
        contentRevealed ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ]"
    >
      <HomeScrollableContent />
    </div>

    <!-- Dev-only live tuning panel (3D anchors, head angles, …). -->
    <ClientOnly>
      <HomeTuningPanel v-if="isDev" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const bootState = useBootStateStore();

// `import.meta.dev` is build-time constant — no hostname sniffing, no stale ref.
const isDev = import.meta.dev;

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
