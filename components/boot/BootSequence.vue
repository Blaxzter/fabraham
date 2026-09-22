<template>
  <div ref="containerRef" class="h-full flex flex-col overflow-hidden">
    <div class="space-y-0.5">
      <BootLine v-for="(line, index) in visibleLines" :key="index">
        <component :is="getLineWithActiveState(line, index)" />
      </BootLine>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent, cloneVNode, type VNode } from "vue";
import { BOOTED_SESSION_KEY } from "~/stores/BootState";

/**
 * The POST screen. Eleven lines, and the length is set by the load, not a
 * script: the memory test counts the head model's bytes as they arrive and the
 * model line holds until the scene says it is ready. On a fast connection the
 * whole thing is about three seconds; on a slow one it stretches, and the
 * visitor can see why. A cached visit still gets `MIN_ON_SCREEN_MS` so it does
 * not flash. Any key, click, tap or scroll skips to the end.
 *
 * `mode`: "auto" reads the session flag (see BOOTED_SESSION_KEY) and boots warm
 * on a repeat load; the demo page forces one or the other.
 */
const props = withDefaults(defineProps<{ mode?: "auto" | "cold" | "warm" }>(), {
  mode: "auto",
});

const emit = defineEmits<{
  complete: [];
  easterEgg: [];
  bootMenu: [];
}>();

const bootState = useBootStateStore();
const { reducedMotion } = usePreferences();

type Line = () => VNode;
const containerRef = ref<HTMLElement | null>(null);
const visibleLines = ref<Line[]>([]);
const activeLineIndex = ref(-1); // the line that carries the cursor

// Function to add isActive prop to VNode
const getLineWithActiveState = (line: Line, index: number) => {
  const vnode = line();
  // Add isActive prop to all VNodes (non-component elements like <br> will ignore it)
  if (vnode && typeof vnode.type !== "string") {
    return cloneVNode(vnode, { isActive: index === activeLineIndex.value });
  }
  return vnode;
};

const BootTextComponent = resolveComponent("BootText");
type Color = "green" | "white" | "cyan" | "yellow" | "red";
const T =
  (text: string, color: Color, bold = false): Line =>
  () =>
    h(BootTextComponent, { animate: true, text, color, bold });
const BR: Line = () => h("br");

// ── The two honest lines ──────────────────────────────────────────────────────
// The memory counter advances against `loadProgress`, but never faster than
// one step per `MEM_STEP_MS`, so a cached load still counts up instead of
// landing on [OK] in one frame.
const MEM_STEPS = ["16MB", "512MB", "4GB", "16GB", "32GB"];
const MEM_STEP_MS = 120;
const memShown = ref(0);
const memByProgress = computed(() =>
  Math.min(MEM_STEPS.length - 1, Math.floor(bootState.loadProgress * (MEM_STEPS.length - 1) + 1e-6))
);
const memDone = computed(
  () => memShown.value === MEM_STEPS.length - 1 && bootState.loadProgress >= 1
);
const memLine: Line = () =>
  h(BootTextComponent, {
    animate: true,
    text: `Testing memory: ${MEM_STEPS[memShown.value]}${memDone.value ? " [OK]" : ""}`,
    color: "green",
  });
const modelLine: Line = () =>
  h(BootTextComponent, {
    animate: true,
    text: `Loading GLTF models...${bootState.sceneReady ? " [OK]" : ""}`,
    color: "green",
  });

/** One POST step: a line to show, then a pause in seconds or a condition to hold on. */
type Step = { line: Line; enter?: () => void; wait?: number | (() => boolean) };

// The counter only runs while its line is on screen; started any earlier it
// would have finished before anyone could see it count.
let memTicker: ReturnType<typeof setInterval> | null = null;
const startMemTicker = () => {
  memTicker = setInterval(() => {
    if (memShown.value < memByProgress.value) memShown.value++;
  }, MEM_STEP_MS);
};

const cold: Step[] = [
  { line: T("FABRAHAM BIOS v3.14.2025", "cyan", true), wait: 0.1 },
  { line: T("Copyright (C) 2025, Fabraham Systems", "white"), wait: 0.3 },
  { line: BR },
  { line: T("Detecting hardware configuration...", "green"), wait: 0.25 },
  { line: T("CPU: Neural Processing Unit @4.2GHz [OK]", "green"), wait: 0.12 },
  { line: T("GPU: WebGL Rendering Engine v2.0 [OK]", "green"), wait: 0.12 },
  { line: T("Memory: 32GB DDR5-6000 [OK]", "green"), wait: 0.15 },
  { line: BR },
  { line: memLine, enter: startMemTicker, wait: () => memDone.value },
  { line: modelLine, wait: () => bootState.sceneReady },
  { line: T("Compiling shaders [OK]", "green"), wait: 0.15 },
  { line: BR },
  { line: T("All systems operational.", "green", true), wait: 0.25 },
  { line: T("Booting to home screen...", "cyan"), wait: 0.35 },
];

const warm: Step[] = [
  { line: T("FABRAHAM BIOS v3.14.2025", "cyan", true), wait: 0.1 },
  { line: T("Resuming...", "green"), wait: 0.45 },
];

const MIN_ON_SCREEN_MS = { cold: 1600, warm: 600 };

// ── Running it ────────────────────────────────────────────────────────────────
const skipped = ref(false);
let cancelled = false;
const skipWaiters = new Set<() => void>();

// A little unevenness between lines reads as hardware. Kept tiny — the old
// 0.8 s jitter was most of the old boot's length.
const jitter = () => (reducedMotion.value ? 0 : Math.random() * 0.1);

const sleep = (seconds: number) =>
  new Promise<void>((resolve) => {
    if (skipped.value || seconds <= 0) return resolve();
    const timer = setTimeout(done, seconds * 1000);
    function done() {
      clearTimeout(timer);
      skipWaiters.delete(done);
      resolve();
    }
    skipWaiters.add(done);
  });

const until = (cond: () => boolean) =>
  new Promise<void>((resolve) => {
    if (cond() || skipped.value) return resolve();
    const stop = watchEffect(() => {
      if (cond() || skipped.value) {
        resolve();
        nextTick(stop);
      }
    });
  });

const scrollToBottom = () =>
  nextTick(() => {
    if (containerRef.value) containerRef.value.scrollTop = containerRef.value.scrollHeight;
  });

const show = (line: Line) => {
  visibleLines.value.push(line);
  activeLineIndex.value = visibleLines.value.length - 1;
  scrollToBottom();
};

const isWarm = () => {
  if (props.mode !== "auto") return props.mode === "warm";
  try {
    return sessionStorage.getItem(BOOTED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
};

const run = async () => {
  const warmBoot = isWarm();
  const steps = warmBoot ? warm : cold;
  const started = performance.now();

  for (const step of steps) {
    if (cancelled) return;
    step.enter?.();
    show(step.line);
    if (skipped.value) continue;
    if (typeof step.wait === "number") await sleep(step.wait + jitter());
    else if (step.wait) await until(step.wait);
  }
  // On a skip the counter jumps to the end so the screen it leaves is complete.
  memShown.value = MEM_STEPS.length - 1;

  const left = MIN_ON_SCREEN_MS[warmBoot ? "warm" : "cold"] - (performance.now() - started);
  if (!skipped.value && left > 0) await sleep(left / 1000);
  if (!cancelled) emit("complete");
};

const skip = () => {
  if (skipped.value) return;
  skipped.value = true;
  for (const done of skipWaiters) done();
};

const stop = () => {
  cancelled = true;
  if (memTicker) clearInterval(memTicker);
  memTicker = null;
};

// ── Keys ──────────────────────────────────────────────────────────────────────
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Delete") {
    stop();
    emit("easterEgg");
    return;
  }
  if (e.key === "F10") {
    e.preventDefault();
    stop();
    emit("bootMenu");
    return;
  }
  // A browser shortcut is not a request to skip.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  skip();
};
const onPointer = () => skip();

onMounted(() => {
  if (!import.meta.client) return;
  run();
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("pointerdown", onPointer);
  window.addEventListener("wheel", onPointer, { passive: true });
  window.addEventListener("touchmove", onPointer, { passive: true });
});

onUnmounted(() => {
  stop();
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("pointerdown", onPointer);
  window.removeEventListener("wheel", onPointer);
  window.removeEventListener("touchmove", onPointer);
});
</script>
