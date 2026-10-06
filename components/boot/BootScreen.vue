<template>
  <div
    ref="rootRef"
    class="boot-root fixed inset-0 z-50"
    :class="{ 'is-through': through, 'no-motion': reducedMotion }"
  >
    <!-- The tube's lens: barrel distortion, and the three guns drifting apart
         toward the edges. The map is drawn once on mount (see buildLensMap). -->
    <svg class="boot-defs" aria-hidden="true" width="0" height="0">
      <filter
        v-if="lensMap"
        :id="lensId"
        x="0"
        y="0"
        width="1"
        height="1"
        color-interpolation-filters="sRGB"
      >
        <feImage
          :href="lensMap"
          x="0"
          y="0"
          :width="lensSize.w"
          :height="lensSize.h"
          preserveAspectRatio="none"
          result="map"
        />
        <feDisplacementMap
          v-for="gun in GUNS"
          :key="`bend-${gun.name}`"
          in="SourceGraphic"
          in2="map"
          :scale="lensSize.w * LENS_RANGE * gun.spread"
          xChannelSelector="R"
          yChannelSelector="G"
          :result="`bent-${gun.name}`"
        />
        <feColorMatrix
          v-for="gun in GUNS"
          :key="`gun-${gun.name}`"
          :in="`bent-${gun.name}`"
          type="matrix"
          :values="gun.matrix"
          :result="gun.name"
        />
        <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
        <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
      </filter>
    </svg>

    <!-- The monitor. The room is the well's shadow, so the only way through the
         black is the glass: at handover the picture goes and the scene is on
         the tube, then the set is zoomed into until the tube is the page. -->
    <div ref="monitorRef" class="monitor" :class="{ 'is-on': powered, 'is-tuning': tuning }">
      <div class="bezel">
        <div class="well">
          <div ref="screenRef" class="screen">
            <div class="tube">
              <div class="picture screen-flicker">
                <div
                  ref="lensRef"
                  class="lens boot-screen text-green-400"
                  :style="lensMap ? { filter: `url(#${lensId}) ${PHOSPHOR}` } : undefined"
                >
                  <!-- POST -->
                  <template v-if="bootState.phase === 'booting'">
                    <!-- The vendor badge, where AMI and Award put theirs. -->
                    <BrandMark class="bios-badge" :weight="2" />
                    <div ref="bootSequenceRef" class="h-full">
                      <BootSequence
                        @complete="onBootSequenceComplete"
                        @easter-egg="onEasterEgg"
                        @boot-menu="onBootMenuRequested"
                      />
                    </div>
                  </template>

                  <!-- DEL -->
                  <div
                    v-else-if="bootState.phase === 'easter-egg'"
                    ref="easterEggRef"
                    class="phase-scroll"
                    data-lenis-prevent
                  >
                    <BootEasterEgg @exit="onEasterEggExit" @continue="onEasterEggContinue" />
                  </div>

                  <!-- F10 -->
                  <div
                    v-else-if="bootState.phase === 'menu'"
                    ref="menuRef"
                    class="phase-scroll"
                    data-lenis-prevent
                  >
                    <BootMenu @select="onMenuSelect" />
                  </div>

                  <!-- POST is done and the scene is not: the logo's own cursor, waiting. -->
                  <div
                    v-else-if="bootState.phase === 'loading-scene'"
                    class="h-full flex items-center justify-center"
                  >
                    <span class="block-cursor" role="status" :aria-label="t('shell.boot.loading')" />
                  </div>
                </div>
              </div>
              <div ref="glassRef" class="glass">
                <BootCrtEffect />
              </div>
            </div>
          </div>
        </div>

        <!-- The case, over the room, with the glass cut out of it. -->
        <div class="shell" aria-hidden="true" />
        <div class="chin" aria-hidden="true">
          <span class="maker">FABRAHAM</span>
          <span class="model">FA-1996 · Colour Display</span>
          <span class="vents" />
          <span class="power-led" :class="{ 'is-on': powered }" />
          <span class="power-button" />
        </div>
      </div>
      <div class="lip" aria-hidden="true" />

      <!-- Key hints, under the set, for whatever the tube is showing. The
           screens' own footers can be scrolled out of view; these cannot. They
           stay through the handover and go with the set. -->
      <div class="hints" :class="{ 'is-hidden': !hints.length }">
        <BootText v-for="hint in hints" :key="hint" :text="hint" color="white" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * `stage` is the layer the page is on (the 3D scene). At handover it is shrunk
 * onto the tube and grows with the zoom, so the scene is ON the monitor rather
 * than behind a hole in it. Without one (the demo page) the zoom just opens
 * onto whatever is underneath.
 */
const props = defineProps<{ stage?: HTMLElement | null }>();

const bootState = useBootStateStore();
const { reducedMotion } = usePreferences();
const quality = useRenderQuality();
const { gsap } = useGsap();

const rootRef = ref<HTMLElement | null>(null);
const monitorRef = ref<HTMLElement | null>(null);
const screenRef = ref<HTMLElement | null>(null);
const lensRef = ref<HTMLElement | null>(null);
const glassRef = ref<HTMLElement | null>(null);
const bootSequenceRef = ref<HTMLElement | null>(null);
const easterEggRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);

// Message keys per phase; the lists themselves live in i18n/locales/*/shell.json.
const HINTS: Partial<Record<string, string>> = {
  booting: "shell.hints.booting",
  "easter-egg": "shell.hints.easterEgg",
  menu: "shell.hints.menu",
};
const { t, tm, rt } = useI18n();
const localePath = useLocalePath();
const hints = computed(() => {
  const key = HINTS[bootState.phase];
  return key ? (tm(key) as unknown[]).map((m) => rt(m as Parameters<typeof rt>[0])) : [];
});

const powered = ref(false);
const tuning = ref(false);
const through = ref(false);
let finishing = false;

// ── The lens ──────────────────────────────────────────────────────────────────
// Each pixel samples from a little further out than itself, more so the further
// it is from the centre (r²): the picture bulges, and the corners pull away from
// the glass the way a real tube's do. The red gun samples a touch further than
// green, blue a touch nearer, so the fringes appear only where the bend does.
const LENS_BEND = 0.035; // outward pull at a corner, as a fraction of the half-size, per r²
const LENS_RANGE = 0.08; // the map's full scale, as a fraction of the lens width
const GUNS = [
  { name: "r", spread: 1.07, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
  { name: "g", spread: 1, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" },
  { name: "b", spread: 0.93, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" },
];

// boot.css gives `.boot-screen` this as its filter; an inline filter replaces
// the whole list, so it is carried along.
const PHOSPHOR = "contrast(1.15) brightness(1.08) saturate(1.2)";

const lensId = `boot-lens-${useId()}`;
const lensMap = ref<string | null>(null);
const lensSize = reactive({ w: 0, h: 0 });

// Encoded as displacement in units of the lens WIDTH, so one map serves every
// size and `scale` is just width × range.
const buildLensMap = () => {
  const w = 200;
  const h = 150;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = ((x + 0.5) / w) * 2 - 1;
      const ny = ((y + 0.5) / h) * 2 - 1;
      const r2 = nx * nx + ny * ny;
      const dx = (nx * LENS_BEND * r2) / 2;
      const dy = (ny * LENS_BEND * r2 * (h / w)) / 2;
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(255 * (0.5 + dx / LENS_RANGE));
      img.data[i + 1] = Math.round(255 * (0.5 + dy / LENS_RANGE));
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
};

let lensObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!import.meta.client) return;
  // The page is under the set and must not scroll behind it; the tube's own
  // scrolling screens are `data-lenis-prevent`, so they still do.
  setScrollLock("boot", true);
  const lens = lensRef.value;
  if (lens) {
    // offset* is the padded box, untouched by the power-on's scale transform.
    lensObserver = new ResizeObserver(() => {
      lensSize.w = lens.offsetWidth;
      lensSize.h = lens.offsetHeight;
    });
    lensObserver.observe(lens);
  }
  // Not on a software rasteriser: the lens is three displacement passes over
  // the whole picture, re-run on the CPU for every line POST prints.
  if (!quality.software.value) lensMap.value = buildLensMap();

  // Power on first; POST starts once the picture has mostly opened.
  requestAnimationFrame(() => {
    powered.value = true;
  });
  setTimeout(() => bootState.setPhase("booting"), reducedMotion.value ? 50 : 300);
});

onUnmounted(() => {
  lensObserver?.disconnect();
  setScrollLock("boot", false);
});

// ── Phases ────────────────────────────────────────────────────────────────────
const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const fade = (el: HTMLElement, duration: number) =>
  gsap.to(el, { opacity: 0, duration: reducedMotion.value ? 0.1 : duration });

// The scene is loaded behind the monitor while POST runs; if it is not there
// yet the cursor waits for it.
const whenSceneReady = (then: () => void) => {
  if (bootState.sceneReady) return then();
  bootState.setPhase("loading-scene");
  const unwatch = watch(
    () => bootState.sceneReady,
    (ready) => {
      if (!ready) return;
      unwatch();
      then();
    }
  );
};

const onBootSequenceComplete = () => whenSceneReady(handover);

const onBootMenuRequested = async () => {
  if (bootSequenceRef.value) await fade(bootSequenceRef.value, 0.3);
  bootState.setPhase("menu");
};

const onEasterEgg = async () => {
  if (bootSequenceRef.value) await fade(bootSequenceRef.value, 0.3);
  bootState.setPhase("easter-egg");
};

const onEasterEggExit = async () => {
  if (easterEggRef.value) await fade(easterEggRef.value, 0.3);
  bootState.setPhase("booting");
};

const onEasterEggContinue = async () => {
  if (easterEggRef.value) await fade(easterEggRef.value, 0.3);
  bootState.setPhase("menu");
};

const onMenuSelect = async (route: string) => {
  if (menuRef.value) await fade(menuRef.value, 0.3);
  if (route === "/") {
    whenSceneReady(handover);
  } else {
    // Leaving the page takes the monitor with it; nothing to zoom into.
    await navigateTo(localePath(route));
    bootState.completeBootSequence();
  }
};

// ── Handover ──────────────────────────────────────────────────────────────────
// 1. Tune through: a flash on the tube, and under it the picture goes and the
//    glass turns clear. The stage has already been shrunk onto the tube, so
//    what shows through is the scene, framed by the set, under the scanlines.
// 2. Zoom: the monitor grows about the tube's centre until the tube is larger
//    than the window. The stage grows in lockstep until it is whole, which is
//    also the moment the tube has reached the middle of the window; from there
//    the set keeps growing past the edges of a scene that has stopped.
// 3. The case, the room and the scanlines fade, and the page is the scene.
const ZOOM_S = 1.9;
const HOLD_MS = 650;

const handover = async () => {
  if (finishing) return;
  finishing = true;

  const root = rootRef.value;
  const monitor = monitorRef.value;
  const screen = screenRef.value;
  const stage = props.stage ?? null;

  // No zoom without motion, and none without a GPU. On a software rasteriser
  // the push is the whole set rescaled and recomposited on the CPU every frame,
  // which comes out near 20 fps on a fast machine; a fade is two layers
  // blending, and it is smooth.
  const software = quality.software.value;
  if (reducedMotion.value || software || !root || !monitor || !screen) {
    if (root) await gsap.to(root, { opacity: 0, duration: reducedMotion.value ? 0.15 : 0.5 });
    bootState.completeBootSequence();
    return;
  }

  const r = screen.getBoundingClientRect();
  const m = monitor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const off = { x: vw / 2 - cx, y: vh / 2 - cy };

  // The stage covers the tube (cover-fit, so no black bars on a 4:3 glass),
  // with a little to spare: edge to edge, the page shows through as a hairline.
  // `whole` is the monitor scale at which the stage is back to 1.
  const s0 = Math.max(r.width / vw, r.height / vh) * 1.04;
  const whole = 1 / s0;
  // Past covering the window by enough that the rounded corners are gone too.
  const end = Math.max(vw / r.width, vh / r.height) * 1.25;

  const place = (scale: number) => {
    const u = whole > 1.0001 ? Math.min(1, Math.log(scale) / Math.log(whole)) : 1;
    gsap.set(monitor, { x: off.x * u, y: off.y * u, scale });
    if (stage) {
      gsap.set(stage, {
        x: -off.x * (1 - u),
        y: -off.y * (1 - u),
        scale: Math.min(1, s0 * scale),
      });
    }
  };
  gsap.set(monitor, { transformOrigin: `${cx - m.left}px ${cy - m.top}px` });
  place(1);

  tuning.value = true;
  await sleepMs(140);
  through.value = true;
  await sleepMs(HOLD_MS);

  // Exponential in scale, so the zoom reads as one steady push.
  const zoom = { t: 0 };
  const tl = gsap.timeline();
  tl.to(zoom, {
    t: 1,
    duration: ZOOM_S,
    ease: "power2.inOut",
    onUpdate: () => place(Math.pow(end, zoom.t)),
  });
  if (glassRef.value) tl.to(glassRef.value, { opacity: 0, duration: 0.9 }, 0.35);
  tl.to(root, { opacity: 0, duration: 0.45, ease: "power1.in" }, ZOOM_S - 0.45);
  await tl;

  if (stage) gsap.set(stage, { clearProps: "transform" });
  bootState.completeBootSequence();
};

onUnmounted(() => {
  // Leaving mid-zoom must not strand the scene shrunk on a monitor that is gone.
  if (props.stage) gsap.set(props.stage, { clearProps: "transform" });
});
</script>
