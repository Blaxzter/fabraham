<script setup lang="ts">
/**
 * The way through to /projects, hanging off the end of the vine.
 *
 * Four versions got here. It began as a rounded pill pinned to the bottom of
 * the viewport for the whole chapter — a button, in a scene with no buttons in
 * it, floating over the middle of nothing. Then it was a heraldic shield, which
 * fixed the floating and overshot the brief: a coat of arms is a strange thing
 * to find on a vine, and it made the link feel like a trophy rather than a way
 * in. Then a paper specimen label — a tie, two ruled lines, a count, a span of
 * years — which was the right OBJECT and the wrong voice: it catalogued the
 * plant, when everything else on this site talks like a terminal.
 *
 * It is now a SIGN, in the logo's own grammar. The logo (public/logo.svg) is a
 * prompt box: a bracket, a `$` whose bar is the box's left edge, a word, and a
 * block cursor. That construction can carry any command, and the one that takes
 * you to the projects page is
 *
 *     [$ cd projects█ ]
 *
 * Where the box says `fa` it is the favicon; where it says `cd projects` it is
 * a way through. Same bracket, same impaled dollar, and the cursor is the "click
 * me". The count and the span of years survive as the caption under the box,
 * which is where the logo puts its wordmark.
 *
 * It is a solid, extruded thing, not a card: real CSS 3D, the way the bud cards
 * build their cubes. The face is drawn once as HTML — the command is real text,
 * crawlable, in the site's monospace — and then drawn again `DEPTH` times
 * behind itself, each copy one step further back and a shade darker, inside a
 * `preserve-3d` board tilted a few degrees so the steps show as sides. The back
 * copies carry their text in a pseudo-element off a data attribute, so the
 * words are in the DOM exactly once.
 *
 * It hangs by its EYELET, and the eyelet lands on the vine's own last point
 * (`hangPoint`) — not near it, on it. The vine does not pass this on its way
 * somewhere; this is what it grew into.
 *
 * Like the bud cards, everything about its arrival is staged off `--born`,
 * written per frame by the scene: the cord draws itself, the sign drops onto
 * it, the frame draws itself around, the `$` lands on the edge, the command
 * types in with the cursor riding its end, and the caption arrives last.
 * Nothing here is a CSS transition except the hover, so the whole thing
 * reverses on scroll-up — the command un-types.
 */
const props = defineProps<{
  count: number;
  /** Earliest and latest year in the record, so the span is never hand-typed. */
  from?: number;
  to?: number;
  accent?: string;
  /** The page is on its way to /projects — see `onHandoff` in ProjectsSection. */
  leaving?: boolean;
}>();

const { t } = useI18n();
const localePath = useLocalePath();

/** What the sign says. The typing is measured in characters of this. A
 *  command, so it stays English in both languages. */
const CMD = "cd projects";

/**
 * The sign's proportions, live in the dev panel under the projects scene and
 * shipped from tuning.config.json once saved there. Everything is a multiple of
 * the one unit (the box height), so a change here scales the whole object.
 *
 * Two sets where the chapter has two modes. DESKTOP is the sign hung from the
 * node by the scene; MOBILE is the chapter's flow layout, which narrow or short
 * frames fall back to (`canPin` in ProjectsSection — a fit test, not a
 * breakpoint, which is why the switch below is the chapter's `is-driven`
 * class and not a media query). Each set carries what actually differs between
 * the two: how big, and how much it turns.
 */
const tune = useTuning("vineSign", "Vine sign", "projects");
const desktopSizeVw = tune.num("desktopSizeVw", 3.8, {
  label: "Desktop size (vw)",
  min: 1,
  max: 8,
  step: 0.1,
});
const desktopSizeMin = tune.num("desktopSizeMin", 40, {
  label: "Desktop size min (px)",
  min: 20,
  max: 100,
  step: 1,
});
const desktopSizeMax = tune.num("desktopSizeMax", 84, {
  label: "Desktop size max (px)",
  min: 40,
  max: 200,
  step: 1,
});
const desktopTiltX = tune.num("desktopTiltX", 6, {
  label: "Desktop tilt X (deg)",
  min: -25,
  max: 25,
  step: 0.5,
});
const desktopTiltY = tune.num("desktopTiltY", -12, {
  label: "Desktop tilt Y (deg)",
  min: -45,
  max: 45,
  step: 0.5,
});
const mobileSize = tune.num("mobileSize", 40, {
  label: "Mobile size (px)",
  min: 20,
  max: 80,
  step: 1,
});
const mobileTiltX = tune.num("mobileTiltX", 6, {
  label: "Mobile tilt X (deg)",
  min: -25,
  max: 25,
  step: 0.5,
});
const mobileTiltY = tune.num("mobileTiltY", -12, {
  label: "Mobile tilt Y (deg)",
  min: -45,
  max: 45,
  step: 0.5,
});
/**
 * How many copies of the face sit behind it. Each is one `depthStep` of the
 * unit back; at the board's tilt the steps land well under a pixel apart on
 * screen, so the sides read as surfaces rather than as a stack of outlines.
 */
const depth = tune.num("depth", 12, { label: "Depth (layers)", min: 0, max: 24, step: 1 });
// In percent of the size, because the panel shows two decimals and 0.048 vs
// 0.044 is not a difference anyone can read there.
const depthStep = tune.num("depthStep", 4.8, {
  label: "Depth step (% size)",
  min: 0,
  max: 15,
  step: 0.2,
});
const stroke = tune.num("stroke", 4.4, {
  label: "Stroke (% size)",
  min: 2,
  max: 12,
  step: 0.2,
});
const commandSize = tune.num("commandSize", 0.8, {
  label: "Command size (x size)",
  min: 0.4,
  max: 1,
  step: 0.02,
});
const boldFace = tune.bool("boldFace", true, { label: "Bold face" });
const captionSize = tune.num("captionSize", 0.28, {
  label: "Caption size (x size)",
  min: 0.12,
  max: 0.5,
  step: 0.01,
});
const captionOpacity = tune.num("captionOpacity", 0.78, {
  label: "Caption opacity",
  min: 0.2,
  max: 1,
  step: 0.02,
});
const cordLength = tune.num("cordLength", 1.76, {
  label: "Cord length (x size)",
  min: 0.4,
  max: 4,
  step: 0.05,
});
const sprigsWidth = tune.num("sprigsWidth", 8.6, {
  label: "Sprigs width (x size)",
  min: 2,
  max: 16,
  step: 0.1,
});
const glow = tune.num("glow", 18, { label: "Glow (%)", min: 0, max: 80, step: 1 });
const sway = tune.num("sway", 1.1, { label: "Sway (deg)", min: 0, max: 6, step: 0.1 });
const swayPeriod = tune.num("swayPeriod", 8, {
  label: "Sway period (s)",
  min: 1,
  max: 20,
  step: 0.5,
});
const ink = tune.color("ink", "#e9f1f8", { label: "Ink" });
const cursorColor = tune.color("cursor", "#fdae52", { label: "Cursor" });

/**
 * Enter runs the command.
 *
 * The line under the sign says "↵ open the timeline", and the key has to be
 * true for that to be honest — nobody will find it by accident, which is the
 * point: it is there for whoever reads a prompt and does what a prompt asks.
 * It fires only while the sign is actually there to be read (born, opaque, on
 * screen), never while something else has the keyboard, and it goes through
 * the same click the mouse makes, so the handoff in ProjectsSection — the
 * shoot, the short wait, the route — is the one path out.
 */
const root = ref<HTMLAnchorElement | null>(null);
const onKey = (e: KeyboardEvent) => {
  if (e.key !== "Enter" || e.repeat || e.defaultPrevented) return;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.closest("input, textarea, select, button, [contenteditable]") || target.isContentEditable)) return;
  const el = root.value;
  if (!el || props.leaving) return;
  const cs = getComputedStyle(el);
  if (parseFloat(cs.getPropertyValue("--born")) < 0.98 || parseFloat(cs.opacity) < 0.9) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight || r.width === 0) return;
  e.preventDefault();
  el.click();
};
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

/**
 * Handed to the stylesheet as custom properties. Both device sets go in, and
 * the stylesheet picks one by the chapter's mode, so the inline style is the
 * same on the server and the client and hydration has nothing to object to.
 */
const styleVars = computed(() => ({
  "--accent": props.accent || "#00ff9c",
  "--chars": CMD.length,
  "--u-desktop": `clamp(${desktopSizeMin.value}px, ${desktopSizeVw.value}vw, ${desktopSizeMax.value}px)`,
  "--u-mobile": `${mobileSize.value}px`,
  "--tilt-x-desktop": `${desktopTiltX.value}deg`,
  "--tilt-y-desktop": `${desktopTiltY.value}deg`,
  "--tilt-x-mobile": `${mobileTiltX.value}deg`,
  "--tilt-y-mobile": `${mobileTiltY.value}deg`,
  "--depth-k": depthStep.value / 100,
  "--stroke-k": stroke.value / 100,
  "--cmd-k": commandSize.value,
  "--face-weight": boldFace.value ? 700 : 400,
  "--caption-k": captionSize.value,
  "--caption-a": captionOpacity.value,
  "--cord-k": cordLength.value,
  "--sprigs-k": sprigsWidth.value,
  "--glow": glow.value,
  "--sway": `${sway.value}deg`,
  "--sway-period": `${swayPeriod.value}s`,
  "--ink": ink.value,
  "--orange": cursorColor.value,
}));

/**
 * The logo's `$`, in the mark's own coordinates (components/BrandMark.vue).
 * Its bar runs x 29.76–33.67 and the viewBox below is the glyph's tight box, so
 * centring this on the sign's box edge puts the bar exactly on the stroke.
 */
const DOLLAR =
  "M33.67 70.68L29.76 70.75C26.44 70.34 23.74 69.59 21.66 68.52C19.58 67.45 17.79 65.73 16.28 63.34C14.76 60.95 13.88 58.04 13.64 54.6L20.31 53.34C20.83 56.91 21.74 59.53 23.04 61.2C24.91 63.56 27.15 64.88 29.76 65.15L29.76 44.01C27.03 43.49 24.24 42.44 21.38 40.84C19.27 39.66 17.64 38.02 16.5 35.93C15.35 33.84 14.78 31.47 14.78 28.81C14.78 24.09 16.45 20.27 19.8 17.34C22.04 15.37 25.36 14.17 29.76 13.73L33.67 13.73C37.53 14.09 40.59 15.23 42.85 17.12C45.76 19.53 47.5 22.84 48.09 27.04L41.23 28.07C40.84 25.47 40.02 23.47 38.78 22.08C37.54 20.69 35.83 19.78 33.67 19.33L33.67 38.48C37.01 39.31 39.23 39.97 40.31 40.43C42.37 41.34 44.06 42.45 45.36 43.75C46.67 45.06 47.67 46.6 48.37 48.4C49.07 50.2 49.42 52.14 49.42 54.23C49.42 58.83 47.96 62.66 45.03 65.74C42.1 68.81 38.32 70.46 33.67 70.68ZM29.76 19.26C27.18 19.65 25.14 20.68 23.65 22.36C22.17 24.03 21.42 26.01 21.42 28.3C21.42 30.56 22.05 32.45 23.32 33.98C24.59 35.5 26.73 36.72 29.76 37.63L29.76 19.26ZM33.67 65.15C36.25 64.83 38.38 63.71 40.07 61.79C41.75 59.87 42.6 57.5 42.6 54.67C42.6 52.26 42 50.32 40.81 48.86C39.61 47.4 37.23 46.09 33.67 44.93L33.67 65.15Z";
</script>

<template>
  <a
    ref="root"
    class="label"
    :class="{ 'is-leaving': leaving }"
    :href="localePath('/projects')"
    :style="styleVars"
    :aria-label="
      from && to
        ? t('home.projects.aria', { count, from, to })
        : t('home.projects.ariaNoRange', { count })
    "
  >
    <span class="swing">
      <!-- The tie. The eyelet's centre is the point the scene anchors this whole
           element by, so it lands exactly on the vine's last node — see the
           label's branch of `placeEl` in ProjectVine. It is its own SVG at a
           fixed size so that centre stays 7px under the top whatever the cord's
           length; the cord is the part that stretches with the sign. -->
      <span class="tie" aria-hidden="true">
        <svg class="eyelet-svg" viewBox="0 0 40 14" fill="none">
          <circle class="eyelet" cx="20" cy="7" r="5" />
        </svg>
        <svg class="cord-svg" viewBox="0 0 40 60" preserveAspectRatio="none" fill="none">
          <path class="cord" pathLength="1" d="M20 0 C 15 14, 25 32, 20 60" />
        </svg>
      </span>

      <span class="body">
        <!-- The growth that caught on it. Small on purpose: there is a whole
             curtain behind this in the scene, and the job here is only to tie
             the sign to the plant. -->
        <svg class="sprigs" viewBox="0 0 360 126" fill="none" aria-hidden="true">
          <g class="sprig l">
            <path class="stem" d="M170 8 C 130 10, 92 22, 62 48" />
            <path class="leaf" d="M138 12 C 128 2, 112 2, 105 11 C 115 21, 131 21, 138 12 Z" />
            <path class="leaf" d="M104 22 C 96 11, 80 10, 72 19 C 81 30, 97 31, 104 22 Z" />
            <path class="leaf" d="M76 38 C 70 27, 55 25, 47 33 C 55 44, 70 46, 76 38 Z" />
            <path class="curl" d="M62 48 C 53 46, 47 38, 52 32 C 57 27, 64 31, 62 38" />
          </g>
          <g class="sprig r">
            <path class="stem" d="M170 8 C 210 10, 248 22, 278 48" />
            <path class="leaf" d="M202 12 C 212 2, 228 2, 235 11 C 225 21, 209 21, 202 12 Z" />
            <path class="leaf" d="M236 22 C 244 11, 260 10, 268 19 C 259 30, 243 31, 236 22 Z" />
            <path class="leaf" d="M264 38 C 270 27, 285 25, 293 33 C 285 44, 270 46, 264 38 Z" />
            <path class="curl" d="M278 48 C 287 46, 293 38, 288 32 C 283 27, 276 31, 278 38" />
          </g>
        </svg>

        <span class="sign">
          <span class="board">
            <!-- The depth: the face again, DEPTH times, deepest first so the
                 stack still reads front-to-back where 3D transforms are off. -->
            <span
              v-for="i in depth"
              :key="i"
              class="layer"
              :style="{ '--i': depth + 1 - i }"
              aria-hidden="true"
            >
              <span class="bracket" />
              <span class="box">
                <svg class="dollar" viewBox="13.64 13.73 35.78 57.02"><path :d="DOLLAR" /></svg>
                <span class="cmd" :data-cmd="CMD" />
                <span class="cursor" />
              </span>
            </span>

            <!-- The face. The only copy with words in it. -->
            <span class="layer face">
              <span class="bracket ink" />
              <span class="box ink">
                <svg class="dollar" viewBox="13.64 13.73 35.78 57.02" aria-hidden="true">
                  <path :d="DOLLAR" />
                </svg>
                <span class="cmd">{{ CMD }}</span>
                <span class="cursor" aria-hidden="true" />
              </span>
            </span>
          </span>
        </span>

        <!-- Under the box, where the logo puts its wordmark. -->
        <span class="caption">
          <b>{{ count }}</b> {{ t("home.projects.caption") }}
          <template v-if="from && to"><i aria-hidden="true">·</i> {{ from }} — {{ to }}</template>
        </span>

        <!-- The instruction, in words. A prompt with a blinking cursor says
             "waiting for you" to anyone who has used a terminal and nothing at
             all to anyone who has not, and on a phone there is no hover to
             find out with. This is the one line under the sign in the accent,
             so it is where the eye lands after the box, and it is the last
             thing to arrive. The key is real: see `onKey`. -->
        <span class="go">
          <i class="key" aria-hidden="true">↵</i>
          {{ t("home.projects.go") }}
        </span>
      </span>

      <!-- The shoot: the stem that keeps going once the visitor has decided.
           `pathLength` is an SVG ATTRIBUTE, not a CSS property — declaring it in
           the stylesheet silently does nothing and the dash values below are
           then read as pixels. Normalising it here is what lets the dash maths
           be written as a fraction. -->
      <svg class="shoot" viewBox="0 0 14 78" fill="none" aria-hidden="true">
        <path pathLength="1" d="M7 0 C 7 24, 2 34, 7 48 C 11 60, 5 68, 7 78" />
      </svg>
    </span>
  </a>
</template>

<style scoped>
.label {
  --born: 1;
  /* How close the vine's sap pulse is to the node this hangs from, 0..1,
     written by the scene — the same channel the bud cards get. */
  --sap: 0;
  --ink: #e9f1f8;
  --orange: #fdae52;
  /* ONE unit: the box's outer height. Every measure on the sign is a fraction
     of it, taken from the logo's own proportions, so the sign is the logo at a
     different width rather than a lookalike. The values come in from the
     script (`styleVars`, tuned in the dev panel); the fallbacks here are the
     same numbers, so the stylesheet stands on its own.

     This block is the MOBILE set — the chapter's flow layout, which is also
     what the server renders. The hung sign's set is under `.is-driven` below.
     Either way the unit never exceeds what fits between the gutters, so the
     eleven characters and the cursor always make the line. */
  --u: min(var(--u-mobile, 40px), calc((100vw - 4rem) / 7));
  --tilt-x: var(--tilt-x-mobile, 6deg);
  --tilt-y: var(--tilt-y-mobile, -12deg);
  /* The stroke: the box's frame, the bracket, and the bar of the `$`, which in
     the logo are one and the same line. Floored at 2px because a border is
     rounded down to whole device pixels and at 1px the frame vanishes against
     the glyphs, which are not. */
  --s: max(2px, calc(var(--u) * var(--stroke-k, 0.044)));
  /* One step of the extrusion — a share of the unit, so the depth is the same
     fraction of the height at every size instead of a smear at small ones. */
  --step: calc(var(--u) * var(--depth-k, 0.048));
  display: block;
  position: relative;
  /* Only as wide as the sign. This is a fixed-position link over the middle of
     the scene, and every transparent pixel of it is a pixel the free camera in
     explore mode cannot be dragged from. The sprigs overflow it instead, and do
     not take clicks. */
  width: max-content;
  max-width: calc(100vw - 3rem);
  text-decoration: none;
  color: var(--ink);
}
/* The DESKTOP set: the scene is driving the chapter and the sign hangs from
   the node. It GROWS with the viewport, because the curtain it hangs in is a
   world-space object and does — capped in pixels, it read as a price tag on a
   wide screen. */
.is-driven .label {
  --u: min(var(--u-desktop, clamp(40px, 3.8vw, 84px)), calc((100vw - 4rem) / 7));
  --tilt-x: var(--tilt-x-desktop, 6deg);
  --tilt-y: var(--tilt-y-desktop, -12deg);
}

/* Everything below the eyelet swings from it — including on hover, where the
   swing is what says "this is hanging, and you can take it". */
.swing {
  display: block;
  transform-origin: 50% 7px;
  animation: sway var(--sway-period, 8s) ease-in-out infinite;
}
.label:hover .swing,
.label:focus-visible .swing { animation-duration: calc(var(--sway-period, 8s) * 0.375); }
@keyframes sway {
  0%, 100% { rotate: calc(var(--sway, 1.1deg) * -1); }
  50% { rotate: var(--sway, 1.1deg); }
}

/* ── The tie ──────────────────────────────────────────────────────────────── */
.tie {
  display: block;
  position: relative;
  width: 40px;
  /* Long enough that the sign hangs IN the curtain rather than tucked up under
     the node the curtain springs from — and in the unit, so a bigger sign gets
     a longer cord rather than a thread. */
  height: calc(var(--u) * var(--cord-k, 1.76));
  margin: 0 auto;
  pointer-events: none;
}
/* The eyelet keeps its size and its place: the scene anchors the element by a
   point 7px under its top, so this is never the SVG that stretches. */
.eyelet-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 40px;
  height: 14px;
  overflow: visible;
}
/* The cord takes the rest, stretched vertically only — its width is fixed, so
   a mostly vertical line keeps its thickness. */
.cord-svg {
  position: absolute;
  top: 12px;
  left: 0;
  width: 40px;
  height: calc(100% - 12px);
  overflow: visible;
}
.eyelet {
  stroke: var(--accent);
  stroke-width: calc(2.2 + var(--sap) * 1.4);
  fill: #05070a;
  opacity: clamp(0, calc(var(--born) * 3), 1);
}
.cord {
  stroke: var(--accent);
  /* Heavier than it looks like it needs to be: it is drawn across the node's
     own aura, and a 2px line on that pool simply is not there. */
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-dasharray: 1;
  /* Draws itself down from the eyelet before the sign ever appears. */
  stroke-dashoffset: clamp(0, calc(1 - var(--born) * 2.4), 1);
  opacity: 0.9;
}

/* ── The body ─────────────────────────────────────────────────────────────── */
/**
 * The ground the sign stands out of.
 *
 * It hangs in the middle of a curtain of line art in the same accent, and the
 * box is hollow — you read the plant through it. This darkens just enough of
 * the foliage behind for the lettering to have a back.
 */
.body::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 160%;
  height: 220%;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    50% 50% at 50% 50%,
    rgba(3, 6, 10, 0.9) 0%,
    rgba(3, 6, 10, 0.6) 46%,
    rgba(3, 6, 10, 0) 74%
  );
  pointer-events: none;
}
.body {
  display: block;
  position: relative;
  margin-top: -8px;
  /* It DROPS onto the cord: a sign that fades up in place is a sticker. */
  transform: translateY(calc((var(--born) - 1) * var(--u) * 0.62))
    scale(calc(0.8 + 0.2 * clamp(0, calc(var(--born) * 1.6 - 0.6), 1)));
  transform-origin: 50% 0;
  opacity: clamp(0, calc(var(--born) * 2.2 - 0.6), 1);
}

/* ── The sign ─────────────────────────────────────────────────────────────── */
.sign {
  display: flex;
  justify-content: center;
  perspective: calc(var(--u) * 16);
  perspective-origin: 50% 40%;
}
/* The rigid object: the face and every copy behind it turn together. Tilted
   just enough that the copies step out as sides — the tilt is what makes the
   depth visible at all, a stack seen head-on is one outline — and no more:
   this is a line of text first, and every degree past this costs it. */
.board {
  position: relative;
  display: grid;
  transform-style: preserve-3d;
  transform: rotateX(var(--tilt-x, 6deg)) rotateY(var(--tilt-y, -12deg));
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.3, 1);
}
/* It turns to face whoever reaches for it. */
.label:hover .board,
.label:focus-visible .board {
  transform: rotateX(calc(var(--tilt-x, 6deg) / 2)) rotateY(calc(var(--tilt-y, -12deg) / 2));
}

/* Every layer is the whole face again, one step further back and darker. The
   face is `--i: 0`; the copies count up from 1 behind it. */
.layer {
  grid-area: 1 / 1;
  display: flex;
  align-items: stretch;
  gap: calc(var(--u) * 0.02);
  height: var(--u);
  transform: translateZ(calc(var(--i, 0) * var(--step) * -1));
  color: color-mix(in srgb, var(--ink) calc(100% - var(--i, 0) * 8%), #000);
  --cursor: color-mix(in srgb, var(--orange) calc(100% - var(--i, 0) * 8%), #000);
  /* The frame draws itself around, and the bracket down, as the sign arrives —
     the same draw-on every line in this chapter uses, so even the sign
     assembles like the plant it hangs in. */
  --draw: clamp(0, calc(var(--born) * 3 - 1.7), 1);
  pointer-events: none;
}
.layer.face { pointer-events: auto; }
/* The front is the lit one: a soft glow in the chapter's accent, which the
   sap pulse raises as it reaches the node. */
.layer.face .ink {
  filter: drop-shadow(
    0 0 calc(2px + var(--sap) * 10px)
      color-mix(in srgb, var(--accent) calc(var(--glow, 18) * 1% + var(--sap) * 55%), transparent)
  );
}

.bracket {
  position: relative;
  flex: none;
  box-sizing: border-box;
  width: calc(var(--u) * 0.327);
  border: var(--s) solid currentColor;
  border-right: 0;
  -webkit-mask: linear-gradient(to bottom, #000 calc(var(--draw) * 100%), transparent 0);
  mask: linear-gradient(to bottom, #000 calc(var(--draw) * 100%), transparent 0);
}
.box {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 100%;
  padding: 0 calc(var(--u) * 0.13) 0 calc(var(--u) * 0.265);
}
.box::before {
  content: "";
  position: absolute;
  inset: 0;
  border: var(--s) solid currentColor;
  -webkit-mask: conic-gradient(from 180deg at 50% 50%, #000 calc(var(--draw) * 360deg), transparent 0);
  mask: conic-gradient(from 180deg at 50% 50%, #000 calc(var(--draw) * 360deg), transparent 0);
}
/* The `$`, impaled on the box's left edge: its bar IS the stroke. Centred on
   the edge (a hair short of half, the glyph's bar sits at 50.5% of its own
   box), and it lands after the frame has drawn past it. */
.dollar {
  position: absolute;
  left: 0;
  top: calc(var(--u) * 0.158);
  width: calc(var(--u) * 0.412);
  height: calc(var(--u) * 0.656);
  transform: translateX(-49.5%) scale(clamp(0, calc(var(--born) * 6 - 4.5), 1));
  transform-origin: 50% 50%;
  fill: currentColor;
  overflow: visible;
}
.cmd {
  font-family: "Courier New", ui-monospace, monospace;
  font-size: calc(var(--u) * var(--cmd-k, 0.8));
  line-height: calc(var(--u) - 2 * var(--s));
  white-space: nowrap;
  overflow: hidden;
  /* Types in, a character at a time, off the same clock as everything else —
     and the cursor sits in flow after it, so it rides the end of the line the
     way a real one does. `round()` is what makes it characters rather than a
     wipe; where it is not supported the width falls back to auto and the
     command is simply there. */
  --typed: clamp(0, calc(var(--born) * 5 - 4), 1);
  width: calc(round(down, var(--typed) * var(--chars), 1) * 1ch);
}
/* The copies carry their words in a pseudo-element, so the text is in the DOM
   once. */
.cmd::before { content: attr(data-cmd); }
/* The face carries the weight and the copies stay regular, so the sides read
   as a chamfer behind crisp letters rather than as ghosting around thin ones. */
.layer.face .cmd { font-weight: var(--face-weight, 700); }
.cursor {
  flex: none;
  width: calc(var(--u) * 0.433);
  height: calc(var(--u) * 0.77);
  margin-left: calc(var(--u) * 0.123);
  background: var(--cursor);
  opacity: clamp(0, calc(var(--born) * 6 - 4.5), 1);
  animation: blink 1s steps(1) infinite;
}
@keyframes blink { 50% { opacity: 0; } }

/* ── The caption ──────────────────────────────────────────────────────────── */
.caption {
  display: block;
  /* Positioned so it paints ABOVE the body's dark backdrop: that gradient is
     absolutely positioned, and an in-flow caption sits under it, dimmed to
     nothing right where the pool is darkest. */
  position: relative;
  margin-top: calc(var(--u) * 0.32);
  text-align: center;
  font-family: "Courier New", ui-monospace, monospace;
  /* The one fact on the sign, so it is set in the sign's own ink and scales
     with the unit; 13px is the floor a phone still reads. */
  font-size: max(13px, calc(var(--u) * var(--caption-k, 0.28)));
  letter-spacing: 0.08em;
  color: color-mix(in srgb, var(--ink) calc(var(--caption-a, 0.78) * 100%), transparent);
  /* Last to arrive, after the command has finished typing. */
  opacity: clamp(0, calc(var(--born) * 10 - 9), 1);
}
.caption b { font-weight: 400; color: var(--ink); }
.caption i { font-style: normal; color: var(--orange); }

/* ── The instruction ──────────────────────────────────────────────────────── */
.go {
  display: block;
  position: relative;
  margin-top: calc(var(--u) * 0.14);
  text-align: center;
  font-family: "Courier New", ui-monospace, monospace;
  font-size: max(12px, calc(var(--u) * var(--caption-k, 0.28) * 0.9));
  letter-spacing: 0.1em;
  color: var(--accent);
  text-shadow: 0 0 10px color-mix(in srgb, var(--accent) 45%, transparent);
  /* After the caption, which is after the command: the sign explains itself
     in the order a person reads it. */
  opacity: clamp(0, calc(var(--born) * 14 - 13), 1);
}
/* The key, drawn as one: a small cap the glyph sits in. */
.go .key {
  display: inline-block;
  font-style: normal;
  padding: 0 0.4em;
  margin-right: 0.35em;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-bottom-width: 2px;
  border-radius: 3px;
  line-height: 1.35;
}
.label:hover .go,
.label:focus-visible .go { text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 75%, transparent); }

.label:focus-visible { outline: 2px solid var(--accent); outline-offset: 6px; }

/* ── Growth caught on it ──────────────────────────────────────────────────── */
.sprigs {
  position: absolute;
  left: 50%;
  /* In the unit as well, so the growth is caught on THIS sign, not a smaller one. */
  top: calc(var(--u) * var(--sprigs-k, 8.6) * -0.072);
  width: calc(var(--u) * var(--sprigs-k, 8.6));
  height: calc(var(--u) * var(--sprigs-k, 8.6) * 0.35);
  overflow: visible;
  transform: translateX(-50%);
  opacity: calc(var(--born) * var(--born) * 0.9);
  pointer-events: none;
}
.sprigs .stem,
.sprigs .curl {
  stroke: var(--accent);
  stroke-width: 1.6;
  stroke-linecap: round;
}
.sprigs .curl { stroke-width: 1.2; opacity: 0.6; }
.sprigs .leaf {
  fill: color-mix(in srgb, var(--accent) 14%, rgba(4, 9, 13, 0.9));
  stroke: var(--accent);
  stroke-width: 1.2;
  opacity: 0.9;
}
/* They breathe, in opposition, so the pair never reads as one stamped wreath. */
.sprigs .sprig {
  transform-box: view-box;
  transform-origin: 170px 8px;
  animation: rustle 7s ease-in-out infinite;
}
.sprigs .sprig.r { animation-delay: -3.4s; }
@keyframes rustle {
  0%, 100% { rotate: -1.8deg; }
  50% { rotate: 1.8deg; }
}

/* ── The shoot ────────────────────────────────────────────────────────────── */
/* Hangs off the bottom of the sign and grows on hover, then runs the rest of
   the way on the click — the same gesture /projects opens with, so the two
   pages read as one plant rather than two screens. */
.shoot {
  position: absolute;
  left: 50%;
  top: calc(100% - 4px);
  width: 14px;
  height: calc(var(--u) * 1.86);
  overflow: visible;
  transform: translateX(-50%);
  pointer-events: none;
}
.shoot path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0.85;
  transition: stroke-dashoffset 0.5s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.label:hover .shoot path,
.label:focus-visible .shoot path { stroke-dashoffset: 0.5; }
.label.is-leaving .shoot path {
  stroke-dashoffset: 0;
  transition-duration: 0.26s;
}
.label.is-leaving .body {
  transform: translateY(9px) scale(0.98);
  transition: transform 0.26s ease-in;
}

@media (prefers-reduced-motion: reduce) {
  .swing,
  .sprigs .sprig,
  .cursor { animation: none !important; }
  .shoot { display: none; }
  .board,
  .body { transition: none; }
}
</style>
