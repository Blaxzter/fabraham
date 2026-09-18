<script setup lang="ts">
import { computed } from "vue";
import type { Section } from "~/types/section";
import { bioCardAnchors } from "./biography";
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
const props = defineProps<{ section?: Section; visible?: boolean }>();

const store = useSectionsStore();
const { docs, milestones } = useBiographyMilestones();

// Generate the chapter's 3D choreography (the head's swerve + gaze and the
// key/fill beats that light it) from these same milestones, into the sections /
// spotlights stores. Driven from here because this is the one component that is
// both mounted for the life of the page and already reading the milestone list;
// the formulas it shares with the layout below live in ./biography.ts.
useBiographyChoreography();

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

// Anchors come from the SHARED formula in ./biography.ts — the same one the head's
// gaze and the spotlight beats are generated from, so the 3D choreography can
// never drift from the cards it is supposed to be looking at (and the milestone's
// set-piece still blooms at the scroll position its card sits at).
const layout = computed(() => {
  const ms = milestones.value;
  return bioCardAnchors(ms).map((a, i) => ({
    milestone: ms[i]!,
    doc: docs.value[i],
    ...a,
  }));
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

// The anchors go out as CUSTOM PROPERTIES, not as `left`/`top`/`transform`.
// Inline geometry would win over any stylesheet rule regardless of media query,
// and the narrow-screen layout below has to re-read these same numbers into a
// different arrangement (one column instead of a zigzag). Handing the anchor
// down as data and leaving the geometry in CSS is what makes that override
// possible — and keeps the wide layout byte-identical to what it was.
const nodeStyle = (item: { ax: number; ay: number }) => ({
  "--ax": `${item.ax}%`,
  "--ay": `${item.ay}%`,
});
const cardStyle = (item: { ax: number; ay: number; sideSign: number }) => ({
  "--ax": `${item.ax}%`,
  "--ay": `${item.ay}%`,
  "--side": `${item.sideSign}`,
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
  left: var(--ax);
  top: var(--ay);
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
/* The card hangs OUTWARD from its node: `--side` is -1 (left of the line) or +1
   (right of it), and both halves of the offset are mirrored through it —
   -1 → `-100% - 14px`, +1 → `14px` — so the card and the dot it belongs to can
   never drift onto different sides. Same one-sign-property discipline the card's
   own lighting uses (see BiographyCard). */
.bio-card-pos {
  position: absolute;
  left: var(--ax);
  top: var(--ay);
  transform: translate(
    calc((var(--side) - 1) * 50% + var(--side) * 14px),
    -50%
  );
}

/* ── Narrow screens: the zigzag becomes a rail ───────────────────────────────
   The wide layout hangs cards off alternating sides of a spline that wanders
   between ~30% and ~69% of the viewport. A phone has no room for that: a card
   is most of the screen wide, so hung off a node at 30% it sits two-thirds off
   the edge — and because it never reaches the 0.5 intersection ratio its own
   entrance observer waits for, it never even fades IN. The whole chapter was
   blank.

   1024px, because that is where the geometry actually runs out, not where
   "mobile" is conventionally drawn: the card has `30% − 14px` of room, so even
   at the tightened 26vw (BiographyCard) it is under ~266px below this — a
   column too narrow for the prose to read as prose.

   Below it the cluster collapses to the shape a narrow screen actually has: one
   column, every card on the same side of a straight rail down the left margin,
   each with its own dot on it. The anchors are untouched — only how the DOM
   arranges them changes — so the 3D half of the chapter (the head's swerve, its
   gaze, the key light, the set-piece blooms) is generated from exactly the same
   numbers as before and needs no mobile branch of its own.

   The generated spline and its nodes go with the zigzag they described; the rail
   and the dots below replace them.

   The 3D half is no longer exempt, though — it turned out it could not be. The
   head's swerve is a world constant and the frame a phone gives it is less than
   half the width the swerve was authored against, so it swung clean out of shot;
   and the gaze went on aiming at cards that alternate sides only in the data. Both
   are now derived from the live frame and from THIS breakpoint, which is why
   `BIO_RAIL_MAX_PX` in ./biography.ts restates the 1024 below. Move one, move all
   three (here, BiographyCard.vue, and that constant). */
@media (max-width: 1024px) {
  .bio-connector,
  .bio-node {
    display: none;
  }
  /* The rail: the timeline itself, redrawn straight. Built from a repeating
     gradient rather than a dashed border so it can MARCH like the connector it
     stands in for — same 1.5s period, same direction, one dash per period — and
     the chapter still reads as one live line the milestones hang off rather than
     a static divider. (A border's dashes cannot be animated; a background's
     position can.) */
  .bio::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 1.35rem;
    width: 1px;
    background: repeating-linear-gradient(
      to bottom,
      var(--accent, #9ad1ff) 0 2px,
      transparent 2px 8px
    );
    opacity: 0.7;
    animation: bio-rail-march 1.5s linear infinite;
    pointer-events: none;
  }
  @keyframes bio-rail-march {
    to {
      background-position-y: 8px; /* one dash period → seamless loop */
    }
  }
  /* The chapter label stops being sticky here, and that is not a downgrade.
     Pinned at the top of a 7-viewport section it is fine over a 26vw card in the
     wide layout — there is a whole column of empty page beside it. In the rail
     layout the card is the width of the screen, so the headline was printing
     "How I got here" straight across a milestone's own prose for most of the
     chapter: two pieces of text in the same pixels, neither readable. Nothing
     else is competing for that band on a phone, so it becomes what a chapter
     title on a narrow screen normally is — an opener you scroll past. */
  .bio-heading {
    position: static;
  }
  .bio-card-pos {
    /* Right of the rail, filling the margin — but capped, because this band runs
       up to 1024px and a 900px-wide line of prose is not a card, it is a
       paragraph. `left` + `right` + `max-width` leaves the column anchored to
       the rail and lets the slack fall on the right. */
    left: 2.6rem;
    right: 1rem;
    max-width: 32rem;
    transform: translateY(-50%);
  }
  /* Each card's own dot, sitting on the rail at the card's vertical anchor —
     the `.bio-node` it replaces, moved from the card's x to the rail's. */
  .bio-card-pos::before {
    content: "";
    position: absolute;
    top: 50%;
    left: calc(-1.25rem - 5px);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transform: translateY(-50%);
    background: var(--accent, #9ad1ff);
    box-shadow: 0 0 12px 1px var(--accent, #9ad1ff);
    pointer-events: none;
    animation: bio-node-pulse 2.8s ease-in-out infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bio-connector-base,
  .bio-connector-flow,
  .bio-node,
  /* The narrow-screen rail and its dots — same motion, same exemption. */
  .bio::before,
  .bio-card-pos::before {
    animation: none;
  }
}
</style>
