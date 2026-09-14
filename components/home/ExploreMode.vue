<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { scrollToProgress } from "~/composables/useScrollTimeline";

/**
 * EXPLORE MODE — the finale's `orbit` command.
 *
 * The whole site is one scroll signal driving a 3D scene, but the visitor only
 * ever sees that scene down one fixed lens: the camera is on rails, pointed at
 * the head, close in. Everything built around it — the stack field streaming
 * past, the spotlight rig, the head's gaze meeting each card — is choreography
 * you cannot actually walk around.
 *
 * This unlocks the camera and hands the scroll over to a scrubber, so the scene
 * can be watched from anywhere at any point in its run. Nothing about the
 * choreography changes: it is the SAME `store.progress` the page scroll feeds,
 * just driven by a slider instead of a wheel, which is why every set-piece,
 * light and head pose follows along for free.
 *
 * Scroll is locked while this is open (useScrollTimeline watches the camera
 * mode), so writing `progress` directly here cannot fight ScrollTrigger. On the
 * way out the document is moved to wherever the scrubber ended up, so returning
 * to the page lands you where you were looking rather than snapping back.
 */
const sceneControl = useSceneControlStore();
const store = useSectionsStore();
const { exploreMode } = storeToRefs(sceneControl);

/** How long the auto-tour takes to play the whole scroll, in seconds. */
const TOUR_SECONDS = 80;

const trackEl = ref<HTMLElement | null>(null);
const playing = ref(false);
const scrubbing = ref(false);

const pct = computed(() => store.progress * 100);
const active = computed(() => store.sections[store.activeIndex]);
const accent = computed(() => active.value?.accent ?? "#00ff9c");

/**
 * One band per section, sized by its WEIGHT — the same weights that decide how
 * much scroll each chapter gets, so the bar is a true map of the run rather than
 * n equal thirds. `boundaries` is already the normalised cumulative form.
 */
const segments = computed(() => {
  const bs = store.boundaries;
  return store.sections.map((s, i) => {
    const from = bs[i] ?? 0;
    const to = bs[i + 1] ?? 1;
    return {
      id: s.id,
      // The tick label is the section's ID, not its title. The titles are prose
      // headlines — "Let's build something that holds up" is 35 characters over a
      // 10% band — so they collided with each other and ran off the end of the
      // dock. The ids are chapter KEYS: short, unique, and already how the rest of
      // the codebase refers to these beats. The full title still reads out above.
      key: s.id,
      accent: s.accent || "#00ff9c",
      left: from * 100,
      width: (to - from) * 100,
      active: i === store.activeIndex,
    };
  });
});

/** The fill is the chapters' own colours, banded at the real boundaries — so the
 *  bar reads as the journey and not as a generic progress meter. */
const fillGradient = computed(() => {
  const stops = segments.value.flatMap((s) => [
    `${s.accent} ${s.left.toFixed(2)}%`,
    `${s.accent} ${(s.left + s.width).toFixed(2)}%`,
  ]);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
});

// ---- seeking ---------------------------------------------------------------
const seekTo = (clientX: number) => {
  const el = trackEl.value;
  if (!el) return;
  // One layout read per pointer event, never per frame (issue #4).
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  store.setProgress((clientX - r.left) / r.width);
};

const onPointerDown = (e: PointerEvent) => {
  playing.value = false;
  scrubbing.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  seekTo(e.clientX);
};
const onPointerMove = (e: PointerEvent) => {
  if (scrubbing.value) seekTo(e.clientX);
};
const onPointerUp = (e: PointerEvent) => {
  scrubbing.value = false;
  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
};

const nudge = (d: number) => {
  playing.value = false;
  store.setProgress(store.progress + d);
};
/** Jump to the centre of the next/previous chapter. */
const step = (dir: number) => {
  playing.value = false;
  const i = Math.max(0, Math.min(store.sections.length - 1, store.activeIndex + dir));
  store.setProgress(store.anchors[i] ?? 0);
};

// ---- the auto-tour ---------------------------------------------------------
// A plain rAF that advances one number. Deliberately not a GSAP tween: the
// scrubber has to be able to interrupt it mid-frame, and progress is the single
// source everything else reads — nothing may own it but this.
let raf = 0;
let last = 0;
const tick = (t: number) => {
  if (!playing.value) return;
  const dt = last ? (t - last) / 1000 : 0;
  last = t;
  const next = store.progress + dt / TOUR_SECONDS;
  if (next >= 1) {
    store.setProgress(1);
    playing.value = false;
    return;
  }
  store.setProgress(next);
  raf = requestAnimationFrame(tick);
};
const stopTour = () => {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
};
watch(playing, (on) => {
  stopTour();
  if (!on) return;
  // Replaying from the end is what you almost always want here — you arrive in
  // explore mode FROM the finale, so progress is sitting at 1.
  if (store.progress > 0.995) store.setProgress(0);
  raf = requestAnimationFrame(tick);
});
const togglePlay = () => (playing.value = !playing.value);

// ---- entering / leaving -----------------------------------------------------
const exit = () => {
  playing.value = false;
  const at = store.progress;
  sceneControl.exploreMode = false;
  sceneControl.cameraControlMode = "scroll";
  // After the mode flip: the camera-mode watcher restarts Lenis, and this moves
  // the document to match where the scrubber was left.
  scrollToProgress(at);
};

const onKey = (e: KeyboardEvent) => {
  if (!exploreMode.value) return;
  switch (e.key) {
    case "Escape":
      exit();
      break;
    case "ArrowLeft":
      e.preventDefault();
      nudge(e.shiftKey ? -0.05 : -0.005);
      break;
    case "ArrowRight":
      e.preventDefault();
      nudge(e.shiftKey ? 0.05 : 0.005);
      break;
    case "Home":
      e.preventDefault();
      nudge(-1);
      break;
    case "End":
      e.preventDefault();
      nudge(1);
      break;
    case " ":
      e.preventDefault();
      togglePlay();
      break;
    default:
      break;
  }
};

// Bound only while the overlay is open, so the page keeps its own keys otherwise.
watch(
  exploreMode,
  (on) => {
    if (!import.meta.client) return;
    if (on) window.addEventListener("keydown", onKey);
    else {
      window.removeEventListener("keydown", onKey);
      playing.value = false;
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopTour();
  if (import.meta.client) window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <Transition name="xpl-fade">
    <div v-if="exploreMode" class="xpl" :style="{ '--accent': accent }">
      <!-- Top: what mode you are in, how to fly it, and the way out. -->
      <div class="xpl-top">
        <p class="xpl-badge">
          <span class="xpl-dot" />free camera
        </p>
        <p class="xpl-hint">
          <span>drag</span> orbit <i>·</i> <span>wheel</span> zoom <i>·</i>
          <span>right-drag</span> pan <i>·</i> <span>esc</span> exit
        </p>
        <button class="xpl-exit" type="button" @click="exit">
          return to scroll <span aria-hidden="true">✕</span>
        </button>
      </div>

      <!-- Bottom: the scrubber. Same signal the wheel drives, on a slider. -->
      <div class="xpl-dock">
        <div class="xpl-row">
          <button
            class="xpl-play"
            type="button"
            :aria-label="playing ? 'Pause the tour' : 'Play the tour'"
            @click="togglePlay"
          >
            <span aria-hidden="true">{{ playing ? "❚❚" : "▶" }}</span>
          </button>
          <button
            class="xpl-skip"
            type="button"
            aria-label="Previous chapter"
            @click="step(-1)"
          >
            <span aria-hidden="true">⟨</span>
          </button>
          <button
            class="xpl-skip"
            type="button"
            aria-label="Next chapter"
            @click="step(1)"
          >
            <span aria-hidden="true">⟩</span>
          </button>
          <p class="xpl-chapter">{{ active?.title || "—" }}</p>
          <p class="xpl-pct">{{ pct.toFixed(1) }}%</p>
        </div>

        <div
          ref="trackEl"
          class="xpl-track"
          :class="{ 'is-scrubbing': scrubbing }"
          role="slider"
          tabindex="0"
          aria-label="Scrub the scene"
          :aria-valuenow="Math.round(pct)"
          aria-valuemin="0"
          aria-valuemax="100"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <!-- The chapters, as bands of their own accent. -->
          <div
            v-for="seg in segments"
            :key="seg.id"
            class="xpl-seg"
            :class="{ 'is-active': seg.active }"
            :style="{
              left: `${seg.left}%`,
              width: `${seg.width}%`,
              '--seg': seg.accent,
            }"
          />
          <!-- Travelled so far, in the colours it travelled through. The element
               spans the WHOLE track and is clipped back to the current progress:
               the gradient stops are percentages of the track, so each chapter
               keeps its own band as the fill passes over it, and there is no
               element to measure (a width read here would be a layout read on
               every frame of the tour). -->
          <div
            class="xpl-fill"
            :style="{ background: fillGradient, clipPath: `inset(0 ${100 - pct}% 0 0)` }"
          />
          <div class="xpl-head" :style="{ left: `${pct}%` }">
            <span class="xpl-head-glow" />
          </div>
        </div>

        <div class="xpl-labels" aria-hidden="true">
          <span
            v-for="seg in segments"
            :key="seg.id"
            class="xpl-label"
            :class="{ 'is-active': seg.active }"
            :style="{ left: `${seg.left}%`, width: `${seg.width}%`, '--seg': seg.accent }"
            >{{ seg.key }}</span
          >
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.xpl {
  position: fixed;
  inset: 0;
  z-index: 60;
  /* The overlay is chrome around a scene you are meant to be dragging — only the
     controls themselves may take the pointer. */
  pointer-events: none;
  font-family: "Courier New", monospace;
  color: #e8fff5;
}
.xpl button,
.xpl-track {
  pointer-events: auto;
}

/* ---- top bar --------------------------------------------------------------- */
.xpl-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(180deg, rgba(2, 8, 6, 0.72), transparent);
}
.xpl-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent, #00ff9c);
}
.xpl-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 10px currentColor;
  animation: xpl-live 2.4s ease-in-out infinite;
}
@keyframes xpl-live {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
.xpl-hint {
  margin: 0;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: rgba(214, 255, 233, 0.5);
}
.xpl-hint span {
  color: rgba(232, 255, 245, 0.92);
  border: 1px solid rgba(232, 255, 245, 0.22);
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  margin-right: 0.15rem;
}
.xpl-hint i {
  font-style: normal;
  opacity: 0.4;
  margin: 0 0.35rem;
}
.xpl-exit {
  margin-left: auto;
  font: inherit;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #e8fff5;
  background: rgba(4, 10, 8, 0.72);
  border: 1px solid rgba(232, 255, 245, 0.28);
  border-radius: 0.35rem;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}
.xpl-exit:hover {
  color: var(--accent, #00ff9c);
  border-color: color-mix(in srgb, var(--accent, #00ff9c) 70%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent, #00ff9c) 28%, transparent);
}

/* ---- the dock -------------------------------------------------------------- */
.xpl-dock {
  position: absolute;
  left: 50%;
  bottom: 1.5rem;
  translate: -50% 0;
  width: min(62rem, calc(100vw - 2.5rem));
  padding: 0.85rem 1.1rem 1rem;
  background: rgba(3, 9, 7, 0.72);
  backdrop-filter: blur(9px);
  border: 1px solid rgba(232, 255, 245, 0.14);
  border-radius: 0.7rem;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
}
.xpl-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.7rem;
}
.xpl-play,
.xpl-skip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  font: inherit;
  font-size: 0.72rem;
  color: var(--accent, #00ff9c);
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--accent, #00ff9c) 40%, transparent);
  border-radius: 0.35rem;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.xpl-play:hover,
.xpl-skip:hover {
  background: color-mix(in srgb, var(--accent, #00ff9c) 16%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent, #00ff9c) 30%, transparent);
}
.xpl-skip {
  color: rgba(232, 255, 245, 0.7);
  border-color: rgba(232, 255, 245, 0.2);
}
.xpl-chapter {
  margin: 0 0 0 0.5rem;
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent, #00ff9c);
  text-shadow: 0 0 18px color-mix(in srgb, var(--accent, #00ff9c) 45%, transparent);
  transition: color 0.5s ease;
}
.xpl-pct {
  margin: 0 0 0 auto;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: rgba(214, 255, 233, 0.55);
}

/* ---- the track ------------------------------------------------------------- */
.xpl-track {
  position: relative;
  height: 1.5rem;
  cursor: pointer;
  touch-action: none; /* the pointer events are the control; don't also pan */
}
.xpl-track:focus-visible {
  outline: 1px solid var(--accent, #00ff9c);
  outline-offset: 3px;
  border-radius: 0.2rem;
}
.xpl-seg {
  position: absolute;
  top: 0.55rem;
  height: 0.4rem;
  background: color-mix(in srgb, var(--seg) 18%, transparent);
  border-radius: 1px;
  /* Hairline gaps at the chapter joins, so the bar reads as a sequence of
     chapters rather than one continuous strip. */
  box-shadow: inset 1px 0 0 rgba(3, 9, 7, 0.9), inset -1px 0 0 rgba(3, 9, 7, 0.9);
  transition: background 0.3s ease, top 0.2s ease, height 0.2s ease;
}
.xpl-seg.is-active {
  top: 0.45rem;
  height: 0.6rem;
  background: color-mix(in srgb, var(--seg) 30%, transparent);
}
.xpl-fill {
  position: absolute;
  top: 0.45rem;
  left: 0;
  right: 0;
  height: 0.6rem;
  border-radius: 1px;
  filter: saturate(1.25)
    drop-shadow(0 0 10px color-mix(in srgb, var(--accent, #00ff9c) 45%, transparent));
  pointer-events: none;
}
.xpl-head {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px solid var(--accent, #00ff9c);
  pointer-events: none;
  transition: border-color 0.5s ease;
}
.xpl-head::after {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  width: 0.55rem;
  height: 0.55rem;
  translate: -50% -50%;
  rotate: 45deg;
  background: var(--accent, #00ff9c);
  box-shadow: 0 0 14px var(--accent, #00ff9c);
  transition: scale 0.18s ease;
}
.xpl-track.is-scrubbing .xpl-head::after {
  scale: 1.35;
}
.xpl-head-glow {
  position: absolute;
  left: 0;
  top: 50%;
  width: 3.5rem;
  height: 3.5rem;
  translate: -50% -50%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent, #00ff9c) 26%, transparent),
    transparent 70%
  );
}

/* ---- chapter labels -------------------------------------------------------- */
.xpl-labels {
  position: relative;
  height: 1rem;
  margin-top: 0.15rem;
}
/* Clipped to its own band: centring on the segment MIDPOINT let neighbouring
   labels overlap wherever two short sections met, and let the last one hang off
   the right edge of the dock. Confining each to its band makes both impossible
   by construction — a band too narrow for its word gets an ellipsis instead. */
.xpl-label {
  position: absolute;
  top: 0;
  padding: 0 0.25rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(214, 255, 233, 0.32);
  transition: color 0.3s ease, text-shadow 0.3s ease;
}
.xpl-label.is-active {
  color: var(--seg);
  text-shadow: 0 0 14px color-mix(in srgb, var(--seg) 55%, transparent);
}

/* ---- transitions ----------------------------------------------------------- */
.xpl-fade-enter-active,
.xpl-fade-leave-active {
  transition: opacity 0.45s ease;
}
.xpl-fade-enter-active .xpl-dock,
.xpl-fade-leave-active .xpl-dock {
  transition: translate 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.xpl-fade-enter-from,
.xpl-fade-leave-to {
  opacity: 0;
}
.xpl-fade-enter-from .xpl-dock,
.xpl-fade-leave-to .xpl-dock {
  translate: -50% 130%;
}

@media (prefers-reduced-motion: reduce) {
  .xpl-dot {
    animation: none;
  }
  .xpl-fade-enter-active,
  .xpl-fade-leave-active,
  .xpl-fade-enter-active .xpl-dock,
  .xpl-fade-leave-active .xpl-dock {
    transition-duration: 0.01ms;
  }
}

/* Narrow screens: the hint is the first thing that can go. */
@media (max-width: 40rem) {
  .xpl-hint {
    display: none;
  }
  .xpl-label {
    font-size: 0.52rem;
  }
  .xpl-chapter {
    font-size: 0.66rem;
    letter-spacing: 0.1em;
  }
}
</style>
