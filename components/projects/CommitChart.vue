<script setup lang="ts">
import { computed, ref } from "vue";
import { CLAUDE_INDEX, CLAUDE_WEEK, WEEK_ZERO } from "./eras";

/**
 * Weekly commits across every repository, for the last 52 weeks.
 *
 * Form: discrete week buckets over time, one measure → columns, not an area.
 *
 * Colour: EMPHASIS, not a categorical pair. The obvious choice — the site's
 * blue for "before" and its green for "after" — FAILS the palette validator on
 * both the lightness band and the chroma floor: they are pale UI-text colours,
 * not data marks. The story is a single split anyway, so the weeks from
 * 5 Jun 2026 carry the accent and everything before recedes to a neutral that
 * still clears 3:1 against the surface (#4d6379 → 3.05:1).
 *
 * Marks: rounded data-ends anchored to the baseline, a 2px surface gap between
 * bars, one hairline peak rule (solid — a dashed grid reads as a threshold),
 * selective x labels, and a per-week tooltip.
 *
 * Laid out in CSS rather than computed SVG ON PURPOSE. An SVG needs the
 * container's pixel width before it can place a single bar, which means either
 * measuring on mount — leaving an empty box in the prerendered HTML and a pop
 * on hydration — or a fixed viewBox, which at phone width shrinks the axis
 * labels to 4px. Flex bars with percentage heights need neither: the chart is
 * complete and correct in the static HTML, at every width, before any
 * JavaScript runs. Only the tooltip is an enhancement.
 */
const props = defineProps<{ weekly: number[]; total: number; repos: number }>();

const { t } = useI18n();
const dates = useProjectDates();
const weekDate = (i: number) => new Date(WEEK_ZERO + i * 604800000);
const weekLabel = (i: number) => dates.day(weekDate(i));
/** The Claude Code marker's day, in the page's language. */
const markerDay = computed(() => dates.day(new Date(Date.UTC(2026, 5, 5))));

const max = computed(() => Math.max(1, ...props.weekly));
const peak = computed(() => props.weekly.indexOf(max.value));

const bars = computed(() =>
  props.weekly.map((v, i) => ({
    v,
    live: i >= CLAUDE_INDEX,
    zero: v === 0,
    // Percentage of the plot height, so the bars need no measurement.
    h: v === 0 ? "2px" : `${Math.max(2.5, (v / max.value) * 100)}%`,
  }))
);

const markerLeft = computed(() => `${(CLAUDE_WEEK / 52) * 100}%`);
const ticks = computed(() =>
  [2, 15, 28, 41, 50].map((i, k) => {
    const d = weekDate(i);
    return {
      left: `${((i + 0.5) / 52) * 100}%`,
      // The outer two anchor to the edges so they cannot run off it.
      edge: k === 0 ? "start" : k === 4 ? "end" : "mid",
      label: dates.monthShort(d),
    };
  })
);

const summary = computed(() => {
  const before = props.weekly.slice(0, CLAUDE_INDEX).reduce((a, b) => a + b, 0);
  const after = props.weekly.slice(CLAUDE_INDEX).reduce((a, b) => a + b, 0);
  return t("projects.chart.summary", {
    total: props.total,
    repos: props.repos,
    before,
    weeksBefore: CLAUDE_INDEX,
    marker: markerDay.value,
    after,
    weeksAfter: 52 - CLAUDE_INDEX,
    max: max.value,
    week: weekLabel(peak.value),
  });
});

const hover = ref(-1);
const tipText = computed(() => {
  const i = hover.value;
  if (i < 0) return "";
  const v = props.weekly[i]!;
  return t("projects.chart.tip", { n: v, week: weekLabel(i) }, v);
});
// Past the two-thirds mark the tooltip would hang off the right edge.
const tipFlip = computed(() => hover.value > 34);
</script>

<template>
  <div class="plot">
    <p class="peak-label">{{ t("projects.chart.peak", { n: max, week: weekLabel(peak) }) }}</p>

    <!-- Solid, because it is an annotation, not a gridline. -->
    <div class="marker" :style="{ left: markerLeft }">
      <span>{{ markerDay }}</span>
    </div>

    <div class="bars" role="img" :aria-label="summary" @pointerleave="hover = -1">
      <div class="peak-rule" aria-hidden="true" />
      <div
        v-for="(b, i) in bars"
        :key="i"
        class="bar"
        :class="{ live: b.live, zero: b.zero, on: hover === i }"
        :style="{ height: b.h, '--i': i }"
        @pointerenter="hover = i"
      />
      <div
        v-if="hover >= 0"
        class="tip"
        :class="{ flip: tipFlip }"
        :style="{ left: `${((hover + 0.5) / 52) * 100}%` }"
      >
        {{ tipText }}
      </div>
    </div>

    <div class="axis" aria-hidden="true">
      <span v-for="(t, i) in ticks" :key="i" :class="t.edge" :style="{ left: t.left }">
        {{ t.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.plot { position: relative; padding-top: 20px; }

.bars {
  position: relative;
  display: flex;
  align-items: flex-end;
  /* The 2px surface gap between adjacent marks. */
  gap: 2px;
  height: 96px;
}
.bar {
  flex: 1 1 0;
  min-width: 0;
  /* Rounded at the data end, square at the baseline. */
  border-radius: 3px 3px 0 0;
  background: var(--vp-chart-past, #4d6379);
  transition: filter 0.12s ease;
  /* The 52 weeks come up in order, so the chart plays the year back rather
     than appearing. `backwards` holds each bar flat through its delay, and
     because the collapsed state is where the animation STARTS, the very first
     paint already shows it — there is no moment of full-height bars to blink
     away, which a JS-driven entrance could not avoid on a prerendered page. */
  transform-origin: bottom;
  animation: bar-rise 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) backwards;
  animation-delay: calc(var(--i) * 9ms);
}
@keyframes bar-rise {
  from { transform: scaleY(0); }
}
.bar.live { background: var(--vp-chart-live, #00e88f); }
.bar.zero { opacity: 0.4; }
.bar.on { filter: brightness(1.35); }

.peak-rule {
  position: absolute;
  inset: 0 0 auto 0;
  border-top: 1px solid #243140;
  pointer-events: none;
}
.peak-label {
  animation: chart-fade 0.5s ease 0.52s backwards;
  position: absolute;
  top: 0;
  right: 0;
  margin: 0;
  font-family: var(--vp-mono);
  font-size: 10px;
  line-height: 1.4;
  color: var(--vp-muted);
  pointer-events: none;
}

.marker {
  /* Lands once the bars it annotates have arrived. */
  animation: chart-fade 0.5s ease 0.46s backwards;
  position: absolute;
  top: 12px;
  bottom: 20px;
  width: 1px;
  background: var(--vp-chart-live, #00e88f);
  opacity: 0.6;
  pointer-events: none;
}
.marker span {
  position: absolute;
  top: -12px;
  left: 5px;
  font-family: var(--vp-mono);
  font-size: 10px;
  white-space: nowrap;
  color: var(--vp-chart-live, #00e88f);
}

@keyframes chart-fade {
  from { opacity: 0; }
}

.axis { position: relative; height: 20px; }
.axis span {
  position: absolute;
  top: 4px;
  transform: translateX(-50%);
  font-family: var(--vp-mono);
  font-size: 10px;
  white-space: nowrap;
  color: var(--vp-muted);
}
.axis span.start { left: 0 !important; transform: none; }
.axis span.end { left: auto !important; right: 0; transform: none; }

.tip {
  position: absolute;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  z-index: 5;
  pointer-events: none;
  background: #05070a;
  border: 1px solid var(--vp-line-hi);
  border-radius: 3px;
  padding: 0.3rem 0.5rem;
  font-family: var(--vp-mono);
  font-size: 0.66rem;
  color: var(--vp-ink);
  white-space: nowrap;
  box-shadow: 0 10px 26px -14px #000;
}
.tip.flip { transform: translateX(-100%); }

@media (prefers-reduced-motion: reduce) {
  .bar,
  .peak-label,
  .marker { animation: none; transition: none; }
}
</style>
