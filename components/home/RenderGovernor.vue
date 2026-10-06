<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { useLoop } from "@tresjs/core";

/**
 * Steps the render quality down on a GPU that cannot keep up.
 *
 * A tier is a guess made before a frame is drawn (see `useRenderQuality`). It
 * can tell a software rasteriser from a GPU; it cannot tell a GPU that will
 * hold 60 from an integrated one driving a 4K panel. This watches what actually
 * happens and walks the ladder there: three quarters of the pixel ratio, then
 * half, then half the frame rate.
 *
 * The hard part is not noticing that frames are slow, it is knowing that fewer
 * PIXELS would help. Frames are also slow when the page is busy (a long style
 * recalc, a chapter with hundreds of draw calls), and cutting the resolution
 * for that makes the picture worse and the frame no faster. Two checks:
 *
 *   1. Before a step: was the main thread free? Each frame's main-thread time
 *      is measured from the frame's own start to a task posted behind it, which
 *      covers every animation callback plus the style and paint that follow.
 *      Frames that are late while the main thread sat idle for most of them are
 *      waiting on the GPU. Frames that are late and busy are not ours to fix.
 *   2. After a step: did it help? If the frame time has not come down, the
 *      limit was something else (a 30 Hz display, a browser in energy-saver
 *      mode), so the step is undone and the governor stops for good.
 *
 * It never steps back up on its own account. A device that needed the step once
 * will need it again in the next heavy chapter, and resolution that comes and
 * goes is worse than resolution that is a little lower.
 */
const quality = useRenderQuality();
const bootState = useBootStateStore();

/** One verdict per this much rendered time. */
const WINDOW_MS = 1000;
/** Consecutive slow verdicts before a step. */
const STRIKES = 3;
/** Slow: frames taking this much longer than the cap allows (60 → under ~44). */
const SLOW = 1.35;
/** ...with the main thread busy for less than this share of each. */
const BUSY_SHARE = 0.6;
/** Longer than this is a stall (a tab switch, a collection), not a frame rate. */
const STALL_MS = 250;
/** After a step, let the new buffers allocate before judging anything. */
const SETTLE_MS = 1500;
/** A step has to buy at least this much frame time to be kept. */
const HELPED = 0.92;

let frames = 0;
let elapsedMs = 0;
let busyMs = 0;
let strikes = 0;
let quietUntil = 0;
/** The frame time a step was taken at, while its verdict is still out. */
let trial: number | null = null;
let stopped = false;

// The main thread's share of a frame: from the frame's start to a task queued
// behind it, which runs once the callbacks, style and paint of that frame are
// done. One in flight at a time, so a late one counts as busy rather than lost.
let frameStart = 0;
let pending = false;
const channel = new MessageChannel();
channel.port1.onmessage = () => {
  busyMs += performance.now() - frameStart;
  pending = false;
};

const reset = () => {
  frames = 0;
  elapsedMs = 0;
  busyMs = 0;
};

const { onRender } = useLoop();
onRender(({ delta }) => {
  if (stopped || !quality.adaptive.value) return;
  // Behind the boot screen the main thread is mounting the page; nothing
  // measured there says anything about the scene.
  const booting = bootState.phase !== "init" && bootState.phase !== "complete";
  const now = performance.now();
  const frameMs = delta * 1000;
  if (booting || document.hidden || frameMs > STALL_MS || now < quietUntil) {
    reset();
    return;
  }

  frames++;
  elapsedMs += frameMs;
  if (!pending) {
    pending = true;
    frameStart = Number(document.timeline.currentTime ?? now);
    channel.port2.postMessage(0);
  }
  if (elapsedMs < WINDOW_MS) return;

  const average = elapsedMs / frames;
  const busy = busyMs / frames;
  reset();

  if (trial !== null) {
    if (average > trial * HELPED) {
      quality.stepUp();
      stopped = true;
    }
    trial = null;
    strikes = 0;
    quietUntil = now + SETTLE_MS;
    return;
  }

  const slow = average > (1000 / quality.fps.value) * SLOW && busy < average * BUSY_SHARE;
  strikes = slow ? strikes + 1 : 0;
  if (strikes < STRIKES) return;
  strikes = 0;
  if (quality.stepDown()) {
    trial = average;
    quietUntil = now + SETTLE_MS;
  }
});

onBeforeUnmount(() => {
  channel.port1.onmessage = null;
  channel.port1.close();
});
</script>

<template>
  <!-- Nothing to draw: this exists for its place in the render loop. -->
  <slot />
</template>
