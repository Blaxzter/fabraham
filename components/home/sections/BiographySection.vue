<script setup lang="ts">
import { computed } from "vue";
import type { Section } from "~/types/section";
import BiographyCard from "./BiographyCard.vue";

// The biography as ONE section: a loose, artistic cluster of milestone cards
// connected by a hand-drawn line. Fills the section height (set by SectionHost
// from the section weight) and absolutely-positions each milestone at a
// deterministic anchor; the SVG connector is drawn through the same anchors so
// the line and the cards always agree (no DOM measurement → SSG-safe).
//
// A sticky headline (sourced from the section frontmatter title/subtitle) pins
// to the top of the section so the cluster reads as a clearly labeled chapter
// as you scroll through it.
const props = defineProps<{ section?: Section; doc?: unknown; visible?: boolean }>();

const store = useSectionsStore();
const { docs, milestones } = useBiographyMilestones();

// Drive the headline + connector reveal off the scroll progress, not the
// section's IntersectionObserver `visible`: the biography section is several
// viewports tall, so its intersection ratio tops out around 0.25 and the 0.25
// threshold only trips deep into the section (the headline showed up far too
// late). Progress is the single scroll signal everything else derives from
// (issue #4), so anchor to it: reveal as soon as we cross into the section.
const entered = computed(() => {
  const bi = store.sections.findIndex((s) => s.type === "biography");
  if (bi < 0) return props.visible ?? false;
  const start = store.boundaries[bi] ?? 0;
  const end = store.boundaries[bi + 1] ?? 1;
  return store.progress >= start - 0.04 && store.progress <= end + 0.03;
});

// Leave clear space below the sticky headline before the first card, and a
// little tail at the bottom, so the cluster reads under the heading.
const TOP_PAD = 13;
const RANGE = 83;

const layout = computed(() => {
  const ms = milestones.value;
  const n = ms.length || 1;
  return ms.map((m, i) => {
    const sideSign =
      m.side === "left" ? -1 : m.side === "right" ? 1 : i % 2 === 0 ? -1 : 1;
    // Deterministic organic jitter so it reads hand-placed, not on a grid.
    const jitterX = (((i * 37) % 11) - 5) / 5; // -1..1
    const jitterY = (((i * 53) % 7) - 3) / 3; // -1..1
    const ax = 50 + sideSign * 16 + jitterX * 4 + (m.offset?.x ?? 0);
    const ay =
      TOP_PAD + ((i + 0.6) / (n + 0.2)) * RANGE + jitterY * 1.5 + (m.offset?.y ?? 0);
    return { milestone: m, doc: docs.value[i], ax, ay, sideSign };
  });
});

// Catmull-Rom spline → cubic beziers: a smooth curve that passes THROUGH every
// node (anchor), so the connector actually links the dots.
const connectorPath = computed(() => {
  const pts = layout.value.map((p) => ({ x: p.ax, y: p.ay }));
  if (pts.length < 2) return "";
  const f = (n: number) => n.toFixed(2);
  let d = `M ${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
});

const accent = computed(() => props.section?.accent ?? "#9ad1ff");

const nodeStyle = (item: { ax: number; ay: number }) => ({
  left: `${item.ax}%`,
  top: `${item.ay}%`,
});
const cardStyle = (item: { ax: number; ay: number; sideSign: number }) => ({
  left: `${item.ax}%`,
  top: `${item.ay}%`,
  transform:
    item.sideSign < 0
      ? "translate(calc(-100% - 14px), -50%)"
      : "translate(14px, -50%)",
});
</script>

<template>
  <!-- Sticky chapter label: real HTML from the section frontmatter (SSG-safe),
       pinned to the top of the (tall) biography section so it reads as a
       labeled chapter the milestone cluster flows under. -->
  <header
    class="bio-heading"
    :class="{ 'is-visible': entered }"
    :style="{ '--accent': accent }"
  >
    <p v-if="section?.subtitle" class="bio-route">{{ section.subtitle }}</p>
    <h2 v-if="section?.title" class="bio-title">{{ section.title }}</h2>
  </header>

  <div class="bio" :style="{ '--accent': accent }">
    <!-- `pathLength="100"` normalizes the path to 100 user units so the dash
         maths below work regardless of the actual bezier length. The base path
         draws itself in as the section is entered; a brighter, shorter dash
         travels the same path forever as a "signal flowing the timeline". -->
    <svg
      class="bio-connector"
      :class="{ 'is-on': entered }"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        class="bio-connector-base"
        :d="connectorPath"
        fill="none"
        :stroke="accent"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
        pathLength="100"
      />
      <path
        class="bio-connector-flow"
        :d="connectorPath"
        fill="none"
        stroke="#ffffff"
        stroke-width="2.5"
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
        pathLength="100"
      />
    </svg>

    <template v-for="item in layout" :key="item.milestone.id">
      <span class="bio-node" :style="nodeStyle(item)" />
      <div class="bio-card-pos" :style="cardStyle(item)">
        <BiographyCard
          :doc="item.doc"
          :milestone="item.milestone"
          :side="item.sideSign"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.bio-heading {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(1.5rem, 6vh, 4rem) 1.5rem 1.5rem;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.bio-heading.is-visible {
  opacity: 1;
  transform: translateY(0);
}
.bio-route {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent, #9ad1ff);
  opacity: 0.95;
  /* No backdrop band — legibility comes from the text's own shadow. */
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.85), 0 0 22px rgba(0, 0, 0, 0.6);
}
.bio-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.05;
  color: #fff;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.9), 0 0 44px rgba(0, 0, 0, 0.6);
}
.bio {
  position: absolute;
  inset: 0;
}
.bio-connector {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.9s ease;
}
.bio-connector.is-on {
  opacity: 0.7;
}
/* The base is a dotted line that slowly marches along the path (the whole line
   is alive, not just the pulse). `pathLength="100"` normalizes the dash units. */
.bio-connector-base {
  stroke-dasharray: 1 5;
  animation: bio-march 1.5s linear infinite;
}
@keyframes bio-march {
  to {
    stroke-dashoffset: -6; /* one dash period → seamless loop */
  }
}
/* A short bright dash that travels the path faster — a pulse down the timeline. */
.bio-connector-flow {
  stroke-dasharray: 14 86;
  opacity: 0.9;
  animation: bio-flow 3.4s linear infinite;
}
@keyframes bio-flow {
  to {
    stroke-dashoffset: -100;
  }
}
.bio-node {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: var(--accent, #9ad1ff);
  box-shadow: 0 0 12px 1px var(--accent, #9ad1ff);
  pointer-events: none;
  animation: bio-node-pulse 2.8s ease-in-out infinite;
}
@keyframes bio-node-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px 0 var(--accent, #9ad1ff);
  }
  50% {
    box-shadow: 0 0 16px 3px var(--accent, #9ad1ff);
  }
}
.bio-card-pos {
  position: absolute;
}
@media (prefers-reduced-motion: reduce) {
  .bio-connector-base,
  .bio-connector-flow,
  .bio-node {
    animation: none;
  }
}
</style>
