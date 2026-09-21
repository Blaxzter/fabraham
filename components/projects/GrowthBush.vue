<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { curl, LEAF_PATH, seeded, sideShoot } from "~/lib/vine";
import { CLAUDE_INDEX, INK_LIVE, RAIL_MAX_PX, RAIL_X } from "./eras";

/**
 * The growth under the chart.
 *
 * Not a lawn: the whole page's vine grows DOWNWARD, so this does too — a tangle
 * of strands spilling off the chart's baseline like ivy off a wall, each with
 * its own leaves and tendril. Length and leafiness follow the week directly
 * above each strand, so the curtain is deep over the busy months and barely
 * started over the quiet ones — with a floor everywhere, because this is growth,
 * not a second chart.
 *
 * One strand in the middle is longer than the rest and lands exactly on
 * (cx, height): that is where the vine below picks it up.
 *
 * Nothing sways. Hanging growth would have to swing from where it attaches, and
 * a rigid rotation about that point lifts the far strands clean off the chart
 * edge — so the life comes from the tangle and the pollen instead.
 */
const props = defineProps<{ weekly: number[] }>();

const host = ref<HTMLElement | null>(null);
/** Held back until there is something to show, so it arrives instead of popping. */
const ready = ref(false);
const NS = "http://www.w3.org/2000/svg";
const H = 132;
const OLD = "#2f7a5c";
const STEM = "#00ff9c";

let ro: ResizeObserver | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function build() {
  const el = host.value;
  if (!el) return;
  const W = el.clientWidth;
  if (!W) return;
  const narrow = window.matchMedia(`(max-width: ${RAIL_MAX_PX}px)`).matches;
  const cx = narrow ? RAIL_X : W / 2;
  el.innerHTML = "";

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  el.appendChild(svg);
  const put = (tag: string, attrs: Record<string, string | number>) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, String(attrs[k]));
    svg.appendChild(n);
    return n;
  };

  const max = Math.max(1, ...props.weekly);
  const rnd = seeded(20260919);
  const still = reduced();
  /**
   * Mark an element to draw or unfurl itself in.
   *
   * CSS ANIMATIONS, not transitions. A transition needs a resolved previous
   * value to travel from, and these elements are created moments before they
   * are asked to move — neither a forced reflow nor deferring a frame made
   * that reliable (measured: the folded state was never resolved, so every
   * strand simply appeared). An animation declares its own `from`, so there is
   * nothing to miss.
   */
  const grows = (el: SVGElement, dur: number, delay: number, len?: number) => {
    if (still) return;
    if (len !== undefined) el.style.setProperty("--len", String(len));
    el.style.setProperty("--dur", `${Math.round(dur)}ms`);
    el.style.setProperty("--delay", `${Math.round(delay)}ms`);
    el.classList.add("grows");
  };

  const leafAt = (
    x: number, y: number, rot: number, sc: number, col: string, op: string, at = -1
  ) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "leaf");
    g.style.setProperty("--lx", `${x.toFixed(2)}px`);
    g.style.setProperty("--ly", `${y.toFixed(2)}px`);
    g.style.setProperty("--lr", `${rot.toFixed(1)}deg`);
    g.style.setProperty("--ls", sc.toFixed(2));
    g.style.opacity = op;
    // Stays folded shut until the drawing tip has gone past this point.
    if (at >= 0) grows(g, 420, at);
    const b = document.createElementNS(NS, "path");
    b.setAttribute("d", LEAF_PATH);
    b.setAttribute("fill", col);
    b.setAttribute("fill-opacity", "0.2");
    b.setAttribute("stroke", col);
    b.setAttribute("stroke-width", "1.2");
    g.appendChild(b);
    svg.appendChild(g);
  };

  const strand = (x: number, len: number, col: string, op: string, wgt: number, curly: boolean) => {
    // Sweep scales with the strand's own length so a long one crosses its
    // neighbours instead of dropping like a rope — but clamped inside the band,
    // or a strand near the edge reaches past the page gutter and gives the body
    // a horizontal scrollbar.
    const sw = narrow ? 0.45 : 1;
    const hold = (v: number) => Math.max(4, Math.min(W - 4, v));
    const a = hold(x + (rnd() - 0.5) * len * 0.72 * sw);
    const b = hold(x + (rnd() - 0.5) * len * 0.95 * sw);
    const c = hold(x + (rnd() - 0.5) * len * 0.6 * sw);
    const path = put("path", {
      d: `M ${x.toFixed(1)} 0 C ${a.toFixed(1)} ${(len * 0.32).toFixed(1)} ${b.toFixed(1)} ${(len * 0.66).toFixed(1)} ${c.toFixed(1)} ${len.toFixed(1)}`,
      fill: "none", stroke: col, "stroke-width": wgt, "stroke-linecap": "round", opacity: op,
    }) as SVGPathElement;
    const L = path.getTotalLength();

    // Each strand extends from where it attaches, at its own pace. The offsets
    // are small and RANDOM rather than ordered by x: a delay that rises across
    // the width is a sweep, and a sweep is what this stopped being.
    const delay = still ? 0 : rnd() * 240;
    const dur = 620 + rnd() * 420;
    grows(path, dur, delay, L);

    const n = len > 86 ? 4 : len > 54 ? 3 : len > 26 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const f = 0.2 + (k / n) * 0.68;
      const l = L * f;
      const p = path.getPointAtLength(l);
      const q = path.getPointAtLength(Math.min(L, l + 2));
      const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      // Opens just after the drawing tip has gone past it.
      leafAt(
        p.x, p.y, ang + (k % 2 ? 1 : -1) * (46 + rnd() * 18),
        0.3 + rnd() * 0.26, col, op,
        Math.round(delay + dur * f)
      );
    }

    if (curly && L > 18) {
      const p = path.getPointAtLength(L);
      const q = path.getPointAtLength(L - 3);
      const ang = (Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI;
      const cu = put("path", {
        class: "curl",
        d: curl(p.x, p.y, ang, 4.5 + rnd() * 4, 1.05 + rnd() * 0.7, rnd() > 0.5 ? 1 : -1),
        stroke: col,
      }) as SVGPathElement;
      cu.style.opacity = op;
      // The tendril only curls once its strand has finished arriving.
      grows(cu, 420, delay + dur * 0.92, cu.getTotalLength());
    }
  };

  const pass = (n: number, back: boolean) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5 + (rnd() - 0.5) * 0.95) / n;
      const x = Math.max(3, Math.min(W - 3, t * W));
      const wi = Math.max(0, Math.min(51, Math.floor(t * 52)));
      const norm = props.weekly[wi]! / max;
      const col = wi >= CLAUDE_INDEX ? INK_LIVE : OLD;
      // Hold the middle back so the one strand that matters still reads.
      const damp = (0.55 + 0.45 * Math.min(1, Math.abs(x - cx) / 110)) * (back ? 0.6 : 1);
      const len = Math.min(H - 14, (16 + norm * 74 + rnd() * 36) * damp);
      strand(
        x, len, col,
        ((back ? 0.18 : 0.38) + norm * (back ? 0.18 : 0.38)).toFixed(2),
        back ? 1 : len > 60 ? 1.6 : 1.2,
        !back && rnd() > 0.32
      );
    }
  };
  const base = Math.max(14, Math.round(W / 18));
  pass(Math.round(base * 1.15), true);
  pass(base, false);
  ready.value = true;

  // The strand that keeps going. It must land exactly on (cx, H).
  const main = put("path", {
    d: `M ${cx} 0 C ${cx - 9} ${(H * 0.34).toFixed(1)} ${cx + 9} ${(H * 0.7).toFixed(1)} ${cx} ${H}`,
    fill: "none", stroke: STEM, "stroke-width": 2.4, "stroke-linecap": "round", opacity: 0.9,
  }) as SVGPathElement;
  const ML = main.getTotalLength();
  grows(main, 1150, 0, ML);
  const at = (f: number) => {
    const p = main.getPointAtLength(ML * f);
    const q = main.getPointAtLength(Math.min(ML, ML * f + 2));
    return { p, ang: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
  };
  ([[0.16, 1, 0.62], [0.36, -1, 0.78], [0.58, 1, 0.7], [0.8, -1, 0.86]] as const).forEach(
    ([f, side, sc]) => {
      const { p, ang } = at(f);
      leafAt(p.x, p.y, ang + side * 52, sc, STEM, "0.85", Math.round(1150 * f));
    }
  );
  ([[0.26, -1, 28, 8, 1.6], [0.66, 1, 33, 9, 1.35]] as const).forEach(([f, side, len, r, turns]) => {
    const { p, ang } = at(f);
    const sh = put("path", {
      class: "curl",
      d: sideShoot(p, ang, side, len, r, turns),
      stroke: STEM,
    }) as SVGPathElement;
    grows(sh, 520, 1150 * f, sh.getTotalLength());
  });

  ([[-40, 30, 8.5, 0], [34, 58, 11, 1.4], [-26, 92, 9.5, 2.6], [46, 112, 10.5, 0.8]] as const).forEach(
    ([dx, y, dur, dl]) => {
      const m = put("circle", { class: "mote", cx: cx + dx, cy: y, r: 1.8, fill: STEM });
      (m as SVGElement).style.setProperty("--dur", `${dur}s`);
      (m as SVGElement).style.setProperty("--dl", `${dl}s`);
      (m as SVGElement).style.setProperty("--mx", `${dx < 0 ? -6 : 7}px`);
      (m as SVGElement).style.setProperty("--my", `${-9 - (dur % 5)}px`);
    }
  );
}

const rebuild = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(build, 140);
};

onMounted(() => {
  build();
  ro = new ResizeObserver(rebuild);
  if (host.value) ro.observe(host.value);
});
onBeforeUnmount(() => {
  ro?.disconnect();
  if (timer) clearTimeout(timer);
});
watch(() => props.weekly, build);
</script>

<template>
  <div ref="host" class="bush" :class="{ 'is-ready': ready }" aria-hidden="true" />
</template>

<style scoped>
/* No wipe. A mask sliding over finished strands is a reveal, not growth — and
   because the planting is sparse on the left and dense on the right, a mask
   reads as a sweep across the page. Each strand now draws itself on from where
   it attaches, and its leaves open behind the tip, so what you see is the thing
   actually extending. */
.bush { position: relative; height: 132px; margin-top: 2px; }
.bush :deep(svg) { position: absolute; inset: 0; overflow: visible; }

/* Position and scale are ONE css transform with an explicit 0 0 origin: an SVG
   `transform` attribute is silently overridden by any CSS transform on the same
   element, and a percentage transform-origin resolves against the viewBox
   rather than the leaf. */
.bush :deep(.leaf) {
  transform-origin: 0 0;
  transform: translate(var(--lx), var(--ly)) rotate(var(--lr)) scale(var(--ls));
}

/* Each strand extends from where it attaches; each leaf opens once the tip has
   passed it. Both animations omit their `to`, so they land on the element's own
   resting style and need no end state written twice. */
.bush :deep(path.grows) {
  stroke-dasharray: var(--len);
  animation: strand-draw var(--dur) cubic-bezier(0.22, 0.75, 0.3, 1) var(--delay) backwards;
}
@keyframes strand-draw {
  from { stroke-dashoffset: var(--len); }
}
.bush :deep(g.leaf.grows) {
  animation: leaf-open var(--dur) cubic-bezier(0.2, 1.25, 0.4, 1) var(--delay) backwards;
}
@keyframes leaf-open {
  from {
    opacity: 0;
    transform: translate(var(--lx), var(--ly)) rotate(var(--lr)) scale(0);
  }
}
.bush :deep(.curl) { fill: none; stroke-width: 1.1; stroke-linecap: round; opacity: 0.5; }

.bush :deep(.mote) { animation: mote-drift var(--dur, 9s) ease-in-out infinite; animation-delay: var(--dl, 0s); }
@keyframes mote-drift {
  0%, 100% { transform: translate(0, 0); opacity: 0.16; }
  50% { transform: translate(var(--mx, 7px), var(--my, -13px)); opacity: 0.7; }
}
@media (prefers-reduced-motion: reduce) {
  .bush :deep(.mote) { animation: none !important; }
}
</style>
