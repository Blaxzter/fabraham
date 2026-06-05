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

    <!-- Data-driven biographical timeline (prose prerenders for SEO). -->
    <HomeScrollableContent v-if="showContent" />
  </div>
</template>

<script setup lang="ts">
const bootState = useBootStateStore();

// `import.meta.dev` is build-time constant — no hostname sniffing, no stale ref.
const isDev = import.meta.dev;

// In dev, skip the boot screen and show the experience immediately.
const showContent = computed(() => isDev || bootState.bootCompleted);

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
