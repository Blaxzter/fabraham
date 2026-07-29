<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Section } from "~/types/section";
import {
  HEAD_WORLD_TO_VW,
  SKILL_CLUSTERS,
  skillHeadX,
  skillTravel,
  skillX,
} from "./skills";

// The skills chapter (mode "bare"): the component owns a sticky, full-viewport
// STAGE inside a tall section, and the four cluster cards stream across it from
// right to left as you scroll. A cone of light swings from the head's screen
// position onto whichever card is centred — the DOM half of the same beat the
// 3D key light plays in ScrollSpotlights, and the direction the head is turned.
//
// Everything is a pure function of the one scroll signal (store.progress): one
// reactive recompute per scroll tick, no layout reads, no per-card observers
// (issue #4). The card layout maths live in ./skills.ts because the head's gaze
// keyframes are generated from the very same formula.
const props = defineProps<{ section?: Section; visible?: boolean }>();

const store = useSectionsStore();
const { reducedMotion } = usePreferences();

// `usePreferences()` reads localStorage, so `reducedMotion` is false during SSR
// and can be true on the client's very first render. Vue only WARNS about class
// and style hydration mismatches — it deliberately does not repair them — which
// left the still layout rendered but never applied. Gate on a mounted flag so
// the first client render matches the server exactly and the swap lands as an
// ordinary update instead.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});
/** Reduced motion, but only once it can be applied without a hydration mismatch. */
const still = computed(() => mounted.value && reducedMotion.value);

const accent = computed(() => props.section?.accent ?? "#ffb454");
const sectionId = computed(() => props.section?.id ?? "skills");

// This section's slice of the global scroll, from the live layout.
const range = computed(() => {
  const i = store.sections.findIndex((s) => s.id === sectionId.value);
  if (i < 0) return { start: 0, end: 1 };
  return { start: store.boundaries[i] ?? 0, end: store.boundaries[i + 1] ?? 1 };
});

// Reveal the headline off scroll progress, not the `visible` prop: this section
// is three viewports tall, so its intersection ratio tops out around 0.33 and
// the 0.25 threshold would only trip deep inside it (same reason
// BiographySection derives its own `entered`).
const entered = computed(
  () => store.progress >= range.value.start - 0.03 && store.progress <= range.value.end + 0.02
);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (v: number) => v * v * (3 - 2 * v);

/** Position within this section, 0..1. */
const localFrac = computed(() =>
  clamp01((store.progress - range.value.start) / (range.value.end - range.value.start || 1))
);

/** Deterministic vertical scatter, biased upward: the cards fly across the top
 *  half so the head below them stays visible while it turns to follow. */
const Y_OFFSETS = [-19, -9, -16, -6];
/** How far (vh) a card climbs over its run — the vertical half of the motion,
 *  so the section reads as descending rather than only panning sideways. */
const CARD_RISE = 14;

const cards = computed(() => {
  const n = SKILL_CLUSTERS.length;
  const frac = localFrac.value;
  const stillNow = still.value;
  return SKILL_CLUSTERS.map((c, i) => {
    const u = skillTravel(i, n, frac);
    // 0 at the edges of the window, 1 dead centre — "how lit is this card".
    const lit = smoothstep(clamp01(1 - Math.abs(2 * u - 1)));
    const x = skillX(u);
    const edge = smoothstep(clamp01(Math.min(u, 1 - u) / 0.14));
    // A little tumble on the way in that damps out as the card reaches the
    // light, and picks back up as it leaves — it arrives, settles, moves on.
    const tumble = (0.5 - u) * 7 * (1 - lit);
    // Cards don't just cross, they RISE as they cross: scrolling down sends
    // them up and out, the same descent the 3D ladder behind them reads. The
    // path becomes a shallow diagonal rather than a flat conveyor.
    const rise = (0.5 - u) * CARD_RISE;
    return {
      ...c,
      num: String(i + 1).padStart(2, "0"),
      x,
      lit,
      /** Where the head is while this card is on stage, in vw from centre. */
      headVw: skillHeadX(u) * HEAD_WORLD_TO_VW,
      style: stillNow
        ? undefined
        : {
            transform:
              `translate3d(calc(-50% + ${x.toFixed(2)}vw), calc(-50% + ${((Y_OFFSETS[i] ?? 0) + rise).toFixed(2)}vh), 0)` +
              ` rotateY(${((0.5 - u) * 16).toFixed(2)}deg)` +
              ` rotateZ(${tumble.toFixed(2)}deg)` +
              ` scale(${(0.86 + 0.14 * lit).toFixed(3)})`,
            opacity: edge.toFixed(3),
            zIndex: String(10 + Math.round(lit * 10)),
            "--lit": lit.toFixed(3),
            // The beam's contact point crossing the card, 0..1 — drives the
            // highlight that wipes over the chips as the card passes the light.
            "--sweep": u.toFixed(4),
          },
    };
  });
});

// ---- the beam ---------------------------------------------------------------
// A cone whose apex sits at the head's on-screen position and whose axis swings
// toward the centred card — the visible counterpart of the head's turn. Tunable
// live in the dev panel (the third arg files the group under this scene) and
// shipped via tuning.config.json.
const tune = useTuning("skillsBeam", "Skills beam", "skills");
const apexY = tune.num("apexY", 72, { min: 30, max: 100, step: 1, label: "Apex Y (vh)" });
const spread = tune.num("spread", 46, { min: 8, max: 120, step: 1, label: "Spread (vw)" });
const reach = tune.num("reach", 90, { min: 20, max: 150, step: 1, label: "Reach (vh)" });
const degPerVw = tune.num("degPerVw", 1.1, { min: 0, max: 3, step: 0.05, label: "Swing (deg per vw)" });
const maxDeg = tune.num("maxDeg", 42, { min: 0, max: 80, step: 1, label: "Max swing (deg)" });
const beamOpacity = tune.num("opacity", 0.5, { min: 0, max: 1, step: 0.01, label: "Opacity" });

/** The card the light is currently on — the most-lit one. */
const front = computed(() =>
  cards.value.reduce((a, b) => (b.lit > a.lit ? b : a), cards.value[0]!)
);

const beamStyle = computed(() => {
  const f = front.value;
  // The apex sits ON the head, which now rides the conveyor — so both the
  // origin and the angle are measured from wherever the head currently is,
  // not from the middle of the frame.
  const raw = (f.x - f.headVw) * degPerVw.value;
  const angle = Math.max(-maxDeg.value, Math.min(maxDeg.value, raw));
  return {
    left: `calc(50% + ${f.headVw.toFixed(2)}vw)`,
    bottom: `${100 - apexY.value}vh`,
    width: `${spread.value}vw`,
    height: `${reach.value}vh`,
    transform: `translateX(-50%) rotate(${angle.toFixed(2)}deg)`,
    opacity: (f.lit * beamOpacity.value).toFixed(3),
  };
});
</script>

<template>
  <div class="skills" :style="{ '--accent': accent }">
    <div class="skills-stage" :class="{ 'is-static': still }">
      <header class="skills-heading" :class="{ 'is-visible': entered }">
        <p v-if="section?.subtitle" class="skills-kicker">{{ section.subtitle }}</p>
        <h2 v-if="section?.title" class="skills-title">{{ section.title }}</h2>
      </header>

      <!-- The gaze cone: apex at the head, swinging onto the centred card. -->
      <div v-if="!still" class="skills-beam" :style="beamStyle" aria-hidden="true" />

      <ul class="skills-track">
        <li
          v-for="card in cards"
          :key="card.id"
          class="skills-slot"
          :style="card.style"
        >
          <article class="skill-card">
            <p class="skill-num">{{ card.num }}</p>
            <h3 class="skill-label">{{ card.label }}</h3>
            <ul class="skill-chips">
              <li v-for="chip in card.chips" :key="chip.label">
                <!-- Decorative: the label carries the meaning. Tinted via
                     `currentColor`, so it warms with the chip as the card
                     catches the beam, for free. -->
                <span
                  v-if="chip.logo"
                  class="chip-glyph"
                  :style="{ '--glyph': `url(/setpieces/logos/${chip.logo}.svg)` }"
                  aria-hidden="true"
                />
                {{ chip.label }}
              </li>
            </ul>
          </article>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.skills {
  position: absolute;
  inset: 0;
}
/* The stage pins for the whole (tall) section, so the cards stream across a
   held frame instead of scrolling up the page with it. */
.skills-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  perspective: 1100px;
  pointer-events: none;
}

.skills-heading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(1.5rem, 6vh, 4rem) 1.5rem 1.5rem;
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.skills-heading.is-visible {
  opacity: 1;
  transform: translateY(0);
}
.skills-kicker {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.85), 0 0 22px rgba(0, 0, 0, 0.6);
}
.skills-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.05;
  color: #fff;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.9), 0 0 44px rgba(0, 0, 0, 0.6);
}

/* A shaft of light with its apex pinned at the head's screen position and
   `transform-origin` there, so the whole cone pivots around it.

   The shape is made of SOFT ALPHA, not geometry: a conic gradient for the cone's
   angular falloff, multiplied by a radial mask for its distance falloff. An
   earlier version clipped a rectangle with `clip-path` and softened it with
   `filter: blur()` — which visibly boxed the beam, for two compounding reasons:
   filters are applied BEFORE clipping, so the clip put perfectly hard edges back
   on the blurred result; and `filter` + `mix-blend-mode` promoted the element to
   its own composited layer, whose rectangle showed as a seam against the ASCII
   grid behind it. No clip, no filter, no blend mode — nothing to box. */
.skills-beam {
  position: absolute;
  left: 50%;
  transform-origin: 50% 100%;
  /* `from 180deg` puts the gradient's seam at the BOTTOM, so straight-up (the
     cone's axis) sits at 180deg — safely mid-range instead of wrapping 0/360. */
  background: conic-gradient(
    from 180deg at 50% 100%,
    color-mix(in srgb, var(--accent) 1%, transparent) 158deg,
    color-mix(in srgb, var(--accent) 34%, transparent) 173deg,
    color-mix(in srgb, var(--accent) 80%, transparent) 180deg,
    color-mix(in srgb, var(--accent) 34%, transparent) 187deg,
    color-mix(in srgb, var(--accent) 1%, transparent) 202deg
  );
  /* Brightest at the source, thinning along its length but still carrying as far
     as the card it is pointed at. Masks read alpha, so the `transparent` stop
     here is exactly what we want and cannot fringe. */
  -webkit-mask-image: radial-gradient(
    125% 118% at 50% 100%,
    #000 6%,
    rgba(0, 0, 0, 0.72) 38%,
    rgba(0, 0, 0, 0.34) 66%,
    transparent 96%
  );
  mask-image: radial-gradient(
    125% 118% at 50% 100%,
    #000 6%,
    rgba(0, 0, 0, 0.72) 38%,
    rgba(0, 0, 0, 0.34) 66%,
    transparent 96%
  );
  pointer-events: none;
  z-index: 5;
}

.skills-track {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  transform-style: preserve-3d;
}
.skills-slot {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 10;
  /* The transform is written every scroll tick — no CSS transition on it, or the
     cards would lag the scroll. */
  will-change: transform, opacity;
}

.skill-card {
  position: relative;
  width: min(26rem, 78vw);
  padding: 1.4rem 1.5rem 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  /* Nearly opaque on purpose: the beam passes BEHIND the card, so the card has
     to stop it rather than let it wash over the chips. The light reaching it
     reads through the lit rim and the sweep highlight instead. */
  background: linear-gradient(160deg, rgba(8, 11, 16, 0.96), rgba(8, 11, 16, 0.88));
  backdrop-filter: blur(6px);
  pointer-events: auto;
}
/* The lit rim, faded in by --lit as the card reaches centre stage — the card
   catching the beam. */
.skill-card::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  border: 1px solid var(--accent);
  box-shadow: 0 0 30px -6px var(--accent), inset 0 0 34px -20px var(--accent);
  opacity: var(--lit, 0);
  pointer-events: none;
}
/* The beam's contact point wiping across the card as it crosses the light. The
   card travels right→left, so the highlight sweeps left→right over its face —
   a reflection, not a decoration. */
.skill-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    100deg,
    transparent 42%,
    color-mix(in srgb, var(--accent) 30%, transparent) 50%,
    transparent 58%
  );
  background-size: 260% 100%;
  background-position-x: calc(var(--sweep, 0.5) * 160% - 30%);
  opacity: var(--lit, 0);
  pointer-events: none;
}
.skill-num {
  position: relative;
  margin: 0 0 0.35rem;
  font-family: "Courier New", monospace;
  font-size: 0.78rem;
  letter-spacing: 0.22em;
  color: var(--accent);
  opacity: calc(0.4 + var(--lit, 0) * 0.6);
}
.skill-label {
  position: relative;
  margin: 0;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.1;
  color: #fff;
}
.skill-chips {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.95rem 0 0;
  padding: 0;
  list-style: none;
}
.skill-chips li {
  display: inline-flex;
  align-items: center;
  gap: 0.42em;
  font-family: "Courier New", monospace;
  font-size: 0.78rem;
  letter-spacing: 0.03em;
  padding: 0.28rem 0.62rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: color-mix(in srgb, #fff, var(--accent) calc(var(--lit, 0) * 65%));
}
/* The brand mark as a tinted glyph. The vendored SVGs are monochrome single
   paths, so masking them with `currentColor` inherits the chip's own colour —
   including the warm-up as the card is lit — without a second rule. Kept small
   and solid so it reads as a different register from the large, drawn-in line
   art of the same marks in the 3D backdrop behind. */
.chip-glyph {
  flex: none;
  width: 1em;
  height: 1em;
  background-color: currentColor;
  -webkit-mask: var(--glyph) center / contain no-repeat;
  mask: var(--glyph) center / contain no-repeat;
}

/* Reduced motion: no conveyor, no beam — the same four cards, held still. */
.skills-stage.is-static .skills-track {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  place-content: center;
  padding: clamp(7rem, 18vh, 11rem) 1.5rem 2rem;
  overflow-y: auto;
}
.skills-stage.is-static .skills-slot {
  position: static;
  display: flex;
  justify-content: center;
}
.skills-stage.is-static .skill-card::before {
  opacity: 0.5;
}

@media (max-width: 720px) {
  .skills-stage.is-static .skills-track {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .skills-heading {
    transition: none;
  }
}
</style>
