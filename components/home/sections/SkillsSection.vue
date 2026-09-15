<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useWindowSize } from "@vueuse/core";
import type { Section } from "~/types/section";
import {
  SKILL_CLUSTERS,
  skillDir,
  skillHome,
  skillLit,
  skillNearness,
  skillOffset,
  skillTranslateZ,
  skillTravel,
} from "./skills";

// The skills chapter (mode "bare"): the component owns a sticky, full-viewport
// STAGE inside a tall section, and the four cluster cards FLY THROUGH it — each
// arrives larger than life on top of the viewer, then recedes along the line of
// sight and is swallowed by the head waiting in the background.
//
// The motion is pure depth. Every card keeps ONE fixed position in the stage
// plane for its whole run; only its `translateZ` moves. The stage's
// `perspective-origin` is parked on the face, so the browser's own projection
// makes each card blow up and sail off frame when it is near and converge
// exactly onto the head as it recedes — no path to author, no vanishing point to
// keep in sync. A cone of light swings from the face onto whichever card is on
// the mark — the DOM half of the same beat the 3D key light plays in
// ScrollSpotlights, and the direction the head is turned.
//
// Everything is a pure function of the one scroll signal (store.progress): one
// reactive recompute per scroll tick, no layout reads, no per-card observers
// (issue #4). The flight maths live in ./skills.ts because the head's gaze
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

/** The chapter's own hue, used before the first card and after the last. Each
 *  cluster overrides it while its card is the one on the mark (see `accent`). */
const sectionAccent = computed(() => props.section?.accent ?? "#ffb454");
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
const smoothstep = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

/** Position within this section, 0..1. */
const localFrac = computed(() =>
  clamp01((store.progress - range.value.start) / (range.value.end - range.value.start || 1))
);

// ---- the stage ---------------------------------------------------------------
// `faceY` is the one number that ties the DOM half of this chapter to the 3D
// half: it is where the head sits on screen, and therefore BOTH the point every
// card converges on (`perspective-origin`) and the apex the light cone pivots
// around. One value, one meaning — move the camera and you retune it once.
const stage = useTuning("skillsFlight", "Skills flight", "skills");
const faceY = stage.num("faceY", 70, { min: 40, max: 95, step: 1, label: "Face Y (vh)" });
/** Only affects how strongly the cards' own tilt is foreshortened — the flight
 *  itself is written in apparent size and compensates for whatever this is. */
const perspective = stage.num("perspective", 1100, {
  min: 400,
  max: 2600,
  step: 50,
  label: "Perspective (px)",
});
const dofBlur = stage.num("dof", 7, { min: 0, max: 24, step: 0.5, label: "Near blur (px)" });
const tilt = stage.num("tilt", 17, { min: 0, max: 45, step: 1, label: "Near tilt (deg)" });
/**
 * Dev-only overlay for the two things on this stage you cannot otherwise see.
 *
 *   amber cross-hair   `faceY` — the point every card converges on and the apex
 *                      the light cone pivots around. If the cards do not land on
 *                      the head, this is the number that is wrong.
 *   dots + labels      where each cluster's card sits at LIFE SIZE (scale 1). The
 *                      card's whole flight runs along the line from here to the
 *                      cross-hair, so the spread of these dots is the spread of
 *                      the chapter.
 */
const showHelpers = stage.bool("helpers", false, { label: "Show helpers" });
const isDev = import.meta.dev;

/** Where each card sits at life size, for the helper overlay. */
const helperPoints = computed(() =>
  SKILL_CLUSTERS.map((c, i) => {
    const h = skillHome(i);
    return { id: c.id, label: c.label, accent: c.accent, x: h.x, y: h.y };
  })
);

const stageStyle = computed(() => ({
  "--face-y": `${faceY.value}vh`,
  perspective: `${perspective.value}px`,
  perspectiveOrigin: `50% ${faceY.value}vh`,
}));

// ---- the cards --------------------------------------------------------------
/** Where a card fades in out of the near blur, and where it starts dissolving
 *  into the face. The tail is long: the card should thin out as it arrives
 *  rather than wink out at some arbitrary depth. */
const FADE_IN = 0.1;
const FADE_OUT_FROM = 0.7;
const FADE_OUT_SPAN = 0.28;

const cards = computed(() => {
  const n = SKILL_CLUSTERS.length;
  const frac = localFrac.value;
  const stillNow = still.value;
  const p = perspective.value;
  const maxBlur = dofBlur.value;
  const maxTilt = tilt.value;
  return SKILL_CLUSTERS.map((c, i) => {
    const u = skillTravel(i, n, frac);
    const home = skillHome(i);
    const dir = skillDir(i);
    // `skillOffset` carries the apparent size along with the projected offset —
    // one evaluation of the depth ramp, read by both the transform and the beam.
    const off = skillOffset(i, u);
    const near = skillNearness(off.s);
    const lit = skillLit(u);
    // In out of the blur, out into the face.
    const fade =
      smoothstep(u / FADE_IN) * (1 - smoothstep((u - FADE_OUT_FROM) / FADE_OUT_SPAN));
    // Turned toward the viewer while it is close and off to one side — you are
    // looking at its face, not its edge — and square on by the time it lands.
    // Both angles come off the flight bearing, so a card thrown from the left
    // shows its left flank and one from above shows its underside.
    const rotY = -dir.x * maxTilt * near;
    const rotX = -dir.y * maxTilt * 0.7 * near;
    const roll = dir.x * 4 * near;
    // Depth of field: what is right against the lens is not in focus. Squared,
    // so the card is readable for most of its run and only smears at the end
    // nobody is meant to read.
    const blur = near * near * maxBlur;
    // A card outside its own window still sits at the near end of the ramp,
    // which is exactly where the blur is heaviest — so at opacity 0 it would go
    // on costing a full-frame filtered layer every tick. `hidden` drops it from
    // painting altogether. (Literal union, not `string`: `CSSProperties`
    // narrows `visibility` and a widened `string` will not assign.)
    const visibility = fade < 0.002 ? ("hidden" as const) : ("visible" as const);
    return {
      ...c,
      num: String(i + 1).padStart(2, "0"),
      lit,
      /** Projected offset from the face (vw) — what the beam aims at. */
      offX: off.x,
      // `--accent` is written in BOTH layouts: the still grid has no transform
      // but the cards still need their own colour.
      style: stillNow
        ? { "--accent": c.accent }
        : {
            "--accent": c.accent,
            // Only the Z and the angles change as it flies; the in-plane
            // position is the card's fixed home. The convergence onto the face
            // is the browser's projection, not arithmetic here.
            transform:
              `translate3d(calc(-50% + ${home.x.toFixed(2)}vw), calc(-50% + ${home.y.toFixed(2)}vh), ${skillTranslateZ(off.s, p).toFixed(1)}px)` +
              ` rotateY(${rotY.toFixed(2)}deg)` +
              ` rotateX(${rotX.toFixed(2)}deg)` +
              ` rotateZ(${roll.toFixed(2)}deg)`,
            opacity: fade.toFixed(3),
            visibility,
            "--lit": lit.toFixed(3),
            // The beam's contact point crossing the card, 0..1 — drives the
            // highlight that wipes over the chips as the card passes the light.
            "--sweep": u.toFixed(4),
          },
      // Kept off the slot on purpose: a `filter` is a grouping property, and the
      // slot is the element carrying the 3D transform. Blur the flat card inside
      // it instead, and only when there is something to blur — an always-on
      // `blur(0px)` would give all four cards their own layer for the whole
      // chapter.
      cardStyle: !stillNow && blur > 0.2 ? { filter: `blur(${blur.toFixed(1)}px)` } : undefined,
    };
  });
});

// ---- the beam ---------------------------------------------------------------
// A cone whose apex sits on the face and whose axis swings out to whichever card
// is on the mark — the visible counterpart of the head's turn, and it closes to
// vertical on its own as the card converges. Tunable live in the dev panel (the
// third arg files the group under this scene) and shipped via tuning.config.json.
const tune = useTuning("skillsBeam", "Skills beam", "skills");
/**
 * The cone's ACTUAL opening angle.
 *
 * This used to be a width in vw, which was a dud control: the wedge's shape
 * comes from the conic-gradient, whose stops are TRUE angles measured from the
 * apex and do not care how wide the box is. The box only CLIPPED. At the
 * shipped 46vw the cone was already fully contained, so the entire 35→120 half
 * of the slider did nothing at all, and the half below it cut the cone off with
 * square shoulders rather than narrowing it. Now the angle drives the gradient
 * and the box is solved to contain it (below), so the slider means what it says.
 */
const spreadDeg = tune.num("spread", 44, { min: 6, max: 120, step: 1, label: "Spread (deg)" });
const reach = tune.num("reach", 90, { min: 20, max: 150, step: 1, label: "Reach (vh)" });
const degPerVw = tune.num("degPerVw", 1.1, { min: 0, max: 3, step: 0.05, label: "Swing (deg per vw)" });
const maxDeg = tune.num("maxDeg", 42, { min: 0, max: 80, step: 1, label: "Max swing (deg)" });
const beamOpacity = tune.num("opacity", 0.5, { min: 0, max: 1, step: 0.01, label: "Opacity" });
/**
 * Dev-only overlay for the beam. Unlike the cards, the cone is only on screen
 * while a card is ON THE MARK (its opacity is `lit × opacity`), so for most of
 * the chapter there is nothing to aim these sliders at. This draws the geometry
 * whether it happens to be lit or not:
 *
 *   faint wedge    the opening angle (`spread`) and how far it carries (`reach`).
 *   solid line     the axis right now — where the beam is actually pointing.
 *   dashed lines   the swing limits (`maxDeg`). If the beam never reaches the
 *                  card, this is the number clamping it.
 */
const showBeamHelpers = tune.bool("helpers", false, { label: "Show helpers" });

// The box has to be wide enough to hold the wedge at full reach or the gradient
// clips into square shoulders. vw and vh are different pixel sizes, so this is
// solved against the live aspect rather than assumed.
const { width: winW, height: winH } = useWindowSize();
const beamWidthVw = computed(() => {
  const hPx = (reach.value / 100) * (winH.value || 1);
  const halfPx = hPx * Math.tan(((spreadDeg.value / 2) * Math.PI) / 180);
  return (200 * halfPx) / (winW.value || 1);
});

/** The card the light is currently on — the most-lit one. */
const front = computed(() =>
  cards.value.reduce((a, b) => (b.lit > a.lit ? b : a), cards.value[0]!)
);

/** The chapter's live hue: whichever cluster is currently on the mark. Drives the
 *  kicker and the light cone, while each card carries its own — so the whole
 *  frame, DOM and 3D alike, changes register as a cluster arrives. */
const accent = computed(() => front.value?.accent ?? sectionAccent.value);

const beamStyle = computed(() => {
  const f = front.value;
  // The apex is the vanishing point, so the swing is just the card's projected
  // offset from it: wide while the card is out there and large, closing to
  // straight up as it lands on the face.
  const angle = Math.max(-maxDeg.value, Math.min(maxDeg.value, f.offX * degPerVw.value));
  // The gradient stops are handed down as angles off the axis. The bright core
  // keeps the proportion of the cone it always had (7deg of 22), so opening the
  // spread opens the whole cone instead of only its faint outer skirt.
  const outer = spreadDeg.value / 2;
  const inner = outer * (7 / 22);
  return {
    bottom: `${100 - faceY.value}vh`,
    width: `${beamWidthVw.value.toFixed(2)}vw`,
    height: `${reach.value}vh`,
    transform: `translateX(-50%) rotate(${angle.toFixed(2)}deg)`,
    opacity: (f.lit * beamOpacity.value).toFixed(3),
    "--beam-out-a": `${(180 - outer).toFixed(2)}deg`,
    "--beam-in-a": `${(180 - inner).toFixed(2)}deg`,
    "--beam-in-b": `${(180 + inner).toFixed(2)}deg`,
    "--beam-out-b": `${(180 + outer).toFixed(2)}deg`,
  };
});

/** The beam helper's geometry, in the same terms the sliders are written in. */
const beamHelper = computed(() => {
  const f = front.value;
  const angle = Math.max(-maxDeg.value, Math.min(maxDeg.value, f.offX * degPerVw.value));
  const outer = spreadDeg.value / 2;
  return {
    angle,
    max: maxDeg.value,
    reach: reach.value,
    width: beamWidthVw.value,
    spread: spreadDeg.value,
    lit: f.lit,
    label: f.label,
    outA: `${(180 - outer).toFixed(2)}deg`,
    outB: `${(180 + outer).toFixed(2)}deg`,
  };
});
</script>

<template>
  <div class="skills" :style="{ '--accent': accent }">
    <div class="skills-stage" :class="{ 'is-static': still }" :style="stageStyle">
      <header class="skills-heading" :class="{ 'is-visible': entered }">
        <p v-if="section?.subtitle" class="skills-kicker">{{ section.subtitle }}</p>
        <h2 v-if="section?.title" class="skills-title">{{ section.title }}</h2>
      </header>

      <!-- The gaze cone: apex on the face, swinging out to the card on the mark. -->
      <div v-if="!still" class="skills-beam" :style="beamStyle" aria-hidden="true" />

      <!-- Dev-only: the beam's axis, swing limits and opening angle, drawn
           whether or not a card is currently lighting it. -->
      <div
        v-if="isDev && showBeamHelpers && !still"
        class="beam-helpers"
        :style="{
          bottom: `${100 - faceY}vh`,
          height: `${beamHelper.reach}vh`,
          width: `${beamHelper.width.toFixed(2)}vw`,
          '--beam-out-a': beamHelper.outA,
          '--beam-out-b': beamHelper.outB,
        }"
        aria-hidden="true"
      >
        <div
          class="bhlp-wedge"
          :style="{ transform: `rotate(${beamHelper.angle.toFixed(2)}deg)` }"
        />
        <div
          class="bhlp-limit"
          :style="{ transform: `rotate(${(-beamHelper.max).toFixed(2)}deg)` }"
        />
        <div
          class="bhlp-limit"
          :style="{ transform: `rotate(${beamHelper.max.toFixed(2)}deg)` }"
        />
        <div
          class="bhlp-axis"
          :style="{ transform: `rotate(${beamHelper.angle.toFixed(2)}deg)` }"
        />
        <span class="bhlp-read">
          {{ beamHelper.spread }}° cone &middot; aim {{ beamHelper.angle.toFixed(1) }}°
          of ±{{ beamHelper.max }}° &middot; lit {{ beamHelper.lit.toFixed(2) }}
          &middot; {{ beamHelper.label }}
        </span>
      </div>

      <!-- Dev-only: the vanishing point and each card's life-size position. -->
      <div v-if="isDev && showHelpers && !still" class="skills-helpers" aria-hidden="true">
        <div class="hlp-faceline" />
        <div class="hlp-face" />
        <div
          v-for="p in helperPoints"
          :key="p.id"
          class="hlp-home"
          :style="{
            left: `calc(50% + ${p.x.toFixed(2)}vw)`,
            top: `calc(var(--face-y, 70vh) + ${p.y.toFixed(2)}vh)`,
            '--dot': p.accent,
          }"
        >
          <span>{{ p.label }}</span>
        </div>
      </div>

      <ul class="skills-track">
        <li
          v-for="card in cards"
          :key="card.id"
          class="skills-slot"
          :style="card.style"
        >
          <article class="skill-card" :style="card.cardStyle">
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
/* The stage pins for the whole (tall) section, so the cards fly through a held
   frame instead of scrolling up the page with it.

   `perspective` + `perspective-origin` are written inline from the tuning: the
   origin is parked on the face, which is what makes every receding card
   converge exactly onto the head. */
.skills-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
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
  /* The chapter's hue changes as each cluster takes over; ease the swap so the
     kicker never snaps at the crossover. (A custom property cannot transition
     without `@property`, but the `color` that resolves it can.) */
  transition: color 0.6s ease;
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

/* A shaft of light with its apex pinned at the face and `transform-origin`
   there, so the whole cone pivots around it.

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
    color-mix(in srgb, var(--accent) 1%, transparent) var(--beam-out-a, 158deg),
    color-mix(in srgb, var(--accent) 34%, transparent) var(--beam-in-a, 173deg),
    color-mix(in srgb, var(--accent) 80%, transparent) 180deg,
    color-mix(in srgb, var(--accent) 34%, transparent) var(--beam-in-b, 187deg),
    color-mix(in srgb, var(--accent) 1%, transparent) var(--beam-out-b, 202deg)
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

/* The beam's dev overlay. Same box as the beam itself (apex on the face,
   `reach` tall, wide enough to hold the wedge), so every line reads directly
   against the cone it describes. */
.beam-helpers {
  position: absolute;
  left: 50%;
  translate: -50% 0;
  z-index: 41;
  pointer-events: none;
  font-family: "Courier New", monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: rgba(255, 190, 90, 0.9);
}
.beam-helpers > div {
  position: absolute;
  inset: 0;
  transform-origin: 50% 100%;
}
/* The opening angle, as a wedge of the same true angles the gradient uses. */
.bhlp-wedge {
  background: conic-gradient(
    from 180deg at 50% 100%,
    transparent var(--beam-out-a, 158deg),
    rgba(255, 190, 90, 0.14) var(--beam-out-a, 158deg),
    rgba(255, 190, 90, 0.14) var(--beam-out-b, 202deg),
    transparent var(--beam-out-b, 202deg)
  );
}
/* The axis (solid) and the swing limits (dashed): hairline rules standing on
   the apex and rotated. A border rather than a width so they stay 1px. */
.bhlp-axis,
.bhlp-limit {
  left: 50%;
  right: auto;
  width: 0;
  border-left: 1px solid rgba(255, 190, 90, 0.85);
}
.bhlp-limit {
  border-left-style: dashed;
  border-left-color: rgba(255, 190, 90, 0.4);
}
.bhlp-read {
  position: absolute;
  left: 50%;
  bottom: -1.15rem;
  translate: -50% 0;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.55);
  padding: 1px 5px;
  border-radius: 3px;
}

/* Dev helpers: flat, above everything, never interactive. */
.skills-helpers {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  font-family: "Courier New", monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
}
.hlp-faceline {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--face-y, 70vh);
  border-top: 1px dashed rgba(255, 180, 84, 0.45);
}
.hlp-face {
  position: absolute;
  left: 50%;
  top: var(--face-y, 70vh);
  width: 26px;
  height: 26px;
  margin: -13px 0 0 -13px;
  border: 1px solid rgba(255, 180, 84, 0.9);
  border-radius: 50%;
}
.hlp-face::before,
.hlp-face::after {
  content: "";
  position: absolute;
  background: rgba(255, 180, 84, 0.9);
}
.hlp-face::before { left: 50%; top: -8px; width: 1px; height: 42px; }
.hlp-face::after { top: 50%; left: -8px; height: 1px; width: 42px; }
.hlp-home {
  position: absolute;
  width: 9px;
  height: 9px;
  margin: -4px 0 0 -4px;
  border: 1px solid var(--dot);
  border-radius: 50%;
  background: color-mix(in srgb, var(--dot) 35%, transparent);
}
.hlp-home span {
  position: absolute;
  left: 12px;
  top: -4px;
  white-space: nowrap;
  color: var(--dot);
  text-shadow: 0 1px 4px #000;
}

/* `preserve-3d` so the four cards SORT BY DEPTH against each other — with the
   windows overlapping, the one still coming at you has to occlude the one on its
   way out, and no z-index can express that. The track is still flattened as a
   whole into the stage, so its `z-index` is what orders it against the beam and
   the heading. */
.skills-track {
  position: absolute;
  inset: 0;
  z-index: 10;
  margin: 0;
  padding: 0;
  list-style: none;
  transform-style: preserve-3d;
}
/* Anchored on the vanishing point, not the middle of the frame: a card's home
   offset is then written relative to the very point it converges on, so the
   projected offset is exactly `home × scale` — which is the number skills.ts
   hands the gaze, the key light and the backdrop. */
.skills-slot {
  position: absolute;
  left: 50%;
  top: var(--face-y, 70vh);
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
     reads through the lit rim and the sweep highlight instead. (No
     `backdrop-filter` — at this alpha it bought nothing, and it is the one
     effect that would have fought the depth-of-field blur written inline here
     for another composited pass on every card.) */
  background: linear-gradient(160deg, rgba(8, 11, 16, 0.96), rgba(8, 11, 16, 0.88));
  pointer-events: auto;
}
/* The lit rim, faded in by --lit as the card reaches the mark — the card
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
/* The beam's contact point wiping across the card as it flies through the light
   — a reflection, not a decoration. */
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

/* Reduced motion: no flight, no beam — the same four cards, held still.
   `position: static` on the slot drops the vanishing-point anchoring with it. */
.skills-stage.is-static .skills-track {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  place-content: center;
  padding: clamp(7rem, 18vh, 11rem) 1.5rem 2rem;
  overflow-y: auto;
  transform-style: flat;
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
  /* A card's flight is written in vw around a home offset of ±23vw (skills.ts),
     which on a desktop is a small share of the frame and on a phone is most of
     it. At 78vw the card was still ~25% off the edge at the very moment it is
     most lit — the beat meant to be read. The flight itself is not the thing to
     retune (the head's gaze and the key light are generated from that same
     offset, and a mobile-only radius would put them on a card that is no longer
     there), so pull in the only term that is purely presentational: the card's
     own width. It still overruns at the near end, which is deliberate. */
  .skill-card {
    width: min(26rem, 66vw);
    padding: 1.1rem 1.15rem 1.2rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skills-heading {
    transition: none;
  }
}
</style>
