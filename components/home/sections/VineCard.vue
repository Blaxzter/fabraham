<script setup lang="ts">
/**
 * The way through to /projects, hanging off the end of the vine.
 *
 * Three versions got here. It began as a rounded pill pinned to the bottom of
 * the viewport for the whole chapter — a button, in a scene with no buttons in
 * it, floating over the middle of nothing. Then it was a heraldic shield, which
 * fixed the floating and overshot the brief: a coat of arms is a strange thing
 * to find on a vine, and it made the link feel like a trophy rather than a way
 * in. It is now what it always wanted to be — a LABEL, tied to the plant.
 *
 * Which is the one paper object that belongs in a scene like this. The page it
 * opens is a dated, ordered record of everything, and a specimen label is
 * exactly how you catalogue a growing thing: a tie, a couple of ruled lines, a
 * count, a span of years, and where to go next.
 *
 * It hangs by its EYELET, and the eyelet lands on the vine's own last point
 * (`hangPoint`) — not near it, on it. The vine does not pass this on its way
 * somewhere; this is what it grew into.
 *
 * Like the bud cards, everything about its arrival is staged off `--born`,
 * written per frame by the scene: the cord draws itself, the card drops onto
 * it, the rules run across, and the writing arrives last. Nothing here is a CSS
 * transition except the hover, so the whole thing reverses on scroll-up.
 */
defineProps<{
  count: number;
  /** Earliest and latest year in the record, so the span is never hand-typed. */
  from?: number;
  to?: number;
  accent?: string;
  /** The page is on its way to /projects — see `onHandoff` in ProjectsSection. */
  leaving?: boolean;
}>();
</script>

<template>
  <a
    class="label"
    :class="{ 'is-leaving': leaving }"
    href="/projects"
    :style="{ '--accent': accent || '#00ff9c' }"
  >
    <span class="swing">
      <!-- The tie. The eyelet's centre is the point the scene anchors this whole
           element by, so it lands exactly on the vine's last node — see the
           label's branch of `placeEl` in ProjectVine. -->
      <svg class="tie" viewBox="0 0 40 74" fill="none" aria-hidden="true">
        <circle class="eyelet" cx="20" cy="7" r="5" />
        <path class="cord" pathLength="1" d="M20 12 C 15 26, 25 44, 20 72" />
      </svg>

      <span class="body">
        <!-- The growth that caught on it. Small on purpose: there is a whole
             curtain behind this in the scene, and the job here is only to tie
             the paper to the plant. -->
        <svg class="sprigs" viewBox="0 0 360 126" fill="none" aria-hidden="true">
          <g class="sprig l">
            <path class="stem" d="M170 8 C 130 10, 92 22, 62 48" />
            <path class="leaf" d="M138 12 C 128 2, 112 2, 105 11 C 115 21, 131 21, 138 12 Z" />
            <path class="leaf" d="M104 22 C 96 11, 80 10, 72 19 C 81 30, 97 31, 104 22 Z" />
            <path class="leaf" d="M76 38 C 70 27, 55 25, 47 33 C 55 44, 70 46, 76 38 Z" />
            <path class="curl" d="M62 48 C 53 46, 47 38, 52 32 C 57 27, 64 31, 62 38" />
          </g>
          <g class="sprig r">
            <path class="stem" d="M170 8 C 210 10, 248 22, 278 48" />
            <path class="leaf" d="M202 12 C 212 2, 228 2, 235 11 C 225 21, 209 21, 202 12 Z" />
            <path class="leaf" d="M236 22 C 244 11, 260 10, 268 19 C 259 30, 243 31, 236 22 Z" />
            <path class="leaf" d="M264 38 C 270 27, 285 25, 293 33 C 285 44, 270 46, 264 38 Z" />
            <path class="curl" d="M278 48 C 287 46, 293 38, 288 32 C 283 27, 276 31, 278 38" />
          </g>
        </svg>

        <span class="card">
          <span class="eyebrow">The whole record</span>
          <span class="rule" aria-hidden="true" />
          <span class="count">
            <b>{{ count }}</b>
            <i>projects</i>
          </span>
          <span v-if="from && to" class="span">{{ from }} — {{ to }}</span>
          <span class="rule" aria-hidden="true" />
          <span class="go">
            open the timeline
            <i aria-hidden="true">→</i>
          </span>
        </span>
      </span>

      <!-- The shoot: the stem that keeps going once the visitor has decided.
           `pathLength` is an SVG ATTRIBUTE, not a CSS property — declaring it in
           the stylesheet silently does nothing and the dash values below are
           then read as pixels. Normalising it here is what lets the dash maths
           be written as a fraction. -->
      <svg class="shoot" viewBox="0 0 14 78" fill="none" aria-hidden="true">
        <path pathLength="1" d="M7 0 C 7 24, 2 34, 7 48 C 11 60, 5 68, 7 78" />
      </svg>
    </span>
  </a>
</template>

<style scoped>
.label {
  --born: 1;
  /* How close the vine's sap pulse is to the node this hangs from, 0..1,
     written by the scene — the same channel the bud cards get. */
  --sap: 0;
  display: block;
  position: relative;
  /* Only as wide as the card. This is a fixed-position link over the middle of
     the scene, and every transparent pixel of it is a pixel the free camera in
     explore mode cannot be dragged from. The sprigs overflow it instead, and do
     not take clicks. */
  /* Capped rather than fixed: in the flow fallback this is ordinary content on
     whatever screen the visitor has, and 352px on a 390px phone leaves a 19px
     gutter. The scene's anchor centres on whatever width it resolves to. */
  width: min(352px, calc(100vw - 3rem));
  text-decoration: none;
  color: inherit;
}

/* Everything below the eyelet swings from it — including on hover, where the
   swing is what says "this is hanging, and you can take it". */
.swing {
  display: block;
  transform-origin: 50% 7px;
  animation: sway 8s ease-in-out infinite;
}
.label:hover .swing,
.label:focus-visible .swing { animation-duration: 3s; }
@keyframes sway {
  0%, 100% { rotate: -1.1deg; }
  50% { rotate: 1.1deg; }
}

/* ── The tie ──────────────────────────────────────────────────────────────── */
.tie {
  display: block;
  width: 40px;
  /* Long enough that the label hangs IN the curtain rather than tucked up under
     the node the curtain springs from. */
  height: 74px;
  margin: 0 auto;
  overflow: visible;
  pointer-events: none;
}
.eyelet {
  stroke: var(--accent);
  stroke-width: calc(2.2 + var(--sap) * 1.4);
  fill: #05070a;
  opacity: clamp(0, calc(var(--born) * 3), 1);
}
.cord {
  stroke: var(--accent);
  /* Heavier than it looks like it needs to be: it is drawn across the node's
     own aura, and a 2px line on that pool simply is not there. */
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-dasharray: 1;
  /* Draws itself down from the eyelet before the card ever appears. */
  stroke-dashoffset: clamp(0, calc(1 - var(--born) * 2.4), 1);
  opacity: 0.9;
}

/* ── The card ─────────────────────────────────────────────────────────────── */
/**
 * The ground the label stands out of.
 *
 * It hangs in the middle of a curtain of line art in the same accent, and a
 * translucent panel over that is a panel you read the plant through. This
 * darkens just enough of the foliage behind it for the paper to have a back.
 */
.body::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 150%;
  height: 190%;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    50% 50% at 50% 50%,
    rgba(3, 6, 10, 0.9) 0%,
    rgba(3, 6, 10, 0.6) 46%,
    rgba(3, 6, 10, 0) 74%
  );
  pointer-events: none;
}
.body {
  display: block;
  position: relative;
  margin-top: -8px;
  /* It DROPS onto the cord: a card that fades up in place is a sticker. */
  transform: translateY(calc((var(--born) - 1) * 26px))
    scale(calc(0.8 + 0.2 * clamp(0, calc(var(--born) * 1.6 - 0.6), 1)));
  transform-origin: 50% 0;
  opacity: clamp(0, calc(var(--born) * 2.2 - 0.6), 1);
}
.card {
  display: block;
  position: relative;
  padding: 1.05rem 1.3rem 0.95rem;
  background: rgba(6, 9, 14, 0.95);
  backdrop-filter: blur(6px);
  border: 1px solid
    color-mix(in srgb, var(--accent) calc(42% + var(--sap) * 50%), #17212e);
  border-radius: 2px;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.55),
    0 0 calc(var(--sap) * 26px) color-mix(in srgb, var(--accent) calc(var(--sap) * 45%), transparent);
}
.eyebrow {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent) 70%, #9fb3c4);
}
/* The rules run ACROSS as the card arrives — the same draw-on every line in
   this chapter uses, so even the paper assembles like the plant it hangs in. */
.rule {
  display: block;
  height: 1px;
  margin: 0.5rem 0;
  transform-origin: 0 50%;
  transform: scaleX(clamp(0, calc(var(--born) * 3 - 1.7), 1));
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 60%, transparent),
    color-mix(in srgb, var(--accent) 12%, transparent)
  );
}
.count {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.count b {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: #fff;
  text-shadow: 0 0 20px color-mix(in srgb, var(--accent) 55%, transparent);
}
.count i {
  font-style: normal;
  font-size: 1.15rem;
  font-weight: 600;
  color: #e9f1f8;
}
.span {
  display: block;
  margin-top: 0.15rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  color: #6f8093;
}
.go {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--accent);
}
.go i {
  font-style: normal;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.label:hover .go i,
.label:focus-visible .go i { transform: translateX(5px); }
/* Everything written on it arrives after the paper does. */
.eyebrow,
.count,
.span,
.go { opacity: clamp(0, calc(var(--born) * 3 - 2), 1); }

.label:hover .card,
.label:focus-visible .card { border-color: var(--accent); }
.label:focus-visible { outline: 2px solid var(--accent); outline-offset: 6px; }

/* ── Growth caught on it ──────────────────────────────────────────────────── */
.sprigs {
  position: absolute;
  left: 50%;
  top: -26px;
  width: 360px;
  height: 126px;
  overflow: visible;
  transform: translateX(-50%);
  opacity: calc(var(--born) * var(--born) * 0.9);
  pointer-events: none;
}
.sprigs .stem,
.sprigs .curl {
  stroke: var(--accent);
  stroke-width: 1.6;
  stroke-linecap: round;
}
.sprigs .curl { stroke-width: 1.2; opacity: 0.6; }
.sprigs .leaf {
  fill: color-mix(in srgb, var(--accent) 14%, rgba(4, 9, 13, 0.9));
  stroke: var(--accent);
  stroke-width: 1.2;
  opacity: 0.9;
}
/* They breathe, in opposition, so the pair never reads as one stamped wreath. */
.sprigs .sprig {
  transform-box: view-box;
  transform-origin: 170px 8px;
  animation: rustle 7s ease-in-out infinite;
}
.sprigs .sprig.r { animation-delay: -3.4s; }
@keyframes rustle {
  0%, 100% { rotate: -1.8deg; }
  50% { rotate: 1.8deg; }
}

/* ── The shoot ────────────────────────────────────────────────────────────── */
/* Hangs off the bottom of the card and grows on hover, then runs the rest of
   the way on the click — the same gesture /projects opens with, so the two
   pages read as one plant rather than two screens. */
.shoot {
  position: absolute;
  left: 50%;
  top: calc(100% - 4px);
  width: 14px;
  height: 78px;
  overflow: visible;
  transform: translateX(-50%);
  pointer-events: none;
}
.shoot path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0.85;
  transition: stroke-dashoffset 0.5s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.label:hover .shoot path,
.label:focus-visible .shoot path { stroke-dashoffset: 0.5; }
.label.is-leaving .shoot path {
  stroke-dashoffset: 0;
  transition-duration: 0.26s;
}
.label.is-leaving .body {
  transform: translateY(9px) scale(0.98);
  transition: transform 0.26s ease-in;
}

@media (prefers-reduced-motion: reduce) {
  .swing,
  .sprigs .sprig { animation: none !important; }
  .shoot { display: none; }
  .go i,
  .body { transition: none; }
}
</style>
