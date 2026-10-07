<script setup lang="ts">
const { t } = useI18n();

interface Props {
  scrollProgress?: number;
  fadeOutThreshold?: number; // At what scroll progress should it fade out (0-1)
}

const props = withDefaults(defineProps<Props>(), {
  scrollProgress: 0,
  fadeOutThreshold: 0.1,
});

const opacity = computed(() => {
  if (props.scrollProgress >= props.fadeOutThreshold) {
    return 0;
  }
  return 1 - props.scrollProgress / props.fadeOutThreshold;
});

const isVisible = computed(() => opacity.value > 0);
</script>

<template>
  <div
    v-if="isVisible"
    class="scroll-indicator"
    :style="{ opacity }"
    aria-hidden="true"
  >
    <!-- Pointer: a signal travelling DOWN a rail, the way the page will. -->
    <div class="cue cue-scroll">
      <span class="rail"><span class="packet" /></span>
      <span class="label">{{ t("home.scroll") }}</span>
    </div>

    <!-- Touch: there is no "down" to scroll on a phone, only a thumb pushing
         the page UP — so the cue is that gesture, a fingertip rising in a track. -->
    <div class="cue cue-swipe">
      <span class="track"><span class="tip" /></span>
      <span class="label">{{ t("home.swipe") }}</span>
    </div>
  </div>
</template>

<style scoped>
.scroll-indicator {
  --cue: #00ff9c;
  --cue-dim: color-mix(in srgb, var(--cue) 18%, transparent);
  position: fixed;
  bottom: 40px;
  left: 5%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
  transition: opacity 0.3s ease-out;
  font-family: "Courier New", ui-monospace, monospace;
}

.cue {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.32em;
  /* The tracking trails a space after the last letter; pull it back so the
     word sits centred under the line rather than a quarter-em to the left. */
  margin-right: -0.32em;
  color: color-mix(in srgb, #dfe9ee 75%, transparent);
  animation: label-breathe 2.4s ease-in-out infinite;
}

/* ---- pointer: the rail ---------------------------------------------------- */

.rail {
  position: relative;
  width: 1px;
  height: 64px;
  overflow: hidden;
  background: var(--cue-dim);
}

/* A short lit segment that falls the length of the rail and drains out the
   bottom — a scan line, not a bouncing arrow. */
.packet {
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 22px;
  background: linear-gradient(to bottom, transparent, var(--cue));
  box-shadow: 0 0 6px var(--cue);
  animation: packet-fall 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}

/* ---- touch: the track ----------------------------------------------------- */

.cue-swipe {
  display: none;
}

.track {
  position: relative;
  width: 22px;
  height: 40px;
  border: 1px solid var(--cue-dim);
  border-radius: 11px;
  overflow: hidden;
}

.tip {
  position: absolute;
  left: 50%;
  bottom: 5px;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: 50%;
  background: var(--cue);
  box-shadow: 0 0 8px var(--cue);
  animation: tip-rise 2.4s cubic-bezier(0.33, 0, 0.2, 1) infinite;
}

/* A fading tail under the fingertip, so it reads as a stroke and not a dot
   that teleports. */
.tip::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 3px;
  width: 2px;
  height: 18px;
  margin-left: -1px;
  border-radius: 1px;
  background: linear-gradient(to bottom, var(--cue), transparent);
  opacity: 0.55;
}

/* Choose by input, not width: a narrow desktop window still scrolls with a
   wheel, and a tablet in landscape is still pushed with a thumb. */
@media (hover: none) and (pointer: coarse) {
  .cue-scroll {
    display: none;
  }

  .cue-swipe {
    display: flex;
  }
}

@media (max-width: 768px) {
  .scroll-indicator {
    bottom: 30px;
    /* `left: 5%` minus half the indicator's own width is ~36px in from a
       desktop edge but PAST the edge on a phone — 5% of 375px is 19px, and the
       label is wider than that, so it was cut in half by the viewport. Anchor
       it to the margin directly instead of to a percentage of it. */
    left: 1.1rem;
    transform: none;
  }

  .label {
    font-size: 0.65rem;
  }
}

@keyframes packet-fall {
  0% {
    transform: translateY(-22px);
  }
  70%,
  100% {
    transform: translateY(64px);
  }
}

@keyframes tip-rise {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  60% {
    transform: translateY(-20px);
    opacity: 0;
  }
  100% {
    transform: translateY(-20px);
    opacity: 0;
  }
}

@keyframes label-breathe {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .packet,
  .tip,
  .label {
    animation: none;
  }

  /* Parked where it says the most: lit at the foot of the rail, raised in the
     track. */
  .packet {
    transform: translateY(42px);
  }

  .tip {
    transform: translateY(-12px);
  }
}
</style>
