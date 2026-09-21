<script setup lang="ts">
import { computed } from "vue";
import type { ProjectDoc } from "~/composables/useProjectTimeline";
import { EMERGENTS, MARKS } from "./emergents";

// One project. The card is a fixed skeleton — date, title, spec, prose,
// languages, activity, links — worn differently by every project: the header
// carries a motif drawn from the card's own accent (see the [data-skin] rules
// at the bottom) plus a corner mark, and a set of `emergents` pushes out from
// behind it on hover.
const props = defineProps<{ doc: ProjectDoc }>();

const sum = computed(() => props.doc.spark.reduce((a, b) => a + b, 0));
const items = computed(() => EMERGENTS[props.doc.emergent] ?? []);
const mark = computed(() => MARKS[props.doc.skin] ?? "");

// "Aug 2026" from an ISO date, without pulling in a formatter.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const created = computed(() => {
  const [y, m] = props.doc.date.split("-");
  return `${MON[Number(m) - 1]} ${y}`;
});

/** A dormant repo says so in words rather than showing an unexplained flat bar. */
const dormantSince = computed(() => {
  const then = Date.parse(`${props.doc.pushed}T00:00:00Z`);
  const months = Math.round((Date.now() - then) / (30.44 * 86400000));
  if (months < 18) return `${months} months ago`;
  return `${(months / 12).toFixed(1).replace(".0", "")} years ago`;
});

const spark = computed(() => {
  const data = props.doc.spark;
  const max = Math.max(1, ...data);
  const bw = 3.4;
  const h = 26;
  return {
    viewBox: `0 0 ${data.length * bw} ${h}`,
    bars: data.map((v, i) => {
      const bh = v === 0 ? 1 : Math.max(1.5, (v / max) * (h - 3));
      return {
        x: (i * bw).toFixed(2),
        y: (h - bh).toFixed(2),
        w: (bw - 1).toFixed(2),
        h: bh.toFixed(2),
        fill: v === 0 ? "#2a3340" : props.doc.accent,
        // The most recent eight weeks read loudest; zero weeks stay ghosted.
        opacity: v === 0 ? 0.22 : i >= data.length - 8 ? 0.95 : 0.5,
      };
    }),
  };
});
</script>

<template>
  <!-- The emergents and the corner mark are authored markup from
       ./emergents.ts: our own strings, never user input and never HTML
       authored in content. v-html is the right tool for them, so the rule is
       off for this template rather than silenced case by case. -->
  <!-- eslint-disable vue/no-v-html -->
  <div class="cardwrap">
    <!-- Sits BELOW the card in the stacking order: that is what makes the
         items look like they come out from behind it. -->
    <div class="emergents" :data-kind="doc.emergent" aria-hidden="true">
      <div
        v-for="(e, i) in items"
        :key="i"
        class="em"
        :style="{ '--lx': e.lx, '--tx': e.tx, '--ty': e.ty, '--tr': e.tr, '--d': e.d }"
        v-html="e.h"
      />
    </div>

    <article class="card" :data-skin="doc.skin" :style="{ '--accent': doc.accent }">
      <div class="card-hd">
        <span class="card-when">{{ created }}</span>
        <h3>
          {{ doc.title }}
          <span v-if="doc.home" class="pill-live">live</span>
          <span v-if="doc.shared" class="pill-shared">co-built</span>
        </h3>
        <p class="spec">{{ doc.spec }}</p>
        <div class="card-mark" :style="{ color: doc.accent }" aria-hidden="true" v-html="mark" />
      </div>

      <div class="card-bd">
        <p class="card-tag">{{ doc.description }}</p>
        <ul class="langs">
          <li v-for="l in doc.langs" :key="l">{{ l }}</li>
        </ul>

        <div class="activity">
          <div class="act-head">
            <span>{{ doc.shared ? "My commits here" : "Recent activity" }}</span>
            <b>{{ sum }} commits · 52w</b>
          </div>
          <svg
            class="spark"
            :viewBox="spark.viewBox"
            preserveAspectRatio="none"
            role="img"
            :aria-label="`${sum} commits over the last 52 weeks`"
          >
            <rect
              v-for="(b, i) in spark.bars"
              :key="i"
              :x="b.x" :y="b.y" :width="b.w" :height="b.h"
              :fill="b.fill" :opacity="b.opacity" rx="0.5"
            />
          </svg>
          <p v-if="doc.note" class="act-note">{{ doc.note }}</p>
          <ul class="commits">
            <template v-if="doc.commits.length">
              <li v-for="(c, i) in doc.commits" :key="i">
                <time>{{ c.date }}</time><span>{{ c.message }}</span>
              </li>
            </template>
            <li v-else-if="!doc.note" class="li-dormant">
              <span class="dormant">
                Dormant — last pushed {{ dormantSince }}. Kept public because it is part of the path.
              </span>
            </li>
          </ul>
        </div>

        <div class="card-foot">
          <a class="ghost slug" :href="doc.url" target="_blank" rel="noopener" :title="doc.repo">
            {{ doc.repo }} ↗
          </a>
          <a v-if="doc.home" class="ghost" :href="doc.home" target="_blank" rel="noopener">Live ↗</a>
          <span class="stars" :class="{ has: doc.stars > 0 }">★ {{ doc.stars }}</span>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.cardwrap {
  position: relative;
  width: min(396px, 100%);
  min-width: 0;
}
.cardwrap:hover,
.cardwrap:focus-within,
.cardwrap.is-open {
  z-index: 6;
}

.card {
  --mo: color-mix(in srgb, var(--accent) 13%, transparent);
  --mo-soft: color-mix(in srgb, var(--accent) 7%, transparent);
  position: relative;
  z-index: 2;
  display: block;
  background: var(--vp-panel);
  border: 1px solid var(--vp-line);
  border-radius: 3px;
  overflow: hidden;
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2, 0.9, 0.3, 1),
    border-color 0.3s ease, box-shadow 0.3s ease;
}
.cardwrap:hover .card,
.cardwrap:focus-within .card,
.cardwrap.is-open .card {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--vp-line));
  transform: translateY(-4px);
  box-shadow: 0 18px 40px -22px #000, 0 0 0 1px color-mix(in srgb, var(--accent) 14%, transparent);
}

/* ── Header: where each project gets its own face ───────────────────────── */
.card-hd {
  position: relative;
  overflow: hidden;
  padding: 0.85rem 4.6rem 0.8rem 1.15rem;
  border-bottom: 1px solid var(--vp-line);
  background-color: color-mix(in srgb, var(--accent) 6%, var(--vp-panel));
}
.card-hd::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.75;
  background-image: var(--motif, none);
  background-size: var(--motif-size, auto);
  background-position: var(--motif-pos, 0 0);
  background-repeat: repeat;
}
.card-hd > * {
  position: relative;
  z-index: 1;
}
/* A cut edge on the header, not a decorative rail: it is the only thing on the
   card that says which chapter the project belongs to. */
.card-hd::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 46px;
  height: 2px;
  z-index: 2;
  background: var(--accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 70%, transparent);
}

.card-when {
  font-family: var(--vp-mono);
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vp-muted);
}
.card-hd h3 {
  margin: 0.25rem 0 0.35rem;
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: -0.018em;
  line-height: 1.2;
  text-wrap: balance;
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  flex-wrap: wrap;
}
.pill-live,
.pill-shared {
  font-family: var(--vp-mono);
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border-radius: 100px;
  padding: 0.08rem 0.42rem;
}
.pill-live {
  color: #00ff9c;
  border: 1px solid #16523a;
  background: #07180f;
}
.pill-shared {
  color: var(--vp-ink-2);
  border: 1px solid var(--vp-line-hi);
  background: var(--vp-ground-2);
}
.spec {
  margin: 0;
  font-family: var(--vp-mono);
  font-size: 0.64rem;
  letter-spacing: 0.08em;
  color: var(--accent);
  opacity: 0.92;
}

/* ── Body ───────────────────────────────────────────────────────────────── */
.card-bd { padding: 0.95rem 1.15rem 1rem; }
.card-tag { margin: 0 0 0.85rem; font-size: 0.875rem; color: var(--vp-ink-2); line-height: 1.5; }

.langs { display: flex; flex-wrap: wrap; gap: 0.32rem; margin: 0 0 0.9rem; padding: 0; list-style: none; }
.langs li {
  font-family: var(--vp-mono);
  font-size: 0.66rem;
  color: var(--vp-ink-2);
  border: 1px solid var(--vp-line-hi);
  border-radius: 2px;
  padding: 0.12rem 0.42rem;
  background: var(--vp-ground-2);
}

.activity { border-top: 1px solid var(--vp-line); padding-top: 0.75rem; }
.act-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  font-family: var(--vp-mono);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vp-muted);
  margin-bottom: 0.45rem;
}
.act-head b { color: var(--vp-ink-2); font-weight: 500; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
.spark { display: block; width: 100%; height: 26px; margin-bottom: 0.6rem; }
.act-note { margin: 0 0 0.55rem; font-size: 0.7rem; line-height: 1.45; color: var(--vp-muted); font-style: italic; }

.commits { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.28rem; }
.commits li {
  display: grid;
  grid-template-columns: 4.4rem minmax(0, 1fr);
  gap: 0.5rem;
  font-family: var(--vp-mono);
  font-size: 0.7rem;
  color: var(--vp-ink-2);
  align-items: baseline;
}
.commits time { color: var(--vp-muted); font-variant-numeric: tabular-nums; }
.commits span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.commits li.li-dormant { display: block; }
.commits .dormant { color: var(--vp-muted); font-style: italic; white-space: normal; }

.card-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--vp-line);
}
.ghost {
  font-family: var(--vp-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--vp-ink-2);
  text-decoration: none;
  border: 1px solid var(--vp-line-hi);
  border-radius: 2px;
  padding: 0.25rem 0.55rem;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}
.ghost:hover { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); background: var(--vp-ground-2); }
.ghost:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* One repo name is 97 characters long, so the slug shrinks before its
   neighbours do and keeps the full string in its tooltip. */
.ghost.slug { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stars { margin-left: auto; font-family: var(--vp-mono); font-size: 0.7rem; color: var(--vp-muted); font-variant-numeric: tabular-nums; }
.stars.has { color: #ffd479; }

/* ═══ Skins — the header motif, one per project ═════════════════════════ */
.card[data-skin="cubes"] {
  --motif: linear-gradient(var(--mo) 1px, transparent 1px), linear-gradient(90deg, var(--mo) 1px, transparent 1px);
  --motif-size: 21px 21px;
  --motif-pos: -1px -1px;
}
.card[data-skin="cockpit"] {
  --motif: linear-gradient(90deg, var(--mo) 1px, transparent 1px), linear-gradient(0deg, var(--mo-soft) 1px, transparent 1px);
  --motif-size: 34px 100%, 100% 13px;
}
.card[data-skin="hatch"] {
  --motif: repeating-linear-gradient(135deg, var(--mo) 0 1px, transparent 1px 9px);
}
.card[data-skin="alpha"] {
  --motif: repeating-conic-gradient(var(--mo-soft) 0% 25%, transparent 0% 50%);
  --motif-size: 14px 14px;
}
.card[data-skin="rail"] {
  --motif: linear-gradient(90deg, var(--mo) 1.5px, transparent 1.5px),
    repeating-linear-gradient(0deg, var(--mo-soft) 0 1px, transparent 1px 11px);
  --motif-size: 100% 100%, 22px 11px;
  --motif-pos: 8px 0, 0 0;
}
.card[data-skin="staff"] {
  --motif: repeating-linear-gradient(0deg, transparent 0 9px, var(--mo) 9px 10px);
  --motif-size: 100% 50px;
  --motif-pos: 0 center;
}
.card[data-skin="tests"] {
  --motif: linear-gradient(90deg, var(--mo-soft) 1px, transparent 1px),
    linear-gradient(0deg, var(--mo-soft) 1px, transparent 1px),
    radial-gradient(var(--mo) 1.1px, transparent 1.3px);
  --motif-size: 13px 13px, 13px 13px, 13px 13px;
  --motif-pos: 0 0, 0 0, 6px 6px;
}
.card[data-skin="ascii"] {
  --motif: radial-gradient(var(--mo) 1px, transparent 1.3px);
  --motif-size: 9px 9px;
}
.card[data-skin="archive"] {
  --motif: linear-gradient(90deg, var(--mo) 1px, transparent 1px), linear-gradient(0deg, var(--mo) 1px, transparent 1px);
  --motif-size: 26px 26px;
}
.card[data-skin="scrub"] {
  --motif: repeating-linear-gradient(90deg, var(--mo) 0 1px, transparent 1px 8px);
  --motif-size: 100% 12px;
  --motif-pos: 0 bottom;
}
.card[data-skin="week"] {
  --motif: linear-gradient(90deg, var(--mo) 1px, transparent 1px), linear-gradient(0deg, var(--mo-soft) 1px, transparent 1px);
  --motif-size: 14.2857% 100%, 100% 19px;
}
.card[data-skin="desk"] {
  --motif: repeating-linear-gradient(0deg, transparent 0 13px, var(--mo-soft) 13px 14px),
    linear-gradient(90deg, transparent 0 34px, var(--mo) 34px 35px, transparent 35px);
}
.card[data-skin="paper"] {
  --motif: repeating-linear-gradient(0deg, transparent 0 7px, var(--mo-soft) 7px 8px),
    linear-gradient(90deg, transparent 0 26px, var(--mo) 26px 27px, transparent 27px);
}
.card[data-skin="lattice"] {
  --motif: radial-gradient(var(--mo) 1.4px, transparent 1.6px),
    repeating-linear-gradient(45deg, var(--mo-soft) 0 1px, transparent 1px 17px);
  --motif-size: 17px 17px, auto;
}
.card[data-skin="event"] {
  --motif: linear-gradient(90deg, transparent 0 52px, var(--mo) 52px 78px, transparent 78px),
    linear-gradient(90deg, var(--mo-soft) 1px, transparent 1px),
    linear-gradient(0deg, var(--mo-soft) 1px, transparent 1px);
  --motif-size: 156px 100%, 26px 100%, 100% 17px;
}
.card[data-skin="genome"] {
  --motif: repeating-linear-gradient(90deg, var(--mo) 0 5px, transparent 5px 9px),
    repeating-linear-gradient(0deg, transparent 0 8px, #0b1016 8px 10px);
}

/* ── Corner marks ───────────────────────────────────────────────────────── */
.card-mark {
  position: absolute;
  top: 0.75rem;
  right: 0.85rem;
  z-index: 3;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.card-mark :deep(.mk-grid3) { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5px; width: 32px; height: 32px; padding: 2px; background: #05070a; border-radius: 3px; }
.card-mark :deep(.mk-grid3 i) { border-radius: 1px; }
.card-mark :deep(.mk-ascii) { font-family: var(--vp-mono); font-size: 0.62rem; font-weight: 700; line-height: 1.05; text-align: center; letter-spacing: 0.08em; }
.card-mark :deep(.mk-tag) { font-family: var(--vp-mono); font-size: 0.55rem; border: 1px solid color-mix(in srgb, currentColor 45%, transparent); border-radius: 2px; padding: 0.1rem 0.28rem; background: #05070a; white-space: nowrap; }
.card-mark :deep(.mk-note) { font-size: 1.5rem; line-height: 1; text-shadow: 0 0 12px currentColor; }
.card-mark :deep(.mk-check) { font-size: 1.35rem; line-height: 1; font-weight: 700; }
.card-mark :deep(.mk-split) { display: flex; align-items: center; gap: 2px; }
.card-mark :deep(.mk-split i) { width: 11px; height: 15px; border: 1px solid currentColor; border-radius: 1px; opacity: 0.8; }
.card-mark :deep(.mk-split b) { font-family: var(--vp-mono); font-size: 0.6rem; }
.card-mark :deep(.mk-week) { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; width: 32px; }
.card-mark :deep(.mk-week i) { height: 8px; border: 1px solid color-mix(in srgb, currentColor 40%, transparent); border-radius: 1px; }
.card-mark :deep(.mk-week i.on) { background: currentColor; opacity: 0.75; }
.card-mark :deep(.mk-scrub) { width: 34px; height: 8px; border: 1px solid color-mix(in srgb, currentColor 40%, transparent); border-radius: 100px; overflow: hidden; display: flex; justify-content: flex-end; }
.card-mark :deep(.mk-scrub i) { width: 38%; background: currentColor; opacity: 0.8; }
.card-mark :deep(.mk-paper) { width: 26px; height: 32px; border: 1px solid color-mix(in srgb, currentColor 50%, transparent); border-radius: 1px; background: linear-gradient(-135deg, transparent 0 8px, color-mix(in srgb, currentColor 18%, transparent) 8px) top right / 10px 10px no-repeat, repeating-linear-gradient(0deg, transparent 0 4px, color-mix(in srgb, currentColor 22%, transparent) 4px 5px); }
.card-mark :deep(.mk-tiles) { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; width: 30px; }
.card-mark :deep(.mk-tiles i) { aspect-ratio: 1; border: 1px solid color-mix(in srgb, currentColor 50%, transparent); border-radius: 1px; }
.card-mark :deep(.mk-tiles i.on) { background: color-mix(in srgb, currentColor 30%, transparent); }
.card-mark :deep(.mk-date) { width: 34px; border: 1px solid color-mix(in srgb, currentColor 50%, transparent); border-radius: 2px; overflow: hidden; text-align: center; font-family: var(--vp-mono); background: #05070a; }
.card-mark :deep(.mk-date u) { display: block; text-decoration: none; font-size: 0.4rem; letter-spacing: 0.08em; padding: 1px 0; background: color-mix(in srgb, currentColor 26%, transparent); color: var(--vp-ink); }
.card-mark :deep(.mk-date b) { display: block; font-size: 0.74rem; line-height: 1.3; }
.card-mark :deep(.mk-rows) { display: grid; gap: 3px; width: 32px; }
.card-mark :deep(.mk-rows i) { height: 3px; border-radius: 2px; background: currentColor; opacity: 0.45; }
.card-mark :deep(.mk-rows i:first-child) { opacity: 0.9; }
.card-mark :deep(.mk-sessions) { display: grid; gap: 3px; width: 34px; }
.card-mark :deep(.mk-sessions span) { display: flex; align-items: center; gap: 3px; }
.card-mark :deep(.mk-sessions i) { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.card-mark :deep(.mk-sessions b) { height: 3px; flex: 1; border-radius: 2px; background: currentColor; opacity: 0.35; }
.card-mark :deep(.mk-sessions span.idle) { opacity: 0.35; }
.card-mark :deep(.mk-bits) { display: grid; gap: 2px; }
.card-mark :deep(.mk-bits span) { display: flex; gap: 1.5px; }
.card-mark :deep(.mk-bits i) { width: 4px; height: 6px; background: color-mix(in srgb, currentColor 22%, transparent); border-radius: 0.5px; }
.card-mark :deep(.mk-bits i.on) { background: currentColor; opacity: 0.85; }

/* ── Emergents ──────────────────────────────────────────────────────────── */
.emergents { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.em {
  position: absolute;
  left: var(--lx, 50%);
  top: 6px;
  opacity: 0;
  transform: translate(-50%, 16px) scale(0.45);
  transform-origin: 50% 100%;
  transition: transform 0.6s cubic-bezier(0.18, 1.25, 0.35, 1), opacity 0.35s ease;
}
.cardwrap:hover .em,
.cardwrap:focus-within .em,
.cardwrap.is-open .em {
  opacity: 1;
  transform: translate(calc(-50% + var(--tx, 0px)), var(--ty, -70px)) rotate(var(--tr, 0deg)) scale(1);
  transition-delay: var(--d, 0s);
}

.emergents[data-kind="cubes"] { perspective: 620px; }
.em :deep(.cube) { width: var(--cs); height: var(--cs); }
.em :deep(.cube-inner) {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  animation: cube-spin 7s linear infinite;
  animation-play-state: paused;
}
.cardwrap:hover .em :deep(.cube-inner),
.cardwrap:focus-within .em :deep(.cube-inner),
.cardwrap.is-open .em :deep(.cube-inner) { animation-play-state: running; }
@keyframes cube-spin {
  from { transform: rotateX(-24deg) rotateY(0deg); }
  to { transform: rotateX(-24deg) rotateY(360deg); }
}
.em :deep(.face) {
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
.em :deep(.face i) { border-radius: 1.5px; display: block; }

.em :deep(.chip) {
  font-family: var(--vp-mono);
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: var(--vp-ink);
  background: var(--vp-panel-hi);
  border: 1px solid var(--vp-line-hi);
  border-radius: 2px;
  padding: 0.2rem 0.45rem;
  white-space: nowrap;
  box-shadow: 0 6px 18px -10px #000;
}
.em :deep(.chip.accent) { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.em :deep(.blk) { border-radius: 1.5px; box-shadow: 0 4px 12px -6px #000; }
.em :deep(.glyph) {
  font-family: var(--vp-mono);
  font-weight: 700;
  display: grid;
  place-items: center;
  background: var(--vp-ground-2);
  border: 1px solid var(--vp-line-hi);
  border-radius: 2px;
  box-shadow: 0 6px 18px -10px #000;
}
.em :deep(.note) { font-size: 1.5rem; line-height: 1; text-shadow: 0 0 12px currentColor; }
.em :deep(.frame) {
  background: var(--vp-panel-hi);
  border: 1px solid var(--vp-line-hi);
  border-radius: 2px;
  position: relative;
  box-shadow: 0 6px 18px -10px #000;
}
.em :deep(.frame)::before,
.em :deep(.frame)::after {
  content: "";
  position: absolute;
  left: 2px;
  right: 2px;
  height: 3px;
  background-image: repeating-linear-gradient(90deg, var(--vp-line-hi) 0 3px, transparent 3px 7px);
}
.em :deep(.frame)::before { top: 2px; }
.em :deep(.frame)::after { bottom: 2px; }
.em :deep(.slot) { border-radius: 2px; border: 1px solid var(--vp-line-hi); background: var(--vp-panel-hi); box-shadow: 0 6px 18px -10px #000; }

@media (prefers-reduced-motion: reduce) {
  .card, .em { transition: none !important; }
  .em :deep(.cube-inner) { animation: none !important; transform: rotateX(-24deg) rotateY(-34deg); }
}
</style>
