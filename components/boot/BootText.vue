<template>
  <span :class="textClass"
    >{{ displayedText
    }}<span
      v-if="showCursor"
      class="inline-block w-[0.55em] h-[1em] align-text-bottom bg-green-400 ml-0.5 cursor-blink"
  /></span>
</template>

<script setup lang="ts">
defineOptions({
  name: "BootText",
});

const props = defineProps<{
  text: string;
  color?: "green" | "white" | "cyan" | "yellow" | "red";
  bold?: boolean;
  animate?: boolean; // Allow disabling animation if needed
  speed?: number; // Characters per second (default: 1000)
  isActive?: boolean; // Whether this line is currently active (shows cursor)
}>();

const displayedText = ref("");
const showCursor = ref(false);
const typewriterSpeed = props.speed || 1000; // characters per second
let interval: ReturnType<typeof setInterval> | null = null;

const textClass = computed(() => {
  const classes: string[] = [];

  switch (props.color) {
    case "green":
      classes.push("text-green-400");
      break;
    case "cyan":
      classes.push("text-cyan-400");
      break;
    case "yellow":
      classes.push("text-yellow-400");
      break;
    case "red":
      classes.push("text-red-400");
      break;
    default:
      classes.push("text-white");
  }

  if (props.bold) {
    classes.push("font-bold");
  }

  return classes.join(" ");
});

// Watch for isActive prop changes to show/hide cursor
watch(
  () => props.isActive,
  (newValue) => {
    if (newValue && props.animate !== false) {
      // This line just became active - show cursor while typing
      showCursor.value = true;
    } else {
      // This line is no longer active - hide cursor
      showCursor.value = false;
    }
  }
);

const stopTyping = () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
};

// Typewriter: reveal `props.text` from `from` onwards, one character per tick.
const typeFrom = (from: number) => {
  stopTyping();
  const chars = props.text.split("");
  const msPerChar = 1000 / typewriterSpeed;
  let currentIndex = from;
  interval = setInterval(() => {
    if (currentIndex < chars.length) {
      displayedText.value += chars[currentIndex];
      currentIndex++;
    } else {
      stopTyping();
      // Keep cursor visible if still active, otherwise hide it
      // The watch will handle hiding when another line becomes active
    }
  }, msPerChar);
};

// A line can be rewritten while it is on screen — the memory counter ticking
// up, the model line getting its [OK]. Growth is typed, anything else is
// swapped in place, which is exactly how a BIOS counter behaves.
watch(
  () => props.text,
  (next) => {
    if (props.animate === false) {
      displayedText.value = next;
      return;
    }
    if (next.startsWith(displayedText.value)) {
      typeFrom(displayedText.value.length);
    } else {
      stopTyping();
      displayedText.value = next;
    }
  }
);

onMounted(() => {
  if (import.meta.client && props.animate !== false) {
    // Show cursor only if this line is active
    showCursor.value = props.isActive === true;
    typeFrom(0);
  } else {
    // No animation - show full text immediately
    displayedText.value = props.text;
  }
});

onUnmounted(stopTyping);
</script>
