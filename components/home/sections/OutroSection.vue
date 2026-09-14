<script setup lang="ts">
import { computed } from "vue";
import type { Section } from "~/types/section";

// The coda. One job: hand the camera over.
//
// The invitation started life as a token inside the finale's terminal, next to
// the github/respeak links, and it was invisible there — the terminal is dense,
// the tokens all look alike, and a visitor who does not read every line scrolls
// straight past it. So it gets its own screen: the terminal scrolls away, the
// head keeps addressing you, and this arrives in the same place the card was.
//
// The scene behind it is still running (the camera and lights hold their finale
// pose past the last keyframe), so this reads as the end of the piece rather
// than as a page footer.
const props = defineProps<{ section: Section; visible?: boolean }>();

const accent = computed(() => props.section.accent ?? "#00ff9c");

const sceneControl = useSceneControlStore();
/** Mirrors ContactSection's `orbit` command — same two flags, one surface each. */
const enterExplore = () => {
  sceneControl.exploreMode = true;
  sceneControl.cameraControlMode = "orbit";
};
</script>

<template>
  <div class="outro" :class="{ 'is-visible': visible }" :style="{ '--accent': accent }">
    <!-- A camera orbiting a subject, drawn rather than described: the ring is the
         path, the dot is the lens, the pip in the middle is the head. -->
    <div class="outro-glyph" aria-hidden="true">
      <span class="og-ring" />
      <span class="og-ring og-ring-2" />
      <span class="og-core" />
      <span class="og-lens" />
    </div>

    <p class="outro-kicker">{{ section.subtitle }}</p>
    <h2 class="outro-title">{{ section.title }}</h2>
    <p class="outro-prose">
      Everything you just scrolled through is one 3D scene on a fixed lens. Take
      the camera off its rails and look at it from anywhere — the whole run is on
      a scrubber.
    </p>

    <button class="outro-cta" type="button" @click="enterExplore">
      <span class="oc-label">Fly the scene yourself</span>
      <span class="oc-arrow" aria-hidden="true">↗</span>
    </button>

    <p class="outro-note">
      free camera · drag to orbit · scrub the whole timeline · esc to come back
    </p>
  </div>
</template>

<style scoped>
.outro {
  width: 100%;
  font-family: "Courier New", monospace;
  color: #e8fff5;
  text-align: center;
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.outro.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ---- the glyph ------------------------------------------------------------- */
.outro-glyph {
  position: relative;
  width: 5.5rem;
  height: 5.5rem;
  margin: 0 auto 1.4rem;
}
.og-ring {
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, transparent);
  border-radius: 50%;
  /* Squashed and tipped: a circle seen at an angle reads as an orbit, where a
     true circle just reads as a ring. */
  transform: rotateX(68deg);
}
.og-ring-2 {
  inset: 0.9rem;
  border-color: color-mix(in srgb, var(--accent) 22%, transparent);
  transform: rotateX(68deg) rotateZ(38deg);
}
.og-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0.9rem;
  height: 0.9rem;
  translate: -50% -50%;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 70%, transparent);
  box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 55%, transparent);
}
/* The lens travelling the orbit. Offset from the centre by the ring radius, so
   rotating its CONTAINER sweeps it round the path. */
.og-lens {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0.4rem;
  height: 0.4rem;
  margin: -0.2rem 0 0 -0.2rem;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 14px var(--accent);
  animation: og-orbit 7s linear infinite;
}
@keyframes og-orbit {
  from {
    transform: rotate(0deg) translateX(2.75rem) scaleY(0.38) rotate(0deg);
  }
  to {
    transform: rotate(360deg) translateX(2.75rem) scaleY(0.38) rotate(-360deg);
  }
}

/* ---- copy ------------------------------------------------------------------ */
.outro-kicker {
  margin: 0 0 0.5rem;
  font-size: 0.68rem;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent) 80%, #e8fff5);
}
.outro-title {
  margin: 0 0 0.9rem;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  line-height: 1.15;
  font-weight: 700;
  color: #f2fffa;
  text-shadow: 0 0 34px color-mix(in srgb, var(--accent) 30%, transparent);
}
.outro-prose {
  margin: 0 auto 1.8rem;
  max-width: 30rem;
  font-size: 0.92rem;
  line-height: 1.6;
  color: rgba(214, 255, 233, 0.72);
}

/* ---- the button ------------------------------------------------------------ */
.outro-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #031008;
  background: var(--accent);
  border: 0;
  border-radius: 0.5rem;
  padding: 0.85rem 1.6rem;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 60%, transparent),
    0 14px 44px color-mix(in srgb, var(--accent) 26%, transparent);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.outro-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 0 1px var(--accent),
    0 18px 56px color-mix(in srgb, var(--accent) 42%, transparent);
}
.outro-cta:active {
  transform: translateY(0);
}
/* A sheen that crosses the face on hover — the one flourish, and it costs a
   transform rather than a repaint. */
.outro-cta::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 35%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 65%
  );
  translate: -120% 0;
  transition: translate 0.65s cubic-bezier(0.22, 1, 0.36, 1);
}
.outro-cta:hover::after {
  translate: 120% 0;
}
.oc-arrow {
  font-size: 1.1rem;
  line-height: 1;
}

.outro-note {
  margin: 1.1rem 0 0;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: rgba(214, 255, 233, 0.42);
}

@media (prefers-reduced-motion: reduce) {
  .outro {
    transition-duration: 0.01ms;
  }
  .og-lens {
    animation: none;
  }
  .outro-cta::after {
    display: none;
  }
}
</style>
