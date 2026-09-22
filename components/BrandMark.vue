<script setup lang="ts">
/**
 * The fabraham.dev mark: the bracket, the `$` whose vertical bar IS the box's
 * left edge, `fa`, and the block cursor. The wordmark is not part of it — the
 * full logo lives in public/logo.svg, which is the same outlines with the word
 * under them.
 *
 * Everything here is a baked outline (scripts in the logo's session turned the
 * JetBrains Mono text into paths), so it renders the same on a machine that
 * has never heard of the font. Ink is `currentColor`, so the mark takes the
 * colour of wherever it sits — the BIOS's phosphor, a header's foreground —
 * and only the cursor keeps its orange, unless `mono` asks it not to.
 *
 * `weight` is for small sizes. At the logo's own proportions the frame stroke
 * is 1.8% of the width, which is right at 400px and gone at 40px; a weight of
 * 2–3 thickens the frame and puts a hairline stroke around the glyphs so the
 * mark still reads next to 14px text. The aspect ratio is 200:86.92.
 */
withDefaults(
  defineProps<{
    /** Accessible name. Without it the mark is decorative (`aria-hidden`). */
    title?: string;
    /** Stroke multiplier for small renderings. 1 = the logo's own weight. */
    weight?: number;
    /** Draw the cursor in `currentColor` instead of orange. */
    mono?: boolean;
  }>(),
  { title: undefined, weight: 1, mono: false }
);

const STROKE = 3.53;
</script>

<template>
  <svg
    viewBox="0 0 200 86.92"
    :role="title ? 'img' : undefined"
    :aria-hidden="title ? undefined : 'true'"
    :style="{ '--mark-cursor': mono ? 'currentColor' : '#fdae52' }"
  >
    <title v-if="title">{{ title }}</title>
    <!-- the box -->
    <rect
      x="31.76"
      y="1.77"
      width="166.47"
      height="83.39"
      fill="none"
      stroke="currentColor"
      :stroke-width="STROKE * weight"
    />
    <!-- the bracket, open to the right -->
    <path
      d="M26.63 85.16L1.77 85.16L1.77 1.77L26.62 1.77"
      fill="none"
      stroke="currentColor"
      :stroke-width="STROKE * weight"
      stroke-linecap="square"
    />
    <!-- $ f a: filled outlines; a hairline stroke emboldens them at small weights -->
    <g
      fill="currentColor"
      :stroke="weight > 1 ? 'currentColor' : 'none'"
      :stroke-width="weight > 1 ? STROKE * (weight - 1) * 0.45 : 0"
      stroke-linejoin="round"
    >
      <path
        d="M33.67 70.68L29.76 70.75C26.44 70.34 23.74 69.59 21.66 68.52C19.58 67.45 17.79 65.73 16.28 63.34C14.76 60.95 13.88 58.04 13.64 54.6L20.31 53.34C20.83 56.91 21.74 59.53 23.04 61.2C24.91 63.56 27.15 64.88 29.76 65.15L29.76 44.01C27.03 43.49 24.24 42.44 21.38 40.84C19.27 39.66 17.64 38.02 16.5 35.93C15.35 33.84 14.78 31.47 14.78 28.81C14.78 24.09 16.45 20.27 19.8 17.34C22.04 15.37 25.36 14.17 29.76 13.73L33.67 13.73C37.53 14.09 40.59 15.23 42.85 17.12C45.76 19.53 47.5 22.84 48.09 27.04L41.23 28.07C40.84 25.47 40.02 23.47 38.78 22.08C37.54 20.69 35.83 19.78 33.67 19.33L33.67 38.48C37.01 39.31 39.23 39.97 40.31 40.43C42.37 41.34 44.06 42.45 45.36 43.75C46.67 45.06 47.67 46.6 48.37 48.4C49.07 50.2 49.42 52.14 49.42 54.23C49.42 58.83 47.96 62.66 45.03 65.74C42.1 68.81 38.32 70.46 33.67 70.68ZM29.76 19.26C27.18 19.65 25.14 20.68 23.65 22.36C22.17 24.03 21.42 26.01 21.42 28.3C21.42 30.56 22.05 32.45 23.32 33.98C24.59 35.5 26.73 36.72 29.76 37.63L29.76 19.26ZM33.67 65.15C36.25 64.83 38.38 63.71 40.07 61.79C41.75 59.87 42.6 57.5 42.6 54.67C42.6 52.26 42 50.32 40.81 48.86C39.61 47.4 37.23 46.09 33.67 44.93L33.67 65.15Z"
      />
      <path
        d="M67.73 76.49L67.73 40.03L53.07 40.03L53.07 33.51L67.73 33.51L67.73 22.74Q67.73 17.04 71.31 13.74Q74.88 10.44 81.12 10.44L95.51 10.44L95.51 16.95L81.12 16.95Q74.97 16.95 74.97 22.74L74.97 33.51L95.51 33.51L95.51 40.03L74.97 40.03L74.97 76.49Z"
      />
      <path
        d="M114.5 77.4Q106.71 77.4 102.28 73.1Q97.85 68.8 97.85 61.92Q97.85 57.4 99.88 54.01Q101.92 50.61 105.54 48.67Q109.16 46.72 113.86 46.72L129.7 46.72L129.7 42.56Q129.7 32.06 118.66 32.06Q113.68 32.06 110.65 34.05Q107.62 36.04 107.35 39.39L100.2 39.39Q100.65 33.51 105.58 29.67Q110.51 25.82 118.66 25.82Q127.43 25.82 132.14 30.16Q136.85 34.51 136.85 42.38L136.85 76.49L129.79 76.49L129.79 67.17L129.7 67.17Q128.97 71.88 124.95 74.64Q120.92 77.4 114.5 77.4ZM116.31 71.24Q122.46 71.24 126.08 68.21Q129.7 65.18 129.7 59.93L129.7 52.42L114.5 52.42Q110.33 52.42 107.71 55Q105.09 57.58 105.09 61.65Q105.09 65.99 108.07 68.62Q111.06 71.24 116.31 71.24Z"
      />
    </g>
    <!-- the cursor -->
    <rect class="mark-cursor" x="147.57" y="10.04" width="37.64" height="66.84" />
  </svg>
</template>

<style scoped>
.mark-cursor {
  fill: var(--mark-cursor);
}
</style>
