<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useElementBounding } from "@vueuse/core";
import type { Section } from "~/types/section";

// The finale: a CLI/terminal sign-off — and a real, typeable shell for the
// versed visitor. The head (left) turns to look at this card (right) while the
// signal pulses converge on it: a transmission being received.
//
// Everything above the input is the static, crawlable session (headings + <a>
// CTAs, SSG-ready) that types itself in. Below it, a live prompt accepts
// commands (help, ls, cat, whoami, open …, + a few easter eggs). The typing/blink
// is CSS-only and reduced-motion aware. Pinned/right-aligned by SectionHost.
const props = defineProps<{ section: Section; visible?: boolean }>();

const accent = computed(() => props.section.accent ?? "#00ff9c");

// Bridge to the 3D scene: each command fires a pulse the head receives, and
// briefly flashes the terminal's own glow so the CLI and the rings read as one
// connected signal.
const store = useSectionsStore();
const sending = ref(false);
let sendingTimer: ReturnType<typeof setTimeout> | null = null;
const flash = () => {
  sending.value = true;
  if (sendingTimer) clearTimeout(sendingTimer);
  sendingTimer = setTimeout(() => (sending.value = false), 480);
};

// Publish the card's on-screen position (NDC) so the finale's signal emits from
// the card's real location — viewport- and scroll-aware. We use the card's
// left-centre, the edge facing the head.
const termEl = ref<HTMLElement | null>(null);
const { left, top, height, width } = useElementBounding(termEl);
watch(
  [left, top, height, width],
  () => {
    if (!import.meta.client || !width.value) {
      store.setContactAnchor(null);
      return;
    }
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const px = left.value;
    const py = top.value + height.value / 2;
    store.setContactAnchor({ x: (px / vw) * 2 - 1, y: -((py / vh) * 2 - 1) });
  },
  { immediate: true }
);
onBeforeUnmount(() => store.setContactAnchor(null));

// ----- the little shell ------------------------------------------------------
type Line = { kind: "in" | "out"; text?: string; html?: string };

const LINKS: Record<string, string> = {
  github: "https://github.com/Blaxzter",
  respeak: "https://respeak.io",
};
const FILES: Record<string, string> = {
  "about.txt":
    "Senior fullest-stack dev in Berlin. Berlin → Maastricht → Berlin. I build systems that hold up under load and AI that ships.",
  "stack.txt":
    "TypeScript · Vue/Nuxt · Three.js · Python · embeddings · RAG · Postgres · Docker/k8s",
  "contact.txt": "github.com/Blaxzter · respeak.io",
  "secret.txt": "you found it. now go build something that holds up. ✦",
};

const cmd = ref("");
const focused = ref(false);
const log = ref<Line[]>([]);
const past = shallowRef<string[]>([]); // command history for ↑/↓
const histIdx = ref(-1);
const inputRef = ref<HTMLInputElement | null>(null);
const bodyRef = ref<HTMLElement | null>(null);

const out = (...lines: (string | { html: string })[]) => {
  for (const l of lines)
    log.value.push(
      typeof l === "string" ? { kind: "out", text: l } : { kind: "out", html: l.html }
    );
};

const linkHtml = (url: string, label = url.replace(/^https?:\/\//, "")) =>
  `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;

const HELP = [
  "available commands (they actually run):",
  "  help            this list",
  "  whoami          who you're talking to",
  "  ls / cat <f>    poke around the filesystem",
  "  stack           the toolbox",
  "  contact         ways to reach me",
  "  open <where>    open github | respeak in a new tab",
  "  hire            the only command that matters",
  "  clear           wipe the screen",
  "  …and a few you'll have to discover. (try 'sudo' something)",
];

const NOT_FOUND = [
  (c: string) => `command not found: ${c}. (I only really know 'help'.)`,
  (c: string) => `${c}? never heard of it. try 'help'.`,
  (c: string) => `bash: ${c}: command not found — but I admire the confidence.`,
  (c: string) => `nope. '${c}' isn't a thing here. 'help' is, though.`,
];
const notFound = (c: string) =>
  NOT_FOUND[Math.floor(Math.random() * NOT_FOUND.length)]!(c);

// Each branch pushes its own output (so `clear`/`open` can have side effects).
// User input is only ever rendered as escaped text; the controlled link HTML
// never contains user input.
const run = () => {
  const raw = cmd.value.trim();
  log.value.push({ kind: "in", text: raw });
  if (raw) past.value = [...past.value, raw];
  histIdx.value = -1;
  cmd.value = "";

  // Fire a pulse the head receives + flash the terminal: CLI ↔ rings, one signal.
  if (raw) {
    store.emitPulse();
    flash();
  }

  const [name, ...args] = raw.split(/\s+/);
  const arg = (args.join(" ") || "").toLowerCase();
  switch ((name ?? "").toLowerCase()) {
    case "":
      break;
    case "help":
    case "?":
    case "man":
      out(...HELP);
      break;
    case "whoami":
      out(
        "frederic — senior fullest-stack dev, Berlin.",
        "you: a person of evidently excellent taste."
      );
      break;
    case "ls":
    case "dir":
      out("about.txt   stack.txt   contact.txt   secret.txt   respeak/   github/");
      break;
    case "cat": {
      const f = args[0] ?? "";
      if (!f) out("cat: i need something to read. try 'ls' first.");
      else if (f === "respeak/" || f === "github/")
        out(`cat: ${f}: is a directory — try 'open ${f.replace("/", "")}'.`);
      else out(FILES[f] ?? `cat: ${f}: No such file (try 'ls').`);
      break;
    }
    case "stack":
      out(FILES["stack.txt"]!, "…plus a frankly concerning amount of YAML.");
      break;
    case "contact":
      out(
        { html: `${linkHtml(LINKS.github!)} &nbsp; ${linkHtml(LINKS.respeak!)}` },
        "↑ pick your poison."
      );
      break;
    case "open": {
      const where = (args[0] ?? "").toLowerCase();
      if (LINKS[where]) {
        out(`→ opening ${LINKS[where]!.replace(/^https?:\/\//, "")} …`);
        window.open(LINKS[where], "_blank", "noopener");
      } else {
        out("open: try 'open github' or 'open respeak'.");
      }
      break;
    }
    case "clear":
    case "cls":
      log.value = [];
      break;
    case "echo":
      out(args.length ? args.join(" ") : "echo … echo … echo …");
      break;
    case "pwd":
      out("/home/frederic/berlin");
      break;
    case "ping":
      out("PONG. latency: Berlin → you. let's lower it — say hi.");
      break;
    case "date":
      out(new Date().toString(), "(best time to reach out: now.)");
      break;
    // --- easter eggs: something funny for the curious ---
    case "sudo": {
      if (!arg) out("sudo what? absolute power needs an object.");
      else if (/^hire/.test(arg))
        out({
          html: `escalating privileges… ✅ granted. you may now email me — ${linkHtml(
            LINKS.github!
          )}`,
        });
      else if (arg.startsWith("rm")) out("🙅 not on my watch, not even with sudo.");
      else if (arg.includes("sandwich")) out("poof 🥪 you're a sandwich.");
      else
        out(
          "[sudo] password for visitor: ********",
          "nope — you already have root over your own career. 😉"
        );
      break;
    }
    case "rm":
      out("🙅 nice try — everything here is load-bearing.");
      break;
    case "vim":
    case "vi":
      out("you're in vim now. (jk — :q worked, unlike for most people.)");
      break;
    case "exit":
    case "quit":
    case "q":
      out("there is no exit — only scroll. (the window's X works, though.)");
      break;
    case "matrix":
      out("🟢 wake up… the head's been in the matrix this whole time.");
      break;
    case "hire":
    case "coffee":
      out({
        html: `excellent call. let's talk — ${linkHtml(LINKS.github!)} ☕`,
      });
      break;
    case "sl":
      out("🚂 woo woo… (you typed it too fast, didn't you.)");
      break;
    default:
      out(notFound(name ?? ""));
  }

  if (log.value.length > 80) log.value = log.value.slice(-80);
  nextTick(() => {
    bodyRef.value?.scrollTo({ top: bodyRef.value.scrollHeight });
  });
};

const histPrev = () => {
  if (!past.value.length) return;
  histIdx.value =
    histIdx.value < 0 ? past.value.length - 1 : Math.max(0, histIdx.value - 1);
  cmd.value = past.value[histIdx.value] ?? "";
};
const histNext = () => {
  if (histIdx.value < 0) return;
  histIdx.value += 1;
  if (histIdx.value >= past.value.length) {
    histIdx.value = -1;
    cmd.value = "";
  } else {
    cmd.value = past.value[histIdx.value] ?? "";
  }
};

const focusInput = () => inputRef.value?.focus();
</script>

<template>
  <article
    ref="termEl"
    class="terminal"
    :class="{ 'is-visible': visible, sending }"
    :style="{ '--accent': accent }"
    aria-label="Contact"
    @click="focusInput"
  >
    <header class="term-bar">
      <span class="term-dot" />
      <span class="term-dot" />
      <span class="term-dot" />
      <span class="term-title">frederic@berlin — contact</span>
    </header>

    <div ref="bodyRef" class="term-body">
      <!-- Static, crawlable session (types itself in). -->
      <p class="t-line cmd" style="--i: 0">
        <span class="prompt">frederic@berlin:~$</span> whoami
      </p>
      <p class="t-line out" style="--i: 1">systems that scale · AI that ships</p>

      <h2 class="t-line headline" style="--i: 2">{{ section.title }}</h2>
      <p class="t-line prose" style="--i: 3">
        The thread runs straight through: a lattice of weights learning to
        generate, embedding spaces measuring meaning, systems that stay up when the
        load arrives. I'm still at
        <a href="https://respeak.io" target="_blank" rel="noopener">Respeak</a>,
        most useful where <strong>systems that scale</strong> meet
        <strong>AI that ships</strong>.
      </p>

      <p class="t-line cmd" style="--i: 4">
        <span class="prompt">frederic@berlin:~$</span> contact --open
      </p>
      <div class="t-line links" style="--i: 5">
        <a
          class="token"
          href="https://github.com/Blaxzter"
          target="_blank"
          rel="noopener"
          >[ github.com/Blaxzter ]</a
        >
        <a
          class="token"
          href="https://respeak.io"
          target="_blank"
          rel="noopener"
          >[ respeak.io ]</a
        >
      </div>

      <!-- Live command log. -->
      <template v-for="(line, i) in log" :key="i">
        <p v-if="line.kind === 'in'" class="log cmd">
          <span class="prompt">frederic@berlin:~$</span> {{ line.text }}
        </p>
        <!-- eslint-disable-next-line vue/no-v-html (controlled link markup only) -->
        <p v-else-if="line.html" class="log resp" v-html="line.html" />
        <p v-else class="log resp">{{ line.text }}</p>
      </template>

      <!-- The live prompt. -->
      <form class="t-line term-prompt" style="--i: 6" @submit.prevent="run">
        <span class="prompt">frederic@berlin:~$</span>
        <input
          ref="inputRef"
          v-model="cmd"
          class="term-field"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="focused ? '' : 'type a command — try: help'"
          aria-label="Terminal input — try typing help"
          @focus="focused = true"
          @blur="focused = false"
          @keydown.up.prevent="histPrev"
          @keydown.down.prevent="histNext"
        />
        <span v-if="!focused && !cmd" class="cursor" aria-hidden="true" />
      </form>
    </div>
  </article>
</template>

<style scoped>
.terminal {
  width: 100%;
  max-width: 40rem;
  margin: 0 auto;
  font-family: "Courier New", monospace;
  color: #e8fff5;
  background: rgba(4, 10, 8, 0.66);
  backdrop-filter: blur(7px);
  border: 1px solid color-mix(in srgb, var(--accent, #00ff9c) 45%, transparent);
  border-radius: 0.6rem;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4),
    0 18px 60px rgba(0, 0, 0, 0.55),
    0 0 42px color-mix(in srgb, var(--accent, #00ff9c) 18%, transparent);
  overflow: hidden;
  cursor: text;
  position: relative;
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
/* A gentle ambient "breathe": an inner edge glow that pulses while the card is
   live — the terminal idling like a piece of running hardware. Kept on a pseudo
   layer (inset shadow) so it never fights the outer .sending command flash. */
.terminal::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 0 26px color-mix(in srgb, var(--accent, #00ff9c) 28%, transparent);
  opacity: 0;
}
.terminal.is-visible::after {
  animation: term-breathe 4.2s ease-in-out infinite;
}
@keyframes term-breathe {
  0%,
  100% {
    opacity: 0.18;
  }
  50% {
    opacity: 0.6;
  }
}
.terminal.is-visible {
  opacity: 1;
  transform: translateY(0);
}
/* A command was sent — flash the terminal's glow so the CLI and the signal rings
   read as one connected pulse. */
.terminal.sending {
  border-color: color-mix(in srgb, var(--accent, #00ff9c) 85%, transparent);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4),
    0 18px 60px rgba(0, 0, 0, 0.55),
    0 0 60px color-mix(in srgb, var(--accent, #00ff9c) 45%, transparent);
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

/* Window chrome */
.term-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.8rem;
  border-bottom: 1px solid
    color-mix(in srgb, var(--accent, #00ff9c) 25%, transparent);
  background: rgba(0, 0, 0, 0.35);
}
.term-dot {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent, #00ff9c) 55%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent, #00ff9c) 60%, transparent);
}
.term-dot:nth-child(2) {
  opacity: 0.6;
}
.term-dot:nth-child(3) {
  opacity: 0.35;
}
.term-title {
  margin-left: 0.5rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.6;
}

.term-body {
  padding: 1.2rem 1.35rem 1.3rem;
  max-height: 60vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--accent, #00ff9c) 40%, transparent)
    transparent;
}

/* Static intro lines type/slide in, staggered by --i, once the card is visible. */
.t-line {
  margin: 0 0 0.5rem;
  line-height: 1.55;
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity 0.45s ease, transform 0.45s ease;
  transition-delay: calc(var(--i) * 0.16s);
}
.is-visible .t-line {
  opacity: 1;
  transform: translateX(0);
}

.cmd {
  color: #cfe9df;
  font-size: 0.92rem;
}
.prompt {
  color: var(--accent, #00ff9c);
  font-weight: 700;
  text-shadow: 0 0 10px color-mix(in srgb, var(--accent, #00ff9c) 55%, transparent);
  white-space: nowrap;
}
.out {
  color: var(--accent, #00ff9c);
  font-size: 0.92rem;
}
.out::before {
  content: "> ";
  opacity: 0.7;
}

.headline {
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  font-weight: 800;
  line-height: 1.12;
  color: #fff;
  margin: 0.85rem 0 0.65rem;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.7);
}
.prose {
  font-size: 0.93rem;
  opacity: 0.9;
}
.prose strong {
  color: var(--accent, #00ff9c);
  font-weight: 700;
}
.prose a {
  color: var(--accent, #00ff9c);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin: 0.1rem 0 0.3rem;
}
.token {
  pointer-events: auto;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--accent, #00ff9c);
  text-decoration: none;
  padding: 0.25rem 0.05rem;
  transition: text-shadow 0.18s ease, transform 0.18s ease;
}
.token:hover {
  transform: translateY(-1px);
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent, #00ff9c) 80%, transparent);
}

/* Live log lines (no stagger; they appear as typed). */
.log {
  margin: 0 0 0.35rem;
  line-height: 1.5;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.log.resp {
  color: var(--accent, #00ff9c);
  opacity: 0.92;
}
.log.resp :deep(a),
.log.resp a {
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* The live prompt line. */
.term-prompt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}
.term-field {
  flex: 1 1 auto;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: #e8fff5;
  font-family: inherit;
  font-size: 0.92rem;
  caret-color: var(--accent, #00ff9c);
}
.term-field::placeholder {
  color: color-mix(in srgb, var(--accent, #00ff9c) 55%, #889);
  opacity: 0.7;
}

.cursor {
  display: inline-block;
  width: 0.6rem;
  height: 1.02rem;
  margin-left: -0.25rem;
  vertical-align: text-bottom;
  background: var(--accent, #00ff9c);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent, #00ff9c) 70%, transparent);
  animation: term-blink 1.05s steps(1) infinite;
}
@keyframes term-blink {
  0%,
  50% {
    opacity: 1;
  }
  50.01%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .terminal,
  .t-line {
    transition: none;
  }
  .cursor,
  .terminal.is-visible::after {
    animation: none;
  }
  .terminal.is-visible::after {
    opacity: 0.28;
  }
}
</style>
