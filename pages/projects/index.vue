<script setup lang="ts">
import { computed } from "vue";
import CommitChart from "~/components/projects/CommitChart.vue";
import GrowthBush from "~/components/projects/GrowthBush.vue";
import ProjectsTimeline from "~/components/projects/ProjectsTimeline.vue";
import TimelineSkeleton from "~/components/projects/TimelineSkeleton.vue";
import { INK_LIVE, INK_PAST, WEEK_ZERO } from "~/components/projects/eras";

/**
 * Public work, as one vine.
 *
 * Newest growth at the top and the timeline digging back through it, so
 * scrolling down is going back in time — the B.Sc. marker is the last thing on
 * the page, with nothing under it, because that is the root.
 *
 * The page commits to the dark scene the home page lives in rather than
 * following the colour-mode toggle: a light version of an ASCII-quantised night
 * scene is a different site. Tokens are scoped to `.vp` so nothing leaks into
 * the rest of the app.
 */
// The handoff from the home page's chapter — see assets/css/vine-transition.css.
// `out-in` matters: this page opens by DRAWING its vine, and that draw has to be
// the first motion on screen, not something happening under an outgoing page.
definePageMeta({ pageTransition: { name: "vine", mode: "out-in" } });

const { rows, weekly, totalCommits, repoCount, reachesBack, pending } = useProjectTimeline();

// A direct load has the data inlined in the prerendered payload, so this is
// only ever true for a moment on a client-side navigation in.
const loading = computed(() => pending.value && !rows.value.length);
const stat = (v: number | string) => (loading.value ? "\u2014" : v);

useHead({
  title: "Projects — Frederic Abraham",
  meta: [
    {
      name: "description",
      content:
        "Sixteen public repositories on a timeline, newest first, with real GitHub activity: descriptions, commit subjects, stars and 52-week commit counts.",
    },
  ],
});

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The chart's numbers by month — a table view, so the figures are readable. */
const monthly = computed(() => {
  const out: { key: string; v: number }[] = [];
  weekly.value.forEach((v, i) => {
    const d = new Date(WEEK_ZERO + i * 604800000);
    const key = `${MON[d.getUTCMonth()]} ’${String(d.getUTCFullYear()).slice(2)}`;
    const last = out[out.length - 1];
    if (last && last.key === key) last.v += v;
    else out.push({ key, v });
  });
  return out;
});
</script>

<template>
  <div class="vp">
    <div class="wrap">
      <header class="hero">
        <div class="hero-top">
          <div class="hero-id">
            <p class="eyebrow">Frederic Abraham · public work</p>
            <h1>Everything I have <em>grown</em> in public.</h1>
            <p class="lede">
              {{ loading ? "Sixteen" : repoCount }} public repositories, newest first. Scroll, and the
              vine digs back
              through the work — past Respeak, past the M.Sc. — down to a genetic-algorithm
              library from the last year of the B.Sc.
            </p>
          </div>
          <dl class="hero-stats">
            <div><dt>Repositories</dt><dd>{{ stat(repoCount) }}</dd></div>
            <div><dt>Commits · 52w</dt><dd>{{ stat(totalCommits) }}</dd></div>
            <div><dt>Reaches back</dt><dd>{{ stat(reachesBack) }}</dd></div>
          </dl>
        </div>

        <figure class="canopy">
          <figcaption>
            <h2>My weekly commits · every repository · last 52 weeks</h2>
            <div class="canopy-tools">
              <p class="canopy-key">
                <span><i :style="{ background: INK_PAST }" />before</span>
                <span><i :style="{ background: INK_LIVE }" />after Claude Code</span>
              </p>
              <span class="hint">hover a card · or tap</span>
            </div>
          </figcaption>
          <CommitChart
            v-if="!loading"
            :weekly="weekly"
            :total="totalCommits"
            :repos="repoCount"
          />
          <div v-else class="chart-slot" aria-hidden="true"><span /></div>
          <ClientOnly>
            <GrowthBush v-if="!loading" :weekly="weekly" />
            <div v-else class="bush-slot" />
            <!-- Holds the bush's exact height, so the timeline below it does
                 not jump 132px the moment it mounts. -->
            <template #fallback><div class="bush-slot" /></template>
          </ClientOnly>
        </figure>
      </header>

      <TimelineSkeleton v-if="loading" />
      <ProjectsTimeline v-else :rows="rows" />

      <footer class="foot">
        <p>
          <strong>Note on the data.</strong> {{ repoCount }} repositories across three accounts —
          <code>Blaxzter</code>, <code>johkirche</code> and <code>respeak-io</code>. Everything is
          filtered by who actually wrote it: the chart and every sparkline count <em>my</em> commits
          only, and the two cards marked <em>co-built</em> say so because I am not their main
          author. On that test, <code>lucide-motion-vue</code> (1 commit of 72),
          <code>recap</code> (none) and the <code>JJBGF</code> sites (none) are other people's work
          and are not here, and <code>FAbrahamDev</code>'s three public repos are all forks. Repos
          with a flat bar are genuinely dormant. The <em>Claude Code lands</em> marker is dated from
          the first co-authored commit in this site's own git history (<code>5 Jun 2026</code>).
          Refresh the GitHub half with <code>node scripts/fetch-github-projects.mjs</code>.
        </p>
        <details class="canopy-data">
          <summary>The chart's numbers, by month</summary>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Month</th><th>Commits</th></tr></thead>
              <tbody>
                <tr v-for="m in monthly" :key="m.key"><td>{{ m.key }}</td><td>{{ m.v }}</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        <NuxtLink to="/" class="back">← Back to the scene</NuxtLink>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Scoped to the page. A light theme for an ASCII-quantised night scene would be
   a different site, so this commits to one world and paints every colour. */
.vp {
  --vp-ground: #06080b;
  --vp-ground-2: #080b11;
  --vp-panel: #0d1218;
  --vp-panel-hi: #131b25;
  --vp-line: #1b2430;
  --vp-line-hi: #27333f;
  --vp-ink: #e7eef6;
  --vp-ink-2: #aebbc9;
  --vp-muted: #6f8093;
  --vp-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  /* Emphasis pair for the chart — validated against this surface. */
  --vp-chart-live: #00e88f;
  --vp-chart-past: #4d6379;
  --vp-sans: "Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

  color-scheme: dark;
  min-height: 100vh;
  background: var(--vp-ground);
  color: var(--vp-ink);
  font-family: var(--vp-sans);
  font-size: 15px;
  line-height: 1.55;
  background-image:
    radial-gradient(1200px 700px at 50% -10%, #0c1a14 0%, transparent 70%),
    radial-gradient(900px 600px at 50% 105%, #0b1018 0%, transparent 70%);
  background-attachment: fixed;
}

.wrap { max-width: 1180px; margin: 0 auto; padding-inline: 16px; }

.hero { padding-block: clamp(2.2rem, 7vh, 4rem) 0; }

/* The opening stagger. Every piece animates from its own `from` state, so the
   prerendered first paint is already the start of the animation rather than a
   finished page that has to be hidden to replay it. */
.hero-id > *,
.hero-stats > div,
.canopy > figcaption {
  animation: hero-rise 0.62s cubic-bezier(0.2, 0.9, 0.3, 1) backwards;
}
.hero-id > :nth-child(1) { animation-delay: 0.02s; }
.hero-id > :nth-child(2) { animation-delay: 0.1s; }
.hero-id > :nth-child(3) { animation-delay: 0.19s; }
.hero-stats > :nth-child(1) { animation-delay: 0.24s; }
.hero-stats > :nth-child(2) { animation-delay: 0.3s; }
.hero-stats > :nth-child(3) { animation-delay: 0.36s; }
.canopy > figcaption { animation-delay: 0.4s; }
@keyframes hero-rise {
  from { opacity: 0; transform: translateY(14px); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-id > *,
  .hero-stats > div,
  .canopy > figcaption { animation: none; }
}
.hero-top {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: clamp(1.5rem, 4vw, 3.5rem);
  align-items: end;
}

.eyebrow {
  margin: 0 0 0.9rem;
  font-family: var(--vp-mono);
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #00ff9c;
}
/* The space has to be escaped too — CSS eats a plain one as the hex delimiter. */
.eyebrow::before { content: "\25B8\00A0"; opacity: 0.7; }

h1 {
  margin: 0 0 0.9rem;
  font-size: clamp(2.1rem, 5.6vw, 3.5rem);
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.028em;
  text-wrap: balance;
  max-width: 15ch;
}
h1 em { font-style: normal; color: #00ff9c; }
.lede { margin: 0; max-width: 54ch; color: var(--vp-ink-2); font-size: 0.97rem; }

.hero-stats { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0; }
.hero-stats > div {
  flex: 1 1 7.5rem;
  border: 1px solid var(--vp-line);
  border-radius: 3px;
  background: var(--vp-panel);
  padding: 0.6rem 0.75rem;
}
.hero-stats dt {
  font-family: var(--vp-mono);
  font-size: 0.58rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--vp-muted);
}
.hero-stats dd {
  margin: 0.15rem 0 0;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.canopy { margin: clamp(1.6rem, 4vh, 2.6rem) 0 0; }
.canopy figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1.2rem;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}
.canopy h2 {
  margin: 0;
  font-family: var(--vp-mono);
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vp-ink-2);
}
.canopy-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem 1rem; }
.canopy-key { display: flex; gap: 0.9rem; margin: 0; font-family: var(--vp-mono); font-size: 0.66rem; color: var(--vp-muted); }
.canopy-key span { display: inline-flex; align-items: center; gap: 0.35rem; }
.canopy-key i { width: 9px; height: 9px; border-radius: 1px; display: inline-block; }
.hint { font-family: var(--vp-mono); font-size: 0.7rem; color: var(--vp-muted); letter-spacing: 0.06em; }
/* Both placeholders are the exact height of the thing they stand in for, so
   nothing below them moves when the real one arrives. */
.bush-slot { height: 132px; margin-top: 2px; }
.chart-slot {
  height: 136px;
  padding-top: 20px;
  display: flex;
  align-items: flex-end;
}
.chart-slot span {
  display: block;
  width: 100%;
  height: 96px;
  border-top: 1px solid #243140;
  background: linear-gradient(to top, var(--vp-line) 0%, transparent 62%);
  animation: slot-breathe 1.9s ease-in-out infinite;
}
@keyframes slot-breathe {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.75; }
}
@media (prefers-reduced-motion: reduce) {
  .chart-slot span { animation: none; }
}

.foot {
  border-top: 1px solid var(--vp-line);
  margin-top: 2rem;
  padding-block: 2rem 3.5rem;
  color: var(--vp-muted);
  font-size: 0.82rem;
  max-width: 68ch;
}
.foot code {
  font-family: var(--vp-mono);
  font-size: 0.78rem;
  color: var(--vp-ink-2);
  background: var(--vp-ground-2);
  border: 1px solid var(--vp-line);
  border-radius: 2px;
  padding: 0.05rem 0.3rem;
}
.canopy-data { margin-top: 1.2rem; }
.canopy-data summary {
  font-family: var(--vp-mono);
  font-size: 0.64rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-muted);
  cursor: pointer;
}
.canopy-data summary:focus-visible { outline: 2px solid #00ff9c; outline-offset: 2px; }
.table-scroll { overflow-x: auto; margin-top: 0.5rem; }
.canopy-data table { border-collapse: collapse; font-family: var(--vp-mono); font-size: 0.7rem; }
.canopy-data th,
.canopy-data td {
  text-align: right;
  padding: 0.22rem 0.8rem 0.22rem 0;
  border-bottom: 1px solid var(--vp-line);
  white-space: nowrap;
}
.canopy-data th:first-child,
.canopy-data td:first-child { text-align: left; }
.canopy-data th { color: var(--vp-muted); font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.58rem; }
.canopy-data td { color: var(--vp-ink-2); font-variant-numeric: tabular-nums; }

.back {
  display: inline-block;
  margin-top: 1.4rem;
  font-family: var(--vp-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: #00ff9c;
  text-decoration: none;
}
.back:hover { text-decoration: underline; }

@media (max-width: 1000px) {
  .hero-top { grid-template-columns: 1fr; align-items: start; }
}
</style>
