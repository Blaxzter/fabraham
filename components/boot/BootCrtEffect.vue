<template>
  <div class="crt-effect-wrapper">
    <!-- Curved screen distortion overlay -->
    <div class="crt-curve-distortion" />

    <!-- Scanlines - horizontal lines between pixels -->
    <div class="crt-scanlines" />

    <!-- Shadow mask / Aperture grille - RGB pixel pattern -->
    <div class="crt-shadow-mask" />

    <!-- Phosphor glow / Bloom effect -->
    <div class="crt-phosphor-glow" />

    <!-- Color bleed / Chromatic aberration -->
    <div class="crt-color-bleed" />

    <!-- Screen edge vignette -->
    <div class="crt-edge-vignette" />

    <!-- Subtle flicker -->
    <div class="crt-flicker" />

    <!-- RGB pixel grid overlay -->
    <div class="crt-rgb-grid" />
  </div>
</template>

<script setup lang="ts">
// Pure CSS-based CRT effect overlay
// All effects are applied via CSS to maintain performance
</script>

<style scoped>
.crt-effect-wrapper {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

/* Curved screen distortion */
.crt-curve-distortion {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 0%,
    rgba(0, 0, 0, 0.05) 70%,
    rgba(0, 0, 0, 0.15) 100%
  );
  /* Simulate barrel distortion with border */
  border-radius: 3% / 2%;
}

/* Enhanced scanlines - horizontal lines between pixels */
.crt-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 1px,
    rgba(0, 0, 0, 0.3) 1px,
    rgba(0, 0, 0, 0.3) 2px
  );
  background-size: 100% 2px;
  z-index: 2;
}

/* Animated scanline sweep */
.crt-scanlines::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(255, 255, 255, 0.03) 48%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.03) 52%,
    transparent 100%
  );
  background-size: 100% 200px;
  animation: scanline-sweep 8s linear infinite;
  opacity: 0.3;
}

@keyframes scanline-sweep {
  0% {
    transform: translateY(-100%);
  }
  100% {
    transform: translateY(100%);
  }
}

/* Shadow mask / Aperture grille - RGB pixel pattern */
.crt-shadow-mask {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    rgba(255, 0, 0, 0.03) 0px,
    rgba(255, 0, 0, 0.03) 1px,
    rgba(0, 255, 0, 0.02) 1px,
    rgba(0, 255, 0, 0.02) 2px,
    rgba(0, 0, 255, 0.03) 2px,
    rgba(0, 0, 255, 0.03) 3px
  );
  background-size: 3px 100%;
  z-index: 3;
  mix-blend-mode: multiply;
  opacity: 0.4;
}

/* Phosphor glow / Bloom effect */
.crt-phosphor-glow {
  position: absolute;
  inset: -20px;
  background: radial-gradient(
    circle at center,
    rgba(0, 255, 0, 0.08) 0%,
    transparent 60%
  );
  filter: blur(20px);
  z-index: 1;
  animation: phosphor-pulse 2s ease-in-out infinite alternate;
}

@keyframes phosphor-pulse {
  0% {
    opacity: 0.3;
  }
  100% {
    opacity: 0.5;
  }
}

/* Color bleed / Chromatic aberration */
.crt-color-bleed {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 30%,
    rgba(255, 0, 0, 0.02) 60%,
    rgba(0, 255, 255, 0.02) 100%
  );
  z-index: 4;
  mix-blend-mode: screen;
}

/* Screen edge vignette - darker edges like real CRTs */
.crt-edge-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 0%,
    transparent 40%,
    rgba(0, 0, 0, 0.2) 70%,
    rgba(0, 0, 0, 0.5) 95%,
    rgba(0, 0, 0, 0.8) 100%
  );
  z-index: 5;
}

/* Subtle flicker - simulates CRT refresh/power fluctuations */
.crt-flicker {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.02);
  z-index: 6;
  animation: crt-flicker 0.15s infinite;
}

@keyframes crt-flicker {
  0% {
    opacity: 0.95;
  }
  10% {
    opacity: 1;
  }
  20% {
    opacity: 0.97;
  }
  30% {
    opacity: 1;
  }
  40% {
    opacity: 0.98;
  }
  50% {
    opacity: 0.96;
  }
  60% {
    opacity: 1;
  }
  70% {
    opacity: 0.99;
  }
  80% {
    opacity: 0.97;
  }
  90% {
    opacity: 1;
  }
  100% {
    opacity: 0.98;
  }
}

/* RGB pixel grid - creates the RGB sub-pixel effect */
.crt-rgb-grid {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.1) 0px,
      rgba(0, 0, 0, 0.1) 1px,
      transparent 1px,
      transparent 2px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 0, 0, 0.02) 0px,
      rgba(255, 0, 0, 0.02) 1px,
      rgba(0, 255, 0, 0.015) 1px,
      rgba(0, 255, 0, 0.015) 2px,
      rgba(0, 0, 255, 0.02) 2px,
      rgba(0, 0, 255, 0.02) 3px
    );
  background-size: 100% 2px, 3px 100%;
  z-index: 7;
  opacity: 0.3;
}

/* Additional screen curvature effect on edges */
.crt-effect-wrapper::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 3% / 2%;
  box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.3),
    inset 0 0 50px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  z-index: 8;
}
</style>
