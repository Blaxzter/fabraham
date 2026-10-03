<script setup lang="ts">
import { computed } from "vue";
import type { BudVessel } from "./projectsTeaser";
import { cube } from "~/components/projects/emergents";

/**
 * One thing growing on the vine.
 *
 * The buds used to be the same 196px plaque three times over, which is
 * how a chapter built around a living plant ended up looking like a dropdown
 * menu with leaves drawn on it. Each bud is now a different ORGAN — see
 * `TEASERS` in ./projectsTeaser.ts for which project grows which and why — and
 * the organ is the project's own argument made in botany:
 *
 *   husk   a ribbed lantern that splits to show a real, scrambled, turning cube
 *   pod    a legume that unzips and lets its sessions out in a row
 *   bloom  petals that open as bezier skeletons and only fill in once they are
 *   pitcher a cup whose lid lifts, a flag rising out of it, and a ball dropping in
 *
 * The staging is the part worth understanding. Nothing here is a CSS
 * transition. `ProjectVine` writes `--born` (0..1) onto this element every
 * frame from the vine's own drawing tip, so a husk splits, a pod unzips and a
 * bloom opens AS THE STEM REACHES THEM — and all three run backwards when the
 * visitor scrolls back up, which a transition cannot do. The only transitions
 * in this file are on hover, which is the one thing here the scroll does not
 * own.
 *
 * Every vessel is drawn standing on its own base, and the scene anchors this
 * element by the point `BUD_ANCHOR_PX` down from its top — that is, by the
 * vessel's foot, not by the card's middle. The bud is where the six-leaf
 * rosette opens (see `ROSETTE` in ProjectVine), so the vessel sits in that
 * collar the way a fruit sits in its calyx, and the name plate hangs below.
 * Anchoring by the middle instead would hang the plant at a different height on
 * the stem depending on whether its plate happened to wrap to two lines.
 */
const props = defineProps<{
  vessel: BudVessel;
  href: string;
  title: string;
  spec: string;
  year: string;
  /** The project's own screenshot, graded and revealed behind the plate on hover. */
  shot?: string;
  accent?: string;
}>();

/**
 * The cube in the husk, built once.
 *
 * Seeded, so it is the same scramble on every render and on the server — a
 * cube that re-scrambles between SSR and hydration is a hydration mismatch
 * wearing six colours.
 */
const CUBE = cube(44, 23);

const tint = computed(() => props.accent || "#00ff9c");

/** The seven petals of the bloom, pre-resolved so the template stays readable. */
const PETALS = 7;
const petals = Array.from({ length: PETALS }, (_, i) => ({
  i,
  /** Where this petal ends up once the bloom is open. */
  deg: (i / PETALS) * 360,
  /** Staggered, so the flower opens petal by petal rather than as one iris. */
  delay: i / (PETALS * 1.6),
}));

/**
 * The pod's seeds, bottom to top — the flock Episko is for.
 *
 * The column stops well above the pod's base: the plate hangs from the bud and
 * covers the bottom of the vessel, so a seed written down there is a seed
 * nobody sees.
 */
const SEEDS = [
  { y: 92, state: "done" },
  { y: 72, state: "run" },
  { y: 52, state: "wait" },
  { y: 32, state: "idle" },
];
</script>

<template>
  <a
    class="bud"
    :class="`is-${vessel}`"
    :href="href"
    target="_blank"
    rel="noopener"
    :style="{ '--accent': tint }"
  >
    <span class="art" aria-hidden="true">
      <!-- ── HUSK ─────────────────────────────────────────────────────────── -->
      <template v-if="vessel === 'husk'">
        <!-- `cube` is a static builder in this repo, the same one /projects
             renders its cubes from — no user input reaches it. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="cube" v-html="CUBE" />
        <svg class="shell" viewBox="0 0 160 124" fill="none" aria-hidden="true">
          <!-- Each half hinges on the base, so `--born` swings them apart from
               the point the vine actually holds them by. -->
          <g class="half l">
            <path
              class="rib main"
              d="M80 120 C 44 112, 26 84, 30 48 C 32 24, 54 8, 80 6"
            />
            <path class="rib" d="M80 120 C 54 106, 44 78, 48 46 C 51 26, 66 12, 80 7" />
            <path class="rib faint" d="M80 120 C 66 104, 62 74, 66 44 C 68 24, 75 14, 80 8" />
          </g>
          <g class="half r">
            <path
              class="rib main"
              d="M80 120 C 116 112, 134 84, 130 48 C 128 24, 106 8, 80 6"
            />
            <path class="rib" d="M80 120 C 106 106, 116 78, 112 46 C 109 26, 94 12, 80 7" />
            <path class="rib faint" d="M80 120 C 94 104, 98 74, 94 44 C 92 24, 85 14, 80 8" />
          </g>
          <!-- The calyx: three sepals folding back off the base, which is what
               makes the husk read as sitting in the rosette rather than on it. -->
          <g class="sepals">
            <path d="M80 121 C 66 122, 56 116, 50 106" />
            <path d="M80 121 C 94 122, 104 116, 110 106" />
            <path d="M80 122 L 80 132" />
          </g>
        </svg>
      </template>

      <!-- ── POD ──────────────────────────────────────────────────────────── -->
      <template v-else-if="vessel === 'pod'">
        <svg class="shell" viewBox="0 0 150 130" fill="none" aria-hidden="true">
          <g class="half l">
            <path
              class="wall"
              d="M75 126 C 52 112, 41 82, 46 50 C 50 24, 63 10, 75 6"
            />
            <!-- The seam's own teeth. They stay put while the walls part, so the
                 pod unzips instead of simply opening. -->
            <path
class="teeth" d="M75 118 L 68 114 M75 100 L 67 96 M75 82 L 67 78
              M75 64 L 68 60 M75 46 L 69 42 M75 28 L 70 25" />
          </g>
          <g class="half r">
            <path
              class="wall"
              d="M75 126 C 98 112, 109 82, 104 50 C 100 24, 87 10, 75 6"
            />
            <path
class="teeth" d="M75 118 L 82 114 M75 100 L 83 96 M75 82 L 83 78
              M75 64 L 82 60 M75 46 L 81 42 M75 28 L 80 25" />
          </g>
          <!-- The seeds: one per session, and one of them is running. -->
          <g
            v-for="(s, i) in SEEDS"
            :key="i"
            class="seed"
            :class="s.state"
            :style="{ '--k': String(i / SEEDS.length) }"
          >
            <circle class="halo" :cx="75" :cy="s.y" r="11" />
            <circle class="core" :cx="75" :cy="s.y" r="6" />
            <line class="bar" :x1="86" :y1="s.y" :x2="118" :y2="s.y" />
          </g>
          <path class="stalk" d="M75 126 L 75 136" />
        </svg>
      </template>

      <!-- ── PITCHER ──────────────────────────────────────────────────────── -->
      <template v-else-if="vessel === 'pitcher'">
        <svg class="shell" viewBox="0 0 150 140" fill="none" aria-hidden="true">
          <path class="stalk" d="M75 134 L 75 140" />
          <!-- Back to front: the inside of the mouth, the far side of the rim,
               the pin and the ball, then the body over all of it and the near
               side of the rim last. That order is the whole trick — the pin
               rises out of a cup rather than standing in front of one, and the
               ball drops INTO it. -->
          <ellipse class="throat" cx="75" cy="46" rx="30" ry="9" />
          <path class="rim far" d="M45 46 A 30 9 0 0 1 105 46" />
          <g class="pin">
            <line class="pole" x1="75" y1="70" x2="75" y2="6" />
            <path class="flag" d="M75 6 L 51 12 L 75 18 Z" />
          </g>
          <g class="putt">
            <g class="putt-x">
              <circle class="ball" cx="8" cy="132" r="4.5" />
            </g>
          </g>
          <path
            class="body"
            d="M45 46 C 40 66, 32 92, 46 116 C 54 128, 66 134, 75 134
               C 84 134, 96 128, 104 116 C 118 92, 110 66, 105 46
               A 30 9 0 0 1 45 46 Z"
          />
          <!-- The veins a real pitcher carries down its front. -->
          <path class="vein" d="M60 58 C 54 80, 56 104, 66 124 M90 58 C 96 80, 94 104, 84 124" />
          <path class="rim near" d="M105 46 A 30 9 0 0 1 45 46" />
          <!-- The lid, hinged at the back on the right. Closed it caps the mouth;
               `--born` swings it up and over, like the real thing. -->
          <path class="lid" d="M44 43 C 50 31, 100 31, 106 43 C 94 49, 56 49, 44 43 Z" />
        </svg>
      </template>

      <!-- ── BLOOM ────────────────────────────────────────────────────────── -->
      <template v-else>
        <svg class="shell" viewBox="0 0 150 142" fill="none" aria-hidden="true">
          <path class="stalk" d="M75 138 C 71 122, 79 108, 75 92" />
          <g class="head">
          <g
            v-for="p in petals"
            :key="p.i"
            class="petal"
            :style="{ '--deg': `${p.deg}deg`, '--d': String(p.delay) }"
          >
            <!-- Drawn as the vector-editor sees it: the outline first, then the
                 anchors and their handles, and the fill only once it is out.
                 LogoLab turns a picture into curves; its flower opens as one. -->
            <path class="blade" d="M75 64 C 90 50, 90 22, 75 8 C 60 22, 60 50, 75 64 Z" />
            <path class="handle" d="M75 8 L 63 8 M75 8 L 87 8" />
            <rect class="anchor" x="71.5" y="4.5" width="7" height="7" />
            <rect class="anchor" x="72.5" y="60.5" width="5" height="5" />
          </g>
          <circle class="eye" cx="75" cy="64" r="10" />
          <circle class="pip" cx="75" cy="64" r="3.5" />
          </g>
        </svg>
      </template>
    </span>

    <!-- The plate. Same type on all three — three projects written three ways
         would read as a broken page rather than as a varied one — but cut a
         different shape per vessel, so nothing about the silhouette repeats. -->
    <span class="plate">
      <span
        v-if="shot"
        class="shot"
        aria-hidden="true"
        :style="{ backgroundImage: `url(${shot})` }"
      />
      <span class="veil" aria-hidden="true" />
      <span class="row">
        <span class="when">{{ year }}</span>
        <span class="seam" aria-hidden="true" />
      </span>
      <span class="name">{{ title }}</span>
      <span class="spec">{{ spec }}</span>
    </span>
  </a>
</template>

<style scoped>
/* The box the vine anchors. Its width is `CARD_WIDTH_PX` — the frame-fit test
   in ./projectsTeaser.ts measures against exactly this number — and the bud
   lands on its centre, which is the seam between the art and the plate. */
.bud {
  --born: 1;
  /* How close the vine's sap pulse is to this bud, 0..1, written by the scene.
     The buds themselves already flare when it passes; this is the same event
     reaching the thing hanging off the bud. */
  --sap: 0;
  display: block;
  position: relative;
  width: 236px;
  text-decoration: none;
  color: inherit;
}
/**
 * The art's box, and the one number this file shares with the scene.
 *
 * `ProjectVine` anchors a card by a point this far down from its top — NOT by
 * its middle — so the vessel's base lands on the bud whatever the plate under
 * it happens to measure. Two-line specs and one-line specs would otherwise put
 * the plant at two different heights on the stem. Keep it in step with
 * `BUD_ANCHOR_PX` in ./projectsTeaser.ts.
 */
.art {
  display: block;
  position: relative;
  height: 104px;
}
/**
 * The ground the vessel stands on.
 *
 * Without it a vessel is line art in the accent, drawn over a vine made of line
 * art in the accent, with the vine's own leaves showing through it — three
 * objects at the same weight in the same colour occupying the same 200px, which
 * reads as a tangle rather than as a thing in a plant. This darkens just enough
 * of the backdrop for the vessel to have an inside.
 */
.art::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -4px;
  width: 216px;
  height: 152px;
  transform: translateX(-50%);
  /* Centred on where all three vessels carry their payload — the cube, the
     seeds, the flower head — which is about 70px above the bud. */
  background: radial-gradient(
    54% 52% at 50% 50%,
    rgba(3, 6, 10, 0.94) 0%,
    rgba(3, 6, 10, 0.72) 48%,
    rgba(3, 6, 10, 0) 76%
  );
  opacity: var(--born);
  pointer-events: none;
}
/* All three vessels are drawn standing on their own base, and all three
   viewBoxes put that base ~97% of the way down — so one offset seats the lot. */
.shell {
  position: absolute;
  left: 50%;
  bottom: -4px;
  width: 168px;
  height: 130px;
  overflow: visible;
  transform: translateX(-50%);
}
/* Every moving part of every vessel turns about a point in the drawing, not
   about its own bounding box — `view-box` is what makes a `transform-origin`
   written in viewBox units mean what it says. */
.shell g,
.shell .petal {
  transform-box: view-box;
}

/* ── Husk ─────────────────────────────────────────────────────────────────── */
.is-husk .rib {
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-linecap: round;
  fill: none;
  opacity: 0.5;
}
/* The outer rib is the SHELL: it gets the weight and, more importantly, a
   near-opaque inside, so the half reads as a piece of husk with a cube behind
   it rather than as one more leaf drawn in outline. */
.is-husk .rib.main {
  stroke-width: calc(2.3 + var(--sap) * 1.4);
  opacity: 1;
  fill: rgba(4, 9, 13, 0.82);
}
.is-husk .rib.faint { opacity: 0.3; fill: none; }
.is-husk .sepals path {
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linecap: round;
  opacity: 0.8;
}
/* The split. 30° each way at full growth is enough to show the whole cube and
   still leave the husk recognisable as one thing that came apart. */
.is-husk .half {
  transform-origin: 80px 120px;
  transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.is-husk .half.l { transform: rotate(calc(var(--born) * -24deg)); }
.is-husk .half.r { transform: rotate(calc(var(--born) * 24deg)); }
.is-husk:hover .half.l,
.is-husk:focus-visible .half.l { transform: rotate(-36deg); }
.is-husk:hover .half.r,
.is-husk:focus-visible .half.r { transform: rotate(36deg); }

/* The cube inside it. Real CSS 3D, the same builder /projects uses. */
.cube {
  position: absolute;
  left: 50%;
  bottom: 42px;
  width: 44px;
  height: 44px;
  perspective: 480px;
  /* Scaled off the same `--born`, so it grows INTO the husk as the husk opens
     rather than being there waiting behind a lid. */
  transform: translate(-50%, 0) scale(calc(0.2 + 0.8 * var(--born)));
  opacity: var(--born);
}
.cube :deep(.cube-inner) {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  animation: cube-spin 14s linear infinite;
}
.is-husk:hover .cube :deep(.cube-inner),
.is-husk:focus-visible .cube :deep(.cube-inner) { animation-duration: 4s; }
@keyframes cube-spin {
  from { transform: rotateX(-22deg) rotateY(0deg); }
  to { transform: rotateX(-22deg) rotateY(360deg); }
}
.cube :deep(.face) {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 1.5px;
  padding: 2px;
  background: #07090b;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px #000;
}
.cube :deep(.face i) { display: block; border-radius: 1.5px; }

/* ── Pod ──────────────────────────────────────────────────────────────────── */
.is-pod .wall {
  stroke: var(--accent);
  stroke-width: 2.2;
  stroke-linecap: round;
  fill: rgba(4, 9, 13, 0.8);
}
/* The pulse arrives and every tooth of the seam lights at once, which is the
   nearest thing a pod has to a heartbeat. */
.is-pod .teeth {
  stroke: var(--accent);
  stroke-width: 1.2;
  stroke-linecap: round;
  opacity: calc(0.45 + var(--sap) * 0.55);
}
.is-pod .stalk {
  stroke: var(--accent);
  stroke-width: 2.2;
  stroke-linecap: round;
  opacity: 0.8;
}
.is-pod .half {
  transform-origin: 75px 126px;
  transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.is-pod .half.l { transform: rotate(calc(var(--born) * -17deg)); }
.is-pod .half.r { transform: rotate(calc(var(--born) * 17deg)); }
.is-pod:hover .half.l,
.is-pod:focus-visible .half.l { transform: rotate(-24deg); }
.is-pod:hover .half.r,
.is-pod:focus-visible .half.r { transform: rotate(24deg); }

/* A seed only shows once the seam above it has actually parted — `--k` is how
   far up the pod it sits, so they come out bottom to top. */
.is-pod .seed {
  transform-origin: 75px 66px;
  opacity: clamp(0, calc((var(--born) - var(--k) * 0.75) * 4), 1);
}
.is-pod .seed .core { fill: var(--accent); opacity: 0.35; }
.is-pod .seed .halo { fill: none; stroke: var(--accent); stroke-width: 1.2; opacity: 0.18; }
.is-pod .seed .bar {
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.3;
  stroke-dasharray: 32;
  stroke-dashoffset: 22;
}
/* The one that is running, and the one that needs you: the two states the whole
   app exists to make legible from across a room. */
.is-pod .seed.run .core { opacity: 1; }
.is-pod .seed.run .halo { opacity: 0.9; animation: ping 2.4s ease-out infinite; }
.is-pod .seed.run .bar { opacity: 0.85; animation: fill 2.8s ease-in-out infinite; }
.is-pod .seed.wait .core { fill: #ffb454; opacity: 0.95; animation: blink 1.6s steps(1) infinite; }
.is-pod .seed.wait .halo { stroke: #ffb454; opacity: 0.4; }
.is-pod .seed.wait .bar { stroke: #ffb454; opacity: 0.4; stroke-dashoffset: 28; }
.is-pod .seed.done .core { opacity: 0.6; }
.is-pod .seed.done .bar { opacity: 0.4; stroke-dashoffset: 0; }
@keyframes ping {
  0% { r: 7; opacity: 0.9; }
  70%, 100% { r: 15; opacity: 0; }
}
@keyframes fill {
  0%, 100% { stroke-dashoffset: 26; }
  50% { stroke-dashoffset: 6; }
}
@keyframes blink {
  0%, 60% { opacity: 0.95; }
  61%, 100% { opacity: 0.25; }
}

/* ── Bloom ────────────────────────────────────────────────────────────────── */
/* The bloom is drawn in a taller viewBox than the other two, so at the shared
   box size its head came out a sixth smaller than the husk's shell. Given its
   own. */
.is-bloom .shell {
  width: 190px;
  height: 148px;
}
.is-bloom .stalk {
  stroke: var(--accent);
  stroke-width: 2.2;
  stroke-linecap: round;
  opacity: 0.85;
}
/* Closed, every petal is folded onto the one above it and barely there; open,
   they have turned to their own angle and grown out. `--d` staggers them, so
   the flower opens petal by petal instead of as one iris. */
.is-bloom .petal {
  transform-origin: 75px 64px;
  --o: clamp(0, calc((var(--born) - var(--d) * 0.55) / 0.45), 1);
  transform: rotate(calc(var(--o) * var(--deg))) scale(calc(0.18 + 0.82 * var(--o)));
  opacity: var(--o);
}
.is-bloom .blade {
  stroke: var(--accent);
  stroke-width: 1.6;
  stroke-linejoin: round;
  paint-order: stroke fill;
  /* The fill arrives LAST, which is the whole conceit: a curve is a skeleton
     until something decides what is inside it. Dark-based rather than a tint of
     the accent, so an open petal has a body the vine cannot be read through. */
  fill: color-mix(in srgb, var(--accent) 17%, rgba(4, 9, 13, 0.94));
  fill-opacity: calc(var(--born) * var(--born));
}
/* The handles and anchors: visible while the petal is still being drawn, gone
   once it is a shape. Brought back on hover, because "show me the curves" is
   the one thing this project is for. */
.is-bloom .handle {
  stroke: #c4a0ff;
  stroke-width: 1;
  opacity: calc(0.85 - 0.7 * var(--born));
}
.is-bloom .anchor {
  fill: #05070a;
  stroke: #c4a0ff;
  stroke-width: 1.2;
  opacity: calc(0.9 - 0.55 * var(--born));
}
.is-bloom:hover .handle,
.is-bloom:focus-visible .handle { opacity: 0.9; }
.is-bloom:hover .anchor,
.is-bloom:focus-visible .anchor { opacity: 1; }
.is-bloom .eye {
  fill: #05070a;
  stroke: var(--accent);
  stroke-width: calc(1.6 + var(--sap) * 1.8);
  opacity: var(--born);
}
.is-bloom .pip {
  fill: var(--accent);
  opacity: var(--born);
  r: calc(3.5px + var(--sap) * 3px);
}
/* The head turns, very slowly — the HEAD, not the whole drawing, or the stalk
   it is standing on turns with it. It is the one part of this chapter with no
   job: a flower that is perfectly still is a diagram of a flower. */
.is-bloom .head {
  transform-origin: 75px 64px;
  animation: bloom-turn 54s linear infinite;
}
.is-bloom:hover .head,
.is-bloom:focus-visible .head { animation-duration: 16s; }
@keyframes bloom-turn {
  from { rotate: 0deg; }
  to { rotate: 360deg; }
}

/* ── Pitcher ──────────────────────────────────────────────────────────────── */
.is-pitcher .shell {
  width: 184px;
  height: 150px;
}
.is-pitcher .stalk,
.is-pitcher .pole {
  stroke: var(--accent);
  stroke-width: 2.2;
  stroke-linecap: round;
}
.is-pitcher .pole { stroke: #c9d3dc; stroke-width: 1.8; }
.is-pitcher .throat { fill: #020305; }
.is-pitcher .body {
  stroke: var(--accent);
  stroke-width: 2.2;
  stroke-linejoin: round;
  fill: rgba(4, 9, 13, 0.92);
}
.is-pitcher .vein {
  stroke: var(--accent);
  stroke-width: 1;
  stroke-linecap: round;
  opacity: 0.35;
}
/* The peristome: the ribbed lip of a real pitcher, drawn as a dashed stroke so
   it reads as ridges rather than as one more outline. The sap thickens it. */
.is-pitcher .rim {
  stroke: var(--accent);
  stroke-width: calc(3.4 + var(--sap) * 1.6);
  stroke-dasharray: 1.6 2.2;
}
.is-pitcher .rim.far { opacity: 0.55; }
.is-pitcher .lid {
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linejoin: round;
  fill: color-mix(in srgb, var(--accent) 14%, rgba(4, 9, 13, 0.94));
  transform-origin: 104px 43px;
  transform: rotate(calc(var(--born) * 118deg));
  transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.is-pitcher:hover .lid,
.is-pitcher:focus-visible .lid { transform: rotate(132deg); }
/* The pin waits under the lid, inside the cup, and comes up once the lid is
   out of the way — so it trails `--born` instead of riding it. */
.is-pitcher .pin {
  --up: clamp(0, calc((var(--born) - 0.35) / 0.55), 1);
  transform: translateY(calc((1 - var(--up)) * 58px));
}
.is-pitcher .flag {
  fill: #ff5a6e;
  transform-origin: 75px 12px;
  animation: flag-wave 2.6s ease-in-out infinite;
}
@keyframes flag-wave {
  0%, 100% { transform: skewY(0deg) scaleX(1); }
  50% { transform: skewY(-6deg) scaleX(0.9); }
}
/* The ball: chipped in from the left over and over, x and y on two nested
   groups so a linear run and an eased rise and fall make a parabola. It only
   starts once the pitcher is open — there is no hole to aim at before that. */
.is-pitcher .putt {
  opacity: clamp(0, calc((var(--born) - 0.8) * 5), 1);
  animation: putt-y 3.6s infinite;
}
.is-pitcher .putt-x { animation: putt-x 3.6s linear infinite; }
.is-pitcher .ball { fill: #f4f6f8; animation: putt-in 3.6s linear infinite; }
.is-pitcher:hover .putt,
.is-pitcher:hover .putt-x,
.is-pitcher:hover .ball,
.is-pitcher:focus-visible .putt,
.is-pitcher:focus-visible .putt-x,
.is-pitcher:focus-visible .ball { animation-duration: 1.8s; }
@keyframes putt-x {
  0% { transform: translateX(0); }
  56%, 100% { transform: translateX(67px); }
}
@keyframes putt-y {
  0% { transform: translateY(0); animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1); }
  28% { transform: translateY(-122px); animation-timing-function: cubic-bezier(0.6, 0, 0.8, 0.4); }
  56% { transform: translateY(-86px); animation-timing-function: ease-in; }
  68%, 100% { transform: translateY(-50px); }
}
@keyframes putt-in {
  0%, 64% { opacity: 1; }
  66%, 100% { opacity: 0; }
}

/* ── The plate ────────────────────────────────────────────────────────────── */
.plate {
  display: block;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin: 0 auto;
  width: 206px;
  padding: 0.5rem 0.75rem 0.6rem;
  background: rgba(6, 9, 14, 0.94);
  backdrop-filter: blur(6px);
  border: 1px solid
    color-mix(in srgb, var(--accent) calc(30% + var(--sap) * 60%), #172131);
  box-shadow: 0 0 calc(var(--sap) * 22px)
    color-mix(in srgb, var(--accent) calc(var(--sap) * 40%), transparent);
  transition: transform 0.3s ease;
  /* Opens with its vessel, from the top edge — it is hanging off the bud. */
  transform-origin: 50% 0;
  transform: scaleY(clamp(0, calc(var(--born) * 2 - 0.6), 1));
}
.plate > * { position: relative; z-index: 1; }
/* A different cut per vessel, so even the silhouettes disagree — and one
   ornament each, because at the size these are actually read a border radius
   is not a difference anyone will notice. */
.plate::after {
  content: "";
  position: absolute;
  pointer-events: none;
}
/* HUSK — a seed packet: clipped corner, and a tear-off rule under the head. */
.is-husk .plate {
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%);
  border-left-width: 3px;
  border-left-color: var(--accent);
}
.is-husk .plate::after {
  left: 0;
  right: 0;
  top: 1.55rem;
  height: 1px;
  background: repeating-linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 55%, transparent) 0 3px,
    transparent 3px 7px
  );
  opacity: 0.6;
}
/* POD — the seam, ticked like the one the pod itself unzipped along. */
.is-pod .plate {
  border-radius: 0 13px 13px 0;
  border-top: 2px solid var(--accent);
  border-left: none;
  padding-left: 0.95rem;
}
.is-pod .plate::after {
  left: 5px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: repeating-linear-gradient(
    180deg,
    var(--accent) 0 4px,
    transparent 4px 9px
  );
  opacity: calc(0.5 + var(--sap) * 0.5);
}
/* BLOOM — a selection box: anchors at the corners, the way a curve is held. */
.is-bloom .plate {
  border-radius: 3px 3px 15px 15px;
  border-bottom-width: 2px;
  border-bottom-color: var(--accent);
}
.is-bloom .plate::after {
  left: 3px;
  right: 3px;
  bottom: 3px;
  height: 7px;
  border-left: 7px solid #c4a0ff;
  border-right: 7px solid #c4a0ff;
  opacity: 0.75;
}
/* PITCHER — a scorecard: a row of hole boxes along the bottom edge. */
.is-pitcher .plate {
  border-radius: 2px;
  border-top: 2px solid var(--accent);
  padding-bottom: 0.95rem;
}
.is-pitcher .plate::after {
  left: 0;
  right: 0;
  bottom: 0;
  height: 7px;
  border-top: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  background: repeating-linear-gradient(
    90deg,
    transparent 0 11px,
    color-mix(in srgb, var(--accent) 45%, transparent) 11px 12px
  );
  opacity: calc(0.6 + var(--sap) * 0.4);
}

.row { display: flex; align-items: center; gap: 0.5rem; }
.when {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  color: #6f8093;
}
.seam {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 45%, transparent),
    transparent
  );
}
.name {
  display: block;
  margin: 0.1rem 0 0.2rem;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.15;
  color: #e9f1f8;
  text-wrap: balance;
}
.spec {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.58rem;
  line-height: 1.35;
  letter-spacing: 0.05em;
  color: var(--accent);
}

/* The real thing, revealed on hover. Captured neutral and graded here, so the
   duotone follows each project's own accent and a re-shoot never has to match a
   treatment by hand. A photograph dropped into this chapter raw would read as a
   sticker: everything else here is neon line work over an ASCII head. */
.shot,
.veil {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0;
  transition: opacity 0.45s ease;
  pointer-events: none;
}
.shot {
  background-size: cover;
  background-position: top left;
  /* Pushed well down, because a screenshot is a picture of a page and pages are
     mostly TEXT — at this size a headline lands straight across the plate's own
     title and both become unreadable. */
  filter: grayscale(1) brightness(0.26) contrast(1.3);
}
.shot::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(4, 6, 10, 0.86) 0%,
    rgba(4, 6, 10, 0.5) 55%,
    rgba(4, 6, 10, 0.82) 100%
  );
}
/* A `color` blend keeps the screenshot's luminance and takes only its hue from
   the accent, which is what makes this a duotone rather than a green wash. */
.veil {
  background: var(--accent);
  mix-blend-mode: color;
}
.bud:hover .shot,
.bud:focus-visible .shot { opacity: 1; }
.bud:hover .veil,
.bud:focus-visible .veil { opacity: 0.45; }
.bud:hover .plate,
.bud:focus-visible .plate { border-color: var(--accent); }
.bud:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }

@media (prefers-reduced-motion: reduce) {
  /* A stopped cube must still be a CUBE. With the spin simply switched off the
     element keeps no transform at all, so all six faces collapse to the one
     facing the lens and the husk appears to be holding a flat grid of squares.
     Park it on a three-quarter view instead — the same pose /projects freezes
     its cubes at. */
  .cube :deep(.cube-inner) { transform: rotateX(-24deg) rotateY(-34deg); }
  .head,
  .flag,
  .putt,
  .putt-x,
  .ball,
  .cube :deep(.cube-inner),
  .seed .halo,
  .seed .bar,
  .seed .core { animation: none !important; }
  /* A ball frozen mid-flight is a ball floating beside the plant. */
  .putt { visibility: hidden; }
  .half,
  .lid,
  .plate,
  .shot,
  .veil { transition: none; }
}
</style>
