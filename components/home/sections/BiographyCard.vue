<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementVisibility } from "@vueuse/core";
import type { BiographyMilestone } from "~/types/section";

// One milestone in the biography cluster. Owns its own staggered fade-in
// (IntersectionObserver — no rAF) and its own LIGHTING: while it is the card the
// chapter is pointing at, the scene's key light falls on it — the DOM half of
// the beat where the 3D head swerves to the far side and turns back to look at
// it. `side` (-1 left, +1 right) decides which way it extends from its node on
// the connector line, and therefore which edge the light arrives on.
const props = defineProps<{
  doc: unknown;
  milestone: BiographyMilestone;
  side: number;
}>();

const el = ref<HTMLElement | null>(null);
const visible = useElementVisibility(el, { threshold: 0.5 });

// "The card the story is on right now" — a second observer on the same element
// with the root shrunk to a band across the middle of the viewport. The card is
// LIT while it overlaps that band, so the one you are actually reading catches
// the key and the other five relax; this is a chapter of six cards you scroll
// past, and only one should look lit at a time.
//
// `threshold: 0` (any overlap) rather than a ratio: card height varies with the
// length of its prose, and a ratio against a band this narrow would be
// unreachable for the longest card on a short viewport. The band is ~36vh —
// deliberately a little taller than a card, so the light hands over from one
// card to the next as a crossfade rather than blinking out in between. Still
// just an IntersectionObserver: no rAF, no layout reads (issue #4).
const lit = useElementVisibility(el, {
  threshold: 0,
  rootMargin: "-32% 0px -32% 0px",
});

// Each milestone carries its own accent in frontmatter. Overriding `--accent` on
// the card re-tints its rim, its light pool and its prose highlights per card —
// six differently-coloured lamps rather than one chapter colour. Left unset when
// the milestone has none, so the card keeps INHERITING the chapter accent that
// `BiographySection` puts on `.bio`.
const accentStyle = computed(() =>
  props.milestone.accent ? { "--accent": props.milestone.accent } : undefined
);
</script>

<template>
  <article
    ref="el"
    class="bio-card"
    :class="{
      'is-visible': visible,
      'is-lit': lit,
      left: side < 0,
      right: side >= 0,
    }"
    :style="accentStyle"
  >
    <p v-if="milestone.location" class="bio-loc">{{ milestone.location }}</p>
    <p v-if="milestone.subtitle" class="bio-sub">{{ milestone.subtitle }}</p>
    <div class="bio-prose">
      <ContentRenderer v-if="doc" :value="doc" />
    </div>
  </article>
</template>

<style scoped>
/* ── The lit card ──────────────────────────────────────────────────────────────
   The card should read as the thing the story is currently pointing at, so it is
   lit rather than merely tinted: a pool of light spilling onto the scene around
   it, a ramp across its face, a rim burning on the lit edge, and its own shadow
   thrown the other way.

   The key arrives from the card's INNER edge — the one facing the connector
   line — because the head swerves to the opposite side and looks back at the
   card. `--lit-dir` is the sign of that direction (+1 = key on the right) and
   EVERY asymmetric value below is mirrored through it, so the rim, the pool, the
   face ramp and the cast shadow can never drift onto different edges.

   All of it is soft ALPHA — gradients, masks and box-shadows. No `clip-path` and
   no `filter: blur()`: filters are applied before clipping (so a clip puts
   perfectly hard edges straight back onto a blurred glow), and both `filter` and
   `mix-blend-mode` promote the element to its own composited layer whose
   rectangle seams visibly against the ASCII grid behind it. See
   docs/scroll-3d-architecture.md → "The DOM beam: soft alpha, never
   clip-path + filter". */
.bio-card {
  --lit-dir: 1;
  position: relative;
  /* The lighting layers are `z-index: -1` pseudo-elements: painted above the
     card's own background but below its text, which only holds while the card
     forms a stacking context. `backdrop-filter` and `transform` both do — but
     reduced motion drops the transform, so pin it explicitly instead of
     depending on which of the two happens to be in play. */
  isolation: isolate;
  /* 26vw, not 38: a card hangs off a node ~30% (or ~69%) across the viewport
     with 14px of clearance, so it only has `30% − 14px` to live in. At 38vw it
     needed ~1250px of viewport before it stopped hanging off the edge — which
     is why this looked right on a desktop and was clipped on every tablet and
     small laptop. 26vw is the widest that clears the node at every width the
     zigzag is used at. Nothing changes above ~1354px, where the 22rem cap has
     been the binding term all along. */
  width: min(22rem, 26vw);
  padding: 1rem 1.2rem;
  /* Width comes from the side rules below; the resting rim is a dimmed accent
     that burns up to full when the card is lit. `color-mix(… , transparent)`
     rather than an opacity on the whole card, so only the rim dims. */
  border: 0 solid color-mix(in srgb, var(--accent, #00ff9c) 45%, transparent);
  border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  color: #fff;
  opacity: 0;
  /* Resting: no key, just enough of a drop shadow to sit the card off the scene.
     Same shadow COUNT as the lit state so the two interpolate. */
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent, #00ff9c) 0%, transparent),
    calc(var(--lit-dir) * -6px) 10px 24px -18px rgba(0, 0, 0, 0.75);
  transition: opacity 0.55s ease, transform 0.55s ease, border-color 0.6s ease,
    box-shadow 0.7s ease;
}
.bio-card.left {
  /* Card sits LEFT of the line, so its inner edge — and the head — are to the
     right: the key comes from the right. */
  --lit-dir: 1;
  border-right-width: 3px;
  text-align: right;
  transform: translateX(-24px);
}
.bio-card.right {
  --lit-dir: -1;
  border-left-width: 3px;
  text-align: left;
  transform: translateX(24px);
}
.bio-card.is-visible {
  opacity: 1;
  transform: translateX(0);
}

/* Active: the rim burns up to full accent, the key spills off that edge back
   into the scene, and the card's own shadow is thrown AWAY from it — the
   direction of the shadow sells "lit from over there" more than the glow does. */
.bio-card.is-lit {
  border-color: var(--accent, #00ff9c);
  box-shadow: calc(var(--lit-dir) * 14px) 4px 44px -22px
      color-mix(in srgb, var(--accent, #00ff9c) 70%, transparent),
    calc(var(--lit-dir) * -18px) 20px 40px -24px rgba(0, 0, 0, 0.92);
}
/* A gentle lift, composed onto the entrance offset that `is-visible` has already
   zeroed. Translation only — a scale would resample the prose for the whole time
   the card is the active one. */
.bio-card.is-visible.is-lit {
  transform: translateX(0) translateY(-5px);
}

/* The light POOL: a soft ellipse sitting on the lit edge and spilling past it,
   so the light lands on the scene around the card and not only on the card.
   It spills ONLY toward the lit (inner) side — one card width, ending flush with
   the card's far edge on the other. That is both physically right and the reason
   it cannot add horizontal page overflow: the inner side always points back
   toward the middle of the viewport, and nothing here has `overflow-x: hidden`.
   Consequence worth knowing before retuning: the card's lit edge is at exactly
   50% of this box on BOTH sides, so the gradient positions below mirror for
   free. */
.bio-card::before {
  content: "";
  position: absolute;
  z-index: -1;
  top: -60%;
  bottom: -60%;
  /* dir +1 → left 0 / right -100%; dir -1 → the mirror. */
  left: calc(-50% * (1 - var(--lit-dir)));
  right: calc(-50% * (1 + var(--lit-dir)));
  /* Centred just inside the lit edge and a touch above the pool's middle, so the
     card sits in the top of the light: it arrives from the side AND from above.
     Colour stops never reach the bare `transparent` keyword — that is transparent
     BLACK, which fringes the falloff dark — and never reach zero alpha either,
     since `color-mix(… 0%, transparent)` resolves to exactly that same
     transparent black. The mask below does the fade to nothing instead. */
  background: radial-gradient(
    34% 40% at calc(50% - var(--lit-dir) * 6%) 54%,
    color-mix(in srgb, var(--accent, #00ff9c) 22%, transparent) 0%,
    color-mix(in srgb, var(--accent, #00ff9c) 10%, transparent) 36%,
    color-mix(in srgb, var(--accent, #00ff9c) 3%, transparent) 68%,
    color-mix(in srgb, var(--accent, #00ff9c) 1%, transparent) 92%
  );
  /* Distance falloff, and the reason the pool has no rectangle: it reaches zero
     alpha well inside its own box on every side. Masks read alpha only, so the
     `transparent` keyword is exactly right here and cannot fringe. */
  -webkit-mask-image: radial-gradient(
    37% 43% at calc(50% - var(--lit-dir) * 6%) 54%,
    #000 0 46%,
    rgba(0, 0, 0, 0.42) 74%,
    transparent 100%
  );
  mask-image: radial-gradient(
    37% 43% at calc(50% - var(--lit-dir) * 6%) 54%,
    #000 0 46%,
    rgba(0, 0, 0, 0.42) 74%,
    transparent 100%
  );
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.85s ease;
}
.bio-card.is-lit::before {
  opacity: 1;
}

/* The face RAMP: the same key resolved ON the card — a highlight hugging the lit
   edge and the far edge dropping into shadow. Two background layers in one
   element so the bright half and the dark half can never be tuned apart. Needs
   no mask: unlike the pool it is bounded by the card's own (real, bordered) box,
   so there is no floating rectangle to give away. The dark half interpolates to
   `rgba(0, 0, 0, 0)` on purpose — a shadow really is black, so transparent black
   is the correct end of that ramp.
   Left partly on when the card is not the active one: an unlit card is still a
   solid object with a near and a far side, just not one anything is pointed at. */
.bio-card::after {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
      110% 90% at calc(50% + var(--lit-dir) * 54%) 6%,
      color-mix(in srgb, var(--accent, #00ff9c) 20%, transparent) 0%,
      color-mix(in srgb, var(--accent, #00ff9c) 7%, transparent) 34%,
      color-mix(in srgb, var(--accent, #00ff9c) 1%, transparent) 74%
    ),
    /* → 65deg when the key is on the right, 295deg when it is on the left: the
       shadow always gathers in the corner facing away from it. DIAGONAL on
       purpose — a purely horizontal ramp reads as a two-tone card cut down the
       middle, while a diagonal one pooling in the far-BOTTOM corner reads as a
       surface lit from above and to one side. */
      linear-gradient(
        calc(180deg - var(--lit-dir) * 115deg),
        rgba(0, 0, 0, 0.4) 0%,
        rgba(0, 0, 0, 0.14) 46%,
        rgba(0, 0, 0, 0) 86%
      );
  opacity: 0.34;
  pointer-events: none;
  transition: opacity 0.65s ease;
}
.bio-card.is-lit::after {
  opacity: 1;
}

.bio-loc {
  font-family: "Courier New", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--accent, #00ff9c);
  margin: 0 0 0.35rem;
  /* Zero-blur placeholder so the lit state has something to interpolate from. */
  text-shadow: 0 0 0 color-mix(in srgb, var(--accent, #00ff9c) 0%, transparent);
  transition: text-shadow 0.6s ease;
}
.bio-card.is-lit .bio-loc {
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent, #00ff9c) 45%, transparent);
}
.bio-sub {
  font-size: 0.82rem;
  opacity: 0.7;
  margin: 0 0 0.5rem;
  transition: opacity 0.5s ease;
}
.bio-prose :deep(h2),
.bio-prose :deep(h1) {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  line-height: 1.2;
}
.bio-prose :deep(p) {
  font-size: 0.9rem;
  line-height: 1.5;
  opacity: 0.85;
  margin: 0 0 0.6rem;
  transition: opacity 0.5s ease;
}
.bio-prose :deep(p:last-child) {
  margin-bottom: 0;
}
.bio-prose :deep(strong) {
  color: var(--accent, #00ff9c);
  font-weight: 700;
}
/* The lit card is also the readable one: the light lands on its prose too. */
.bio-card.is-lit .bio-sub {
  opacity: 0.9;
}
.bio-card.is-lit .bio-prose :deep(p) {
  opacity: 1;
}

/* Matches the rail breakpoint in BiographySection — the two have to move
   together, because this block styles the card FOR that layout (rim on the left
   for every card, and the key that follows it). They were 768px while the
   layout that needed them never arrived, which is how the cards ended up lit
   from the wrong side AND off screen.

   Three places now, not two: `BIO_RAIL_MAX_PX` in ./biography.ts mirrors it for
   the head's gaze, which has to aim at the rail rather than at a card side that
   only exists in the data below this width. */
@media (max-width: 1024px) {
  .bio-card {
    /* The rail column (BiographySection) already sets the width by pinning both
       edges, so the card fills it rather than carrying a width of its own —
       which is what keeps it inside the margin at every phone size instead of
       at the two or three a fixed `min()` happens to suit. */
    width: auto;
    text-align: left;
  }
  /* Narrow screens collapse the cluster to one left-aligned reading column and
     move the accent rim to the left edge for every card, so the key has to move
     with it: the lit edge is the one wearing the rim, not the one facing the
     line. Flipping `--lit-dir` re-aims the pool, the ramp and the shadow at once. */
  .bio-card.left {
    --lit-dir: -1;
    text-align: left;
    border-right-width: 0;
    border-left-width: 3px;
  }
  /* Both sides now enter from the SAME side — the rail's. The wide layout slides
     each card in from its own edge, which is right when they alternate; in one
     column the `right` card's +24px was reaching past the margin and adding real
     horizontal page scroll while it was still at opacity 0. Toward the rail also
     reads better here: the cards arrive along the line, not across it. */
  .bio-card.left,
  .bio-card.right {
    transform: translateX(-18px);
  }
  .bio-card.is-visible {
    transform: translateX(0);
  }
  /* Same pool, one card width wide — which is most of a phone screen. Take the
     top off it so it stays light on the scene rather than a colour wash over the
     ASCII head behind. */
  .bio-card.is-lit::before {
    opacity: 0.7;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* Drop the motion, keep the lighting. No slide-in and no lift; the card and
     its key light still cross-fade, since a cross-fade carries no vestibular
     motion and cutting it outright would make six cards pop in and out. */
  .bio-card,
  .bio-card.left,
  .bio-card.right,
  .bio-card.is-visible,
  .bio-card.is-visible.is-lit {
    transform: none;
  }
}
</style>
