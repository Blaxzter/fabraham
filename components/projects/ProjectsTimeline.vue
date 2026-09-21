<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { TimelineRow } from "~/composables/useProjectTimeline";
import { curl, LEAF_PATH, lengthAtY, sampleLut, sideShoot, splineThrough, type Pt } from "~/lib/vine";
import { RAIL_MAX_PX, RAIL_X } from "./eras";
import EraMarker from "./EraMarker.vue";
import ProjectCard from "./ProjectCard.vue";

/**
 * The timeline: the rows, and the vine drawn through them.
 *
 * STEM — a Catmull-Rom spline through every node, the same construction
 * `BiographySection.vue` uses for its connector, with the control x leaning
 * toward whichever side the card sits on so the vine reaches for its card.
 *
 * ORNAMENT — a second strand twining around the stem, curling side-shoots, and
 * a grip curl on the end of every card tendril. All of it generated from the
 * stem's own arc length and tangent, so it re-flows at any width.
 *
 * GROWTH — `stroke-dashoffset` driven by a y → length lookup sampled off the
 * real path, so the tip lands EXACTLY on the growth line rather than
 * approximating it from the anchors. Growth is monotonic: scrolling back up
 * does not un-grow a vine, it just shows you what already grew.
 *
 * Unlike the biography cluster this measures the DOM. That cluster can place
 * its cards at deterministic percentage anchors because they are fixed-height
 * prose; project cards are not (languages wrap, commit lists differ), so the
 * anchors have to come from layout. A ResizeObserver rebuilds on reflow, and
 * the cards themselves are real HTML either way, so the prerender is unaffected.
 */
defineProps<{ rows: TimelineRow[] }>();

const NS = "http://www.w3.org/2000/svg";
const rowsEl = ref<HTMLElement | null>(null);
const svgEl = ref<SVGSVGElement | null>(null);
const wrap = ref<HTMLElement | null>(null);
const armed = ref(false);

let stem: SVGPathElement | null = null;
let halo: SVGPathElement | null = null;
let twine: SVGPathElement | null = null;
let tipDot: SVGCircleElement | null = null;
let twineLen = 0;
let L = 0;
let lut: { l: number; y: number }[] = [];
let marks: { l: number; el: Element }[] = [];
let cursor = 0;
/* ── Growth ─────────────────────────────────────────────────────────────
   Two numbers, not one. `target` is where the vine SHOULD have reached —
   monotonic, derived from the scroll position. `drawn` is what is actually on
   screen, and it chases the target on an exponential approach.

   Driving the stroke straight off the scroll offset is what made it step: a
   wheel notch is a ~100px jump, so the tip teleported and then sat still until
   the next notch. (The home page hides that behind Lenis; this page scrolls
   natively.) Chasing means the scroll only ever sets a destination and the
   vine always travels there continuously — which also reads better, because
   something that lags a little and catches up looks like it is growing rather
   than being scrubbed.

   `k` is re-derived from the real frame delta every tick, so 120Hz and 60Hz
   draw the same curve in the same wall-clock time rather than the same
   fraction per frame. */
const EASE_INTRO = 0.055; // ~1.4s to settle — the deliberate opening draw
const EASE_SCROLL = 0.18; // ~0.4s to settle — responsive, still trailing
let target = 0;
/**
 * Whether the page has settled enough for a scroll reading to mean anything.
 * False until the intro fires — see `scrollTarget()`.
 */
let settledIn = false;
let drawn = 0;
let ease = EASE_INTRO;
let raf = 0;
let lastT = 0;
let dirty = true;
let introTimer: ReturnType<typeof setTimeout> | null = null;
let ro: ResizeObserver | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isNarrow = () => window.matchMedia(`(max-width: ${RAIL_MAX_PX}px)`).matches;

function build() {
  const rowsNode = rowsEl.value;
  const svg = svgEl.value;
  if (!rowsNode || !svg) return;
  const W = rowsNode.clientWidth;
  const H = rowsNode.clientHeight;
  if (!W || !H) return;

  const narrow = isNarrow();
  const cx = narrow ? RAIL_X : W / 2;
  const amp = narrow ? 7 : Math.min(38, W * 0.026);

  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  svg.style.width = `${W}px`;
  svg.style.height = `${H}px`;
  svg.innerHTML = "";

  const rect = rowsNode.getBoundingClientRect();
  const nodes = [...rowsNode.querySelectorAll<HTMLElement>("[data-node]")].map((el, i) => {
    const card = el.querySelector<HTMLElement>(".card");
    const anchor = card ?? el;
    const ar = anchor.getBoundingClientRect();
    const isEra = el.dataset.node === "era";
    // On the rail layout every card hangs to the right of the line.
    const side = isEra ? 0 : narrow ? 1 : Number(el.dataset.side);
    return {
      el, isEra, side, i, card,
      y: ar.top - rect.top + ar.height / 2,
      accent: el.dataset.accent || "#9ad1ff",
    };
  });
  if (!nodes.length) return;

  // Control points: node anchors leaning toward their card, plus two
  // counter-swaying points per gap so the stem wanders instead of running.
  const key: (Pt & { node?: (typeof nodes)[number] })[] = [{ x: cx, y: 0 }];
  nodes.forEach((n, i) => {
    const w = n.isEra
      ? Math.sin(i * 1.9) * amp * 0.3
      : n.side * amp * 0.78 + Math.sin(i * 2.3) * amp * 0.24;
    key.push({ x: cx + w, y: n.y, node: n });
  });
  key.push({ x: cx, y: H });

  const pts: Pt[] = [];
  for (let i = 0; i < key.length; i++) {
    pts.push(key[i]!);
    if (i < key.length - 1) {
      const a = key[i]!;
      const b = key[i + 1]!;
      const dy = b.y - a.y;
      const lean = (a.x - cx + (b.x - cx)) * 0.5;
      pts.push({ x: cx - lean * 0.78 + Math.sin(i * 3.1) * amp * 0.3, y: a.y + dy * 0.34 });
      pts.push({ x: cx - lean * 0.34 - Math.sin(i * 2.2) * amp * 0.34, y: a.y + dy * 0.7 });
    }
  }
  const d = splineThrough(pts);

  const put = (tag: string, attrs: Record<string, string | number>, cls?: string) => {
    const n = document.createElementNS(NS, tag);
    if (cls) n.setAttribute("class", cls);
    for (const k in attrs) n.setAttribute(k, String(attrs[k]));
    svg.appendChild(n);
    return n;
  };

  // One gradient stop per era, so the vine changes colour as the chapters do.
  const defs = document.createElementNS(NS, "defs");
  const grad = document.createElementNS(NS, "linearGradient");
  grad.setAttribute("id", "vine-grad");
  grad.setAttribute("gradientUnits", "userSpaceOnUse");
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "0");
  grad.setAttribute("y2", String(H));
  const eras = nodes.filter((n) => n.isEra);
  const stops = [{ o: 0, c: eras[0]?.accent ?? "#00ff9c" }];
  eras.forEach((e) => stops.push({ o: Math.max(0, Math.min(1, e.y / H)), c: e.accent }));
  stops.push({ o: 1, c: eras[eras.length - 1]?.accent ?? "#9ad1ff" });
  stops.forEach((s) => {
    const st = document.createElementNS(NS, "stop");
    st.setAttribute("offset", `${(s.o * 100).toFixed(2)}%`);
    st.setAttribute("stop-color", s.c);
    grad.appendChild(st);
  });
  defs.appendChild(grad);
  svg.appendChild(defs);

  halo = put("path", { d, fill: "none", stroke: "url(#vine-grad)" }, "stem-halo") as SVGPathElement;
  stem = put("path", { d, fill: "none", stroke: "url(#vine-grad)" }, "stem") as SVGPathElement;

  L = stem.getTotalLength();
  stem.style.strokeDasharray = String(L);
  halo.style.strokeDasharray = String(L);
  lut = sampleLut(stem, L);

  // The twining second strand: the stem, offset along its own normal by a sine.
  const period = narrow ? 120 : 165;
  const tAmp = narrow ? 4.5 : 9;
  let td = "";
  for (let l = 0; l <= L; l += 7) {
    const p = stem.getPointAtLength(l);
    const q = stem.getPointAtLength(Math.min(L, l + 1));
    const nx = -(q.y - p.y);
    const ny = q.x - p.x;
    const nl = Math.hypot(nx, ny) || 1;
    const off = Math.sin((l / period) * Math.PI * 2) * tAmp;
    td += `${l === 0 ? "M " : " L "}${(p.x + (nx / nl) * off).toFixed(2)} ${(p.y + (ny / nl) * off).toFixed(2)}`;
  }
  twine = put("path", { d: td, fill: "none", stroke: "url(#vine-grad)" }, "twine") as SVGPathElement;
  twineLen = twine.getTotalLength();
  twine.style.strokeDasharray = String(twineLen);

  marks = [];
  const accentAtY = (y: number) => {
    let c = stops[0]!.c;
    for (const e of eras) if (e.y <= y) c = e.accent;
    return c;
  };
  const addCurl = (path: string, colour: string, cls: string) => {
    const el = put("path", { d: path, fill: "none", stroke: colour }, cls) as SVGPathElement;
    el.style.setProperty("--len", String(el.getTotalLength()));
    return el;
  };

  // Leaves and side-shoots along the real arc length, rotated to the tangent.
  // Every third station is a curling shoot instead of a leaf.
  const step = narrow ? 50 : 42;
  let k = 0;
  for (let l = 34; l < L - 30; l += step, k++) {
    const p = stem.getPointAtLength(l);
    const q = stem.getPointAtLength(Math.min(L, l + 2));
    const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    const side: 1 | -1 = k % 2 ? 1 : -1;
    const col = accentAtY(p.y);

    if (k % 3 === 2) {
      const len = (narrow ? 20 : 30) + ((k * 13) % 14);
      marks.push({
        l,
        el: addCurl(sideShoot(p, ang, side, len, 7 + ((k * 7) % 5), 1.2 + (k % 3) * 0.3), col, "curl shoot"),
      });
      continue;
    }

    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "leaf");
    g.style.setProperty("--lx", `${p.x.toFixed(2)}px`);
    g.style.setProperty("--ly", `${p.y.toFixed(2)}px`);
    g.style.setProperty("--lr", `${(ang + side * 54).toFixed(1)}deg`);
    g.style.setProperty("--ls", (0.55 + ((k * 37) % 7) / 16).toFixed(2));
    const leaf = document.createElementNS(NS, "path");
    leaf.setAttribute("d", LEAF_PATH);
    leaf.setAttribute("fill", col);
    leaf.setAttribute("fill-opacity", "0.16");
    leaf.setAttribute("stroke", col);
    leaf.setAttribute("stroke-width", "1.1");
    g.appendChild(leaf);
    const rib = document.createElementNS(NS, "line");
    rib.setAttribute("x1", "1");
    rib.setAttribute("y1", "0");
    rib.setAttribute("x2", "22");
    rib.setAttribute("y2", "0");
    rib.setAttribute("stroke", col);
    rib.setAttribute("stroke-width", "0.7");
    rib.setAttribute("stroke-opacity", "0.55");
    g.appendChild(rib);
    svg.appendChild(g);
    marks.push({ l, el: g });
  }

  // Card tendrils (each ending in a grip curl) + the node buds.
  nodes.forEach((n) => {
    const nl = lengthAtY(lut, L, n.y);
    const p = stem!.getPointAtLength(nl);

    if (!n.isEra && n.card) {
      const cr = n.card.getBoundingClientRect();
      const edge = (n.side < 0 ? cr.right : cr.left) - rect.left;
      const ey = cr.top - rect.top + cr.height / 2;
      const grip = narrow ? 5 : 7;
      const stop = edge - n.side * (narrow ? 11 : 16);
      const dx = stop - p.x;
      const k2x = stop - dx * 0.4;
      const k2y = ey + 16;
      const tang = (Math.atan2(ey - k2y, stop - k2x) * 180) / Math.PI;
      const path =
        `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} C ${(p.x + dx * 0.45).toFixed(1)} ${(p.y - 20).toFixed(1)}` +
        ` ${k2x.toFixed(1)} ${k2y.toFixed(1)} ${stop.toFixed(1)} ${ey.toFixed(1)}` +
        curl(stop, ey, tang, grip, narrow ? 1.1 : 1.35, n.side > 0 ? -1 : 1);
      marks.push({ l: nl, el: addCurl(path, n.accent, "curl") });
    }

    const bud = document.createElementNS(NS, "g");
    bud.setAttribute("class", "bud");
    bud.style.setProperty("--bx", `${p.x.toFixed(2)}px`);
    bud.style.setProperty("--by", `${p.y.toFixed(2)}px`);
    const glow = document.createElementNS(NS, "circle");
    glow.setAttribute("r", n.isEra ? "12" : "7.5");
    glow.setAttribute("fill", n.accent);
    glow.setAttribute("fill-opacity", "0.14");
    bud.appendChild(glow);
    const core = document.createElementNS(NS, "circle");
    core.setAttribute("r", n.isEra ? "5" : "3.4");
    core.setAttribute("fill", n.isEra ? n.accent : "#06080b");
    core.setAttribute("stroke", n.accent);
    core.setAttribute("stroke-width", "1.6");
    bud.appendChild(core);
    svg.appendChild(bud);
    marks.push({ l: nl, el: bud });
    marks.push({ l: nl, el: n.el });
  });

  tipDot = put("circle", { r: 3.6, fill: "#ffffff" }, "tip") as SVGCircleElement;

  marks.sort((a, b) => a.l - b.l);
  cursor = 0;
  marks.forEach((m) => m.el.classList.remove("is-out"));

  if (reduced()) {
    target = L;
    drawn = L;
  }
  apply();
}

function lineAt(y: number) {
  const node = rowsEl.value;
  if (!node) return 0;
  return lengthAtY(lut, L, Math.max(0, Math.min(node.clientHeight, y)));
}

/**
 * While scrolling, the tip runs a little ahead of the reader.
 *
 * Returns nothing until `settledIn`, and that guard is the whole reason this
 * page's opening draw survives a client-side navigation.
 *
 * Arriving from another route, the router resets the scroll AFTER this component
 * mounts. For the first hundred milliseconds or so `window.scrollY` is still the
 * previous page's — several thousand pixels down, coming from the home chapter —
 * while the rows element has barely been laid out and the path is a fraction of
 * its final length. A reading taken in that window asks "how far down this page
 * has the reader got" and gets back a number far past the end of a vine that
 * does not exist yet, so `lineAt` clamps it to the full length.
 *
 * That alone would be recoverable, except for two things that make it
 * permanent: `target` is monotonic by design, and `remeasure()` carries growth
 * across a rebuild as a PROPORTION. So 100% of a 1261px stub becomes 100% of the
 * real 7830px path the moment the layout settles, and the vine is fully grown
 * before it has drawn a frame. Measured coming in from the home page's handoff:
 * a `remeasure` at 96ms with `scrollY` still at 1409 latched it, and a direct
 * load of the same page sat at 4% as intended.
 */
function scrollTarget() {
  const node = rowsEl.value;
  if (!node || !settledIn) return 0;
  return lineAt(window.innerHeight * 0.74 - node.getBoundingClientRect().top);
}

/**
 * On the first pass, grow all the way to the bottom of the viewport instead.
 *
 * Everything down there has already been painted from the prerendered HTML, so
 * leaving it un-grown means arming would hide it and fade it back in — the
 * visitor sees the first card blink out. Growing past it first means arming
 * only ever hides what is genuinely below the fold. The extra 60px takes in a
 * card straddling the edge, which would otherwise lose its lower half.
 */
function initialTarget() {
  const node = rowsEl.value;
  if (!node) return 0;
  return lineAt(window.innerHeight + 60 - node.getBoundingClientRect().top);
}

function apply() {
  if (!stem || !halo || !twine || !tipDot) return;
  const g = Math.min(drawn, L);
  stem.style.strokeDashoffset = String(L - g);
  halo.style.strokeDashoffset = String(L - g);
  twine.style.strokeDashoffset = String(twineLen * (1 - g / L));
  const p = stem.getPointAtLength(g);
  tipDot.setAttribute("cx", p.x.toFixed(2));
  tipDot.setAttribute("cy", p.y.toFixed(2));
  // Hidden when fully grown, and also before it has left the bush — a lone dot
  // sitting at the top reads as a bug.
  tipDot.style.opacity = g >= L - 1 || g < 5 ? "0" : "1";
  while (cursor < marks.length && marks[cursor]!.l <= g) marks[cursor++]!.el.classList.add("is-out");
}

/**
 * The opening beat: the vine draws down out of the bush over ~1.4s rather than
 * arriving at full length. Cubic ease-out, so it leaves fast and settles.
 *
 * `Math.max` against the live scroll target throughout: if the visitor scrolls
 * while this is running they simply get ahead of it, and because growth never
 * goes backwards the two can never disagree.
 */
function pump(t: number) {
  raf = 0;
  const dt = lastT ? Math.min(64, t - lastT) : 16.7;
  lastT = t;
  // One layout read per frame at most, however many scroll events arrived.
  if (dirty) {
    target = Math.max(target, scrollTarget());
    dirty = false;
  }
  const k = 1 - Math.pow(1 - ease, dt / 16.6667);
  drawn += (target - drawn) * k;
  // Snap the last fraction of a pixel; an exponential approach never actually
  // arrives, and a loop that runs forever at 0.01px/frame is a battery leak.
  if (target - drawn < 0.4) drawn = target;
  apply();
  if (drawn < target - 0.05) {
    raf = requestAnimationFrame(pump);
  } else {
    lastT = 0;
    ease = EASE_SCROLL;
  }
}

/** Scroll only ever nudges the destination; `pump` does the drawing. */
function wake() {
  dirty = true;
  if (!raf) {
    lastT = 0;
    raf = requestAnimationFrame(pump);
  }
}

/** Jump straight there, with no chase. Reduced motion only. */
function settle(to: number) {
  target = Math.max(target, to);
  drawn = target;
  apply();
}

/**
 * Re-measure the path without disturbing the growth.
 *
 * Both `drawn` and `target` are absolute lengths along a path that has just
 * been rebuilt, so both are carried across as PROPORTIONS. If the vine had
 * already arrived it arrives again immediately and nothing animates; if it was
 * still travelling it keeps travelling from where it was.
 *
 * This replaced a `settle()` on these paths, which snapped `drawn` to `target`
 * and was why the vine appeared fully drawn on load instead of growing:
 * `ResizeObserver` delivers an initial notification the moment you observe, so
 * `rebuild()`'s 140ms debounce fired at ~140ms — comfortably before the intro
 * was due to start at 320ms — and the opening draw had nothing left to do.
 */
function remeasure() {
  const dFrac = L ? drawn / L : 0;
  const tFrac = L ? target / L : 0;
  build();
  drawn = dFrac * L;
  target = Math.max(tFrac * L, scrollTarget());
  apply();
  if (drawn < target - 0.05) wake();
}

function onScroll() {
  wake();
}

const rebuild = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    // A resize should not make the vine appear to regrow, and must not cut
    // the opening draw short either.
    remeasure();
  }, 140);
};

onMounted(async () => {
  await nextTick();
  // Measure BEFORE arming, for two reasons.
  //
  // An armed row carries `transform: translateY(18px) scale(0.97)`, and
  // getBoundingClientRect reports the TRANSFORMED box — so arming first placed
  // every tendril and bud against a card 18px lower and 3% smaller than where
  // it settles, and the vine only snapped true on the next rebuild.
  //
  // And the cards are already painted from the prerendered HTML. Arming first
  // blanked them and faded them back in, which reads as a flash of the page
  // breaking. Building, then applying, marks everything already on screen as
  // grown, so arming after only ever hides what is still below the fold.
  build();
  armed.value = true;
  if (reduced()) {
    settledIn = true;
    settle(Math.max(scrollTarget(), initialTarget()));
  } else {
    // Let the bush wipe in first, then send the vine down out of it. The chase
    // is monotonic, so a visitor who scrolls during the opening simply
    // overtakes it rather than fighting it.
    //
    // The first reading is taken HERE, when the intro starts, and not up at
    // mount — which is where it used to be, and which was wrong on every
    // client-side navigation into this page.
    //
    // Both `scrollTarget()` and `initialTarget()` measure through
    // `getBoundingClientRect().top`, so both describe where the rows are IN THE
    // VIEWPORT. Arriving from another route, the router has not reset the scroll
    // yet when `onMounted` runs: the rect is still being read against the
    // previous page's offset, which on the home page is several thousand pixels
    // down. `lineAt` clamps that to the full length, `target` is monotonic by
    // design, and the vine was therefore fully grown before it drew a frame —
    // the opening draw simply never happened. Coming in from the home chapter's
    // handoff it went 74% → 97% → 100% while a direct load sat at 4%.
    //
    // By the time this fires the scroll has been reset and the reading is about
    // this page. It is the same fix the note on `remeasure()` describes for the
    // ResizeObserver: nothing here may take a measurement before the thing it is
    // measuring has settled.
    introTimer = setTimeout(() => {
      // The scroll is this page's own from here on.
      settledIn = true;
      target = Math.max(target, scrollTarget(), initialTarget());
      wake();
    }, 320);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  ro = new ResizeObserver(rebuild);
  if (rowsEl.value) ro.observe(rowsEl.value);
  // Fonts change card heights, which moves every anchor.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      remeasure();
    });
  }
});

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf);
  if (introTimer) clearTimeout(introTimer);
  window.removeEventListener("scroll", onScroll);
  ro?.disconnect();
  if (timer) clearTimeout(timer);
});

/** Tapping a card opens its set-pieces where there is no hover to use. */
function onTap(e: MouseEvent) {
  if ((e.target as HTMLElement).closest("a")) return;
  const wrapEl = (e.target as HTMLElement).closest(".cardwrap");
  if (!wrapEl || !rowsEl.value) return;
  const wasOpen = wrapEl.classList.contains("is-open");
  rowsEl.value.querySelectorAll(".cardwrap.is-open").forEach((w) => w.classList.remove("is-open"));
  if (!wasOpen) wrapEl.classList.add("is-open");
}

defineExpose({ rebuild });
</script>

<template>
  <div ref="wrap" class="field" :class="{ 'is-armed': armed }">
    <svg ref="svgEl" class="vine" aria-hidden="true" />
    <div ref="rowsEl" class="rows" @click="onTap">
      <template v-for="(row, i) in rows" :key="row.id">
        <div
          v-if="row.kind === 'era'"
          class="row era"
          data-node="era"
          :data-accent="row.era.accent"
        >
          <EraMarker :era="row.era" />
        </div>
        <div
          v-else
          class="row"
          :class="row.side < 0 ? 'row-left' : 'row-right'"
          data-node="project"
          :data-side="row.side"
          :data-accent="row.doc.accent"
          :style="{ '--i': i }"
        >
          <ProjectCard :doc="row.doc" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.field { position: relative; padding-bottom: 4rem; }

.vine {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  transition: opacity 0.6s ease;
}
.is-armed .vine { opacity: 1; }
.vine :deep(.stem) { fill: none; stroke-linecap: round; stroke-width: 2.4; }
.vine :deep(.stem-halo) { fill: none; stroke-linecap: round; stroke-width: 7; opacity: 0.1; }
/* A second strand winds around the first, so the line reads as two growths
   twining rather than one drawn wire. */
.vine :deep(.twine) { fill: none; stroke-width: 1.1; stroke-linecap: round; opacity: 0.4; }

/* Position AND growth are one CSS transform with an explicit 0 0 origin: an SVG
   `transform` ATTRIBUTE is silently overridden by any CSS transform on the same
   element (which is how every leaf ends up stacked on the SVG origin), and a
   percentage transform-origin resolves against the viewBox rather than the leaf. */
.vine :deep(.leaf) {
  transform-origin: 0 0;
  transform: translate(var(--lx), var(--ly)) rotate(var(--lr)) scale(0.12);
  opacity: 0;
  transition: transform 0.55s cubic-bezier(0.18, 1.3, 0.4, 1), opacity 0.4s ease;
}
.vine :deep(.leaf.is-out) {
  transform: translate(var(--lx), var(--ly)) rotate(var(--lr)) scale(var(--ls));
  opacity: 0.8;
}
.vine :deep(.curl) {
  fill: none;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-dasharray: var(--len);
  stroke-dashoffset: var(--len);
  opacity: 0.62;
  transition: stroke-dashoffset 0.85s ease;
}
.vine :deep(.curl.is-out) { stroke-dashoffset: 0; }
.vine :deep(.curl.shoot) { stroke-width: 1.1; opacity: 0.5; }
.vine :deep(.bud) {
  transform-origin: 0 0;
  transform: translate(var(--bx), var(--by)) scale(0.2);
  opacity: 0;
  transition: transform 0.4s cubic-bezier(0.18, 1.4, 0.4, 1), opacity 0.3s ease;
}
.vine :deep(.bud.is-out) { transform: translate(var(--bx), var(--by)) scale(1); opacity: 1; }
.vine :deep(.tip) { filter: drop-shadow(0 0 7px currentColor); }

/* `1fr` is minmax(AUTO, 1fr): the nowrap commit lines and the slug give each
   card a min-content floor, so the two side tracks would size themselves to
   their own longest commit subject — the grid goes asymmetric AND overflows,
   the spine stops being the centre, and cards sit on top of the vine. */
.rows {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 196px minmax(0, 1fr);
  row-gap: 118px;
  align-items: center;
}

/* `justify-self` will not move the card: the row keeps the full track either
   way, so it just leaves it at the track's leading edge — which on the left is
   as far from the spine as it can get. Align inside the row instead. */
.row { position: relative; min-width: 0; display: flex; }
/* The entrance rides on the ROW while the grow-in state sits on the CARD
   inside it. Two elements, so they compose instead of fighting: a row still
   below the fold plays this animation against a card that is holding at
   opacity 0, and nothing shows until the vine reaches it.
   Starting from the animation's own `from` state means the first paint is
   already correct — there is no visible-then-hidden flash to avoid. */
.row-left,
.row-right {
  animation: row-rise 0.7s cubic-bezier(0.2, 0.9, 0.3, 1) backwards;
  /* Capped: past the first handful the vine is what reveals them anyway. */
  animation-delay: calc(min(var(--i, 0), 6) * 90ms + 260ms);
}
/* Opacity only. The CARD already rises 18px under its own transition when the
   vine reaches it; moving the row as well stacked two translates on the same
   box and made it float. What the row is actually for is covering the window
   between first paint and hydration, so the arm-flip is never seen. */
@keyframes row-rise {
  from { opacity: 0; }
}
.row-left { grid-column: 1; justify-content: flex-end; }
.row-right { grid-column: 3; justify-content: flex-start; }

.row :deep(.card) { opacity: 1; transform: none; }
.is-armed .row:not(.is-out) :deep(.card) { opacity: 0; transform: translateY(18px) scale(0.97); }

/* A band across the trellis. The stem runs BEHIND it and ghosts faintly
   through, which keeps the centred text readable at the one place the vine and
   the prose want the same pixels. */
.era {
  grid-column: 1 / -1;
  justify-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-block: 1.5rem;
  background: linear-gradient(to bottom, transparent, #06080bed 14%, #06080bed 86%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
  opacity: 1;
  transform: none;
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.is-armed .era:not(.is-out) { opacity: 0; transform: translateY(14px); }

/* Narrow: the zigzag becomes a rail, the same way the biography cluster does.
   RAIL_MAX_PX in ./eras.ts restates this breakpoint for the vine geometry —
   move one, move both. */
@media (max-width: 1000px) {
  .rows { grid-template-columns: 56px minmax(0, 1fr); row-gap: 88px; }
  .row-left,
  .row-right { grid-column: 2; justify-content: flex-start; }
  .era { justify-self: stretch; align-items: flex-start; text-align: left; padding-left: 56px; }
}

@media (prefers-reduced-motion: reduce) {
  .vine :deep(.leaf),
  .vine :deep(.bud),
  .vine :deep(.curl),
  .row :deep(.card),
  .era { transition: none !important; }
  .vine { transition: none; }
  .row-left,
  .row-right { animation: none; }
}
</style>
