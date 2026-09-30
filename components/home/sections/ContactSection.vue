<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useElementBounding, useMediaQuery } from "@vueuse/core";
import type { Section } from "~/types/section";
import { LIMITS, parseContact } from "~/worker/contact";

// The finale: a CLI/terminal sign-off — and a real, typeable shell for the
// versed visitor. The head (left) turns to look at this card (right) while the
// signal pulses converge on it: a transmission being received.
//
// Everything above the input is the static, crawlable session (headings + <a>
// CTAs, SSG-ready) that types itself in. Below it, a live prompt accepts
// commands (help, ls, cat, whoami, open, mail …, + a few easter eggs). The typing/blink
// is CSS-only and reduced-motion aware. Pinned/right-aligned by SectionHost.
const props = defineProps<{ section: Section; visible?: boolean }>();

const accent = computed(() => props.section.accent ?? "#00ff9c");
const { t, tm, rt } = useI18n();
/** A message that is an array of lines (help, multi-line replies). */
const lines = (key: string) => (tm(key) as unknown as Parameters<typeof rt>[0][]).map((m) => rt(m));

// Bridge to the 3D scene: each command fires a pulse the head receives, and
// briefly flashes the terminal's own glow so the CLI and the rings read as one
// connected signal.
const store = useSectionsStore();
const sceneControl = useSceneControlStore();
const sending = ref(false);

/**
 * Hand the camera to the visitor.
 *
 * The whole scene has been playing down one fixed lens the entire way down the
 * page; this is the point where they get to walk around it. Lives here, at the
 * finale, because it is the only place the run is over — offering it earlier
 * would invite someone to leave the story halfway through it.
 *
 * ExploreMode owns everything that happens next (the scrubber, the way back).
 */
const enterExplore = () => {
  sceneControl.exploreMode = true;
  sceneControl.cameraControlMode = "orbit";
};
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
// `prompt` replaces the shell prompt on an echoed input line — `mail` asks its
// questions with their own ("name:", "> ") the way mail(1) does.
type Line = { kind: "in" | "out"; text?: string; html?: string; prompt?: string };

const LINKS: Record<string, string> = {
  github: "https://github.com/Blaxzter",
  respeak: "https://respeak.io",
};
const STACK = "TypeScript · Vue/Nuxt · Three.js · Python · embeddings · RAG · Postgres · Docker/k8s";
// Read at the moment `cat` runs, so a file prints in the current language.
const FILES: Record<string, () => string> = {
  "about.txt": () => t("home.contact.files.about"),
  "stack.txt": () => STACK,
  "contact.txt": () => t("home.contact.files.contact"),
  "secret.txt": () => t("home.contact.files.secret"),
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


const notFound = (c: string) => {
  const n = lines("home.contact.notFound").length;
  return t(`home.contact.notFound.${Math.floor(Math.random() * n)}`, { c });
};

// ----- mail: a message composed in the shell -----------------------------------
// `mail` walks name → email → message → confirm, mail(1)-style: the message ends
// with a lone "." and ctrl+c / esc abandons it. Sending runs the invisible
// Turnstile challenge and POSTs to /api/contact (the Worker in prod, the logging
// stub under `nuxt dev`). The same `parseContact` the server uses checks each
// answer as it's given, so nothing the server would refuse gets as far as "send?".
type Draft = { name: string; email: string; lines: string[] };
type Step = "name" | "email" | "message" | "confirm" | "sending";
const compose = ref<{ step: Step; draft: Draft } | null>(null);
const turnstileEl = ref<HTMLElement | null>(null);
const turnstile = useTurnstile(turnstileEl, "contact");

const STEP_PROMPT: Record<Step, () => string> = {
  name: () => "name:",
  email: () => "email:",
  message: () => ">",
  confirm: () => t("home.contact.confirmPrompt"),
  sending: () => "…",
};
const promptLabel = computed(() => (compose.value ? STEP_PROMPT[compose.value.step]() : null));

const startCompose = () => {
  compose.value = { step: "name", draft: { name: "", email: "", lines: [] } };
  out(t("home.contact.compose.start"), t("home.contact.compose.who"));
  // Load the challenge while they type; a failure here resurfaces on send.
  turnstile.prepare().catch(() => {});
};

const abortCompose = () => {
  if (!compose.value || compose.value.step === "sending") return;
  log.value.push({ kind: "in", prompt: STEP_PROMPT[compose.value.step](), text: "^C" });
  compose.value = null;
  out(t("home.contact.compose.discarded"));
  scrollToEnd();
};

const send = async (draft: Draft) => {
  const msg = parseContact({
    name: draft.name,
    email: draft.email,
    message: draft.lines.join("\n"),
  });
  if (!msg) {
    compose.value = null;
    out(t("home.contact.compose.parseFail"));
    return;
  }
  out(t("home.contact.compose.transmitting"));
  try {
    const token = await turnstile.token();
    const res = await $fetch<{ ok: boolean }>("/api/contact", {
      method: "POST",
      body: { ...msg, token },
    });
    if (!res.ok) throw new Error("rejected");
    store.emitPulse();
    flash();
    out(t("home.contact.compose.delivered", { email: msg.email }));
  } catch {
    out(t("home.contact.compose.failed"), {
      html: t("home.contact.compose.failedRetry", { link: linkHtml(LINKS.github!) }),
    });
  } finally {
    compose.value = null;
    scrollToEnd();
    // The field was disabled while sending, which drops focus.
    nextTick(focusInput);
  }
};

/** One line of input while a message is being written. Untrimmed on purpose:
 *  blank lines and indentation are part of a message. */
const composeInput = (line: string) => {
  const c = compose.value!;
  const v = line.trim();
  log.value.push({ kind: "in", prompt: STEP_PROMPT[c.step](), text: line });

  switch (c.step) {
    case "name":
      if (!v) out(t("home.contact.compose.nameEmpty"));
      else if (v.length > LIMITS.name) out(t("home.contact.compose.nameLong", { max: LIMITS.name }));
      else {
        c.draft.name = v;
        c.step = "email";
        out(t("home.contact.compose.hi", { name: v }));
      }
      break;
    case "email":
      if (!parseContact({ name: "x", email: v, message: "x" }))
        out(t("home.contact.compose.emailBad"));
      else {
        c.draft.email = v;
        c.step = "message";
        out(t("home.contact.compose.goAhead"));
      }
      break;
    case "message": {
      if (v === ".") {
        if (!c.draft.lines.join("").trim()) {
          out(t("home.contact.compose.empty"));
          break;
        }
        c.step = "confirm";
        out(t("home.contact.compose.summary", { name: c.draft.name, email: c.draft.email }));
        break;
      }
      const size = [...c.draft.lines, line].join("\n").length;
      if (size > LIMITS.message)
        out(t("home.contact.compose.tooLong", { max: LIMITS.message }));
      else c.draft.lines.push(line);
      break;
    }
    case "confirm":
      // y/yes, and j/ja for the German prompt; both work in either language.
      if (/^(y(es)?|ja?)$/i.test(v)) {
        c.step = "sending";
        void send(c.draft);
      } else if (/^n(o|ein)?$/i.test(v)) {
        compose.value = null;
        out(t("home.contact.compose.discarded"));
      } else out(t("home.contact.compose.yn"));
      break;
    case "sending":
      break;
  }
};

const scrollToEnd = () =>
  nextTick(() => {
    bodyRef.value?.scrollTo({ top: bodyRef.value.scrollHeight });
  });

// Each branch pushes its own output (so `clear`/`open` can have side effects).
// User input is only ever rendered as escaped text; the controlled link HTML
// never contains user input.
const run = () => {
  if (compose.value) {
    const line = cmd.value;
    cmd.value = "";
    if (line.trim()) {
      store.emitPulse();
      flash();
    }
    composeInput(line);
    scrollToEnd();
    return;
  }

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
      out(...lines("home.contact.help"));
      break;
    case "whoami":
      out(...lines("home.contact.out.whoami"));
      break;
    case "ls":
    case "dir":
      out("about.txt   stack.txt   contact.txt   secret.txt   respeak/   github/");
      break;
    case "cat": {
      const f = args[0] ?? "";
      if (!f) out(t("home.contact.out.catEmpty"));
      else if (f === "respeak/" || f === "github/")
        out(t("home.contact.out.catDir", { f, name: f.replace("/", "") }));
      else out(FILES[f]?.() ?? t("home.contact.out.catMissing", { f }));
      break;
    }
    case "stack":
      out(STACK, t("home.contact.out.stackExtra"));
      break;
    case "contact":
      out(
        { html: `${linkHtml(LINKS.github!)} &nbsp; ${linkHtml(LINKS.respeak!)}` },
        t("home.contact.out.contactPick")
      );
      break;
    case "mail":
    case "email":
    case "write":
    case "msg":
      startCompose();
      break;
    case "open": {
      const where = (args[0] ?? "").toLowerCase();
      if (LINKS[where]) {
        out(t("home.contact.out.opening", { url: LINKS[where]!.replace(/^https?:\/\//, "") }));
        window.open(LINKS[where], "_blank", "noopener");
      } else {
        out(t("home.contact.out.openHelp"));
      }
      break;
    }
    case "orbit":
    case "explore":
    case "scene":
      out(...lines("home.contact.out.orbit"));
      enterExplore();
      break;
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
      out(t("home.contact.out.ping"));
      break;
    case "date":
      out(new Date().toString(), t("home.contact.out.dateNote"));
      break;
    // --- easter eggs: something funny for the curious ---
    case "sudo": {
      if (!arg) out(t("home.contact.out.sudoEmpty"));
      else if (/^hire/.test(arg))
        out(...lines("home.contact.out.sudoHire"));
      else if (arg.startsWith("rm")) out(t("home.contact.out.sudoRm"));
      else if (arg.includes("sandwich")) out(t("home.contact.out.sandwich"));
      else out(...lines("home.contact.out.sudoOther"));
      break;
    }
    case "rm":
      out(t("home.contact.out.rm"));
      break;
    case "vim":
    case "vi":
      out(t("home.contact.out.vim"));
      break;
    case "exit":
    case "quit":
    case "q":
      out(t("home.contact.out.exit"));
      break;
    case "matrix":
      out(t("home.contact.out.matrix"));
      break;
    case "hire":
      out(...lines("home.contact.out.hire"));
      break;
    case "coffee":
      out(t("home.contact.out.coffee"));
      break;
    case "sl":
      out(t("home.contact.out.sl"));
      break;
    default:
      out(notFound(name ?? ""));
  }

  if (log.value.length > 80) log.value = log.value.slice(-80);
  scrollToEnd();
};

const histPrev = () => {
  if (compose.value || !past.value.length) return;
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

/**
 * A shorter hint where there is no room for the long one.
 *
 * The field is bumped to 16px on a phone (see `.term-field`, which explains
 * why), so the full hint is ~250px of text in a 242px field and lost its last
 * two characters — a call to action reading "try: hel".
 *
 * Gated on `mounted` rather than used directly, per the rule in
 * docs/scroll-3d-architecture.md: a media query is `false` during prerender and
 * can be `true` on the client's first render, and a hydration mismatch is
 * something Vue warns about rather than repairs. Resolving it one tick later
 * makes the swap an ordinary update.
 */
const mounted = ref(false);
onMounted(() => (mounted.value = true));
const narrow = useMediaQuery("(max-width: 768px)");
const hint = computed(() =>
  mounted.value && narrow.value ? t("home.contact.hintShort") : t("home.contact.hint")
);

/** Ctrl+C cancels a message in progress, as in any shell. Outside `mail` it
 *  stays the browser's copy shortcut. */
const onCtrlC = (e: KeyboardEvent) => {
  if (!compose.value) return;
  e.preventDefault();
  abortCompose();
};

const startFromLink = () => {
  if (!compose.value) {
    log.value.push({ kind: "in", text: "mail" });
    startCompose();
    scrollToEnd();
  }
  focusInput();
};
</script>

<template>
  <article
    ref="termEl"
    class="terminal"
    :class="{ 'is-visible': visible, sending }"
    :style="{ '--accent': accent }"
    :aria-label="t('home.sections.contact.subtitle')"
    @click="focusInput"
  >
    <header class="term-bar">
      <span class="term-dot" />
      <span class="term-dot" />
      <span class="term-dot" />
      <span class="term-title">frederic@berlin — {{ t("home.contact.titleWord") }}</span>
    </header>

    <div ref="bodyRef" class="term-body">
      <!-- Static, crawlable session (types itself in). -->
      <p class="t-line cmd" style="--i: 0">
        <span class="prompt"><span class="p-host">frederic@berlin:</span>~$</span> whoami
      </p>
      <p class="t-line out" style="--i: 1">{{ t("home.contact.whoamiOut") }}</p>

      <h2 class="t-line headline" style="--i: 2">{{ t(`home.sections.${section.id}.title`) }}</h2>
      <i18n-t keypath="home.contact.prose" tag="p" class="t-line prose" style="--i: 3" scope="global">
        <template #respeak>
          <a href="https://respeak.io" target="_blank" rel="noopener">Respeak</a>
        </template>
        <template #mail><strong>mail</strong></template>
      </i18n-t>

      <p class="t-line cmd" style="--i: 4">
        <span class="prompt"><span class="p-host">frederic@berlin:</span>~$</span> contact --open
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
        <button class="token" type="button" @click.stop="startFromLink">
          [ mail ]
        </button>
      </div>

      <!-- Live command log. -->
      <template v-for="(line, i) in log" :key="i">
        <p v-if="line.kind === 'in' && line.prompt" class="log cmd">
          <span class="prompt">{{ line.prompt }}</span> {{ line.text }}
        </p>
        <p v-else-if="line.kind === 'in'" class="log cmd">
          <span class="prompt"><span class="p-host">frederic@berlin:</span>~$</span> {{ line.text }}
        </p>
        <!-- eslint-disable-next-line vue/no-v-html (controlled link markup only) -->
        <p v-else-if="line.html" class="log resp" v-html="line.html" />
        <p v-else class="log resp">{{ line.text }}</p>
      </template>

      <!-- The invisible Turnstile widget. Empty unless Cloudflare wants an
           actual click, in which case it shows up here, in the transcript. -->
      <div ref="turnstileEl" class="term-turnstile" />
    </div>

    <!-- The live prompt — OUTSIDE `.term-body`, which is the scrolling one.
         It used to be the last child of it, and a scroller clips its last child
         first: on a phone the body's `max-height` left 64px of content below the
         fold with `scrollTop` at 0, so the one interactive thing in this section
         — a terminal you can actually type into — was never on screen, behind an
         inner scrollbar nothing indicates on touch. Sitting outside it, the
         prompt is pinned to the foot of the card and the transcript scrolls
         above it, which is both what every terminal emulator does and the only
         arrangement that holds however much output the shell accumulates.
         The card's bottom padding moved with it (see `.term-body` /
         `.term-prompt`), so the layout is otherwise what it was. -->
    <form class="t-line term-prompt" style="--i: 6" @submit.prevent="run">
      <span v-if="promptLabel" class="prompt">{{ promptLabel }}</span>
      <span v-else class="prompt"><span class="p-host">frederic@berlin:</span>~$</span>
      <input
        ref="inputRef"
        v-model="cmd"
        class="term-field"
        type="text"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        :placeholder="focused || compose ? '' : hint"
        :inputmode="compose?.step === 'email' ? 'email' : 'text'"
        :disabled="compose?.step === 'sending'"
        :aria-label="t('home.contact.inputAria')"
        @focus="focused = true"
        @blur="focused = false"
        @keydown.up.prevent="histPrev"
        @keydown.down.prevent="histNext"
        @keydown.esc="abortCompose"
        @keydown.ctrl.c="onCtrlC"
      />
      <span v-if="!focused && !cmd" class="cursor" aria-hidden="true" />
    </form>
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
  /* No bottom padding: the prompt below it carries the card's instead, so the
     card is padded as it always was. The one real difference is 6px: the
     prompt's `margin-top` used to collapse against the last line's
     `margin-bottom` and now cannot, since the body's `overflow` makes it a
     block formatting context. Kept rather than compensated — a prompt that a
     transcript scrolls under wants the air more than one sitting at the end of
     it did. */
  padding: 1.2rem 1.35rem 0;
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
button.token {
  background: none;
  border: none;
  font-family: inherit;
  cursor: pointer;
}
.token:hover {
  transform: translateY(-1px);
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent, #00ff9c) 80%, transparent);
}

.term-turnstile:empty {
  display: none;
}
.term-turnstile {
  margin: 0.4rem 0 0.6rem;
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

/* The live prompt line. Now a sibling of the scrolling body rather than its last
   child (see the template), so it also carries the card's bottom padding — the
   horizontal value is `.term-body`'s, so the prompt still lines up with the
   transcript above it to the pixel. */
.term-prompt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
  padding: 0 1.35rem 1.3rem;
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
/* Mobile Safari ZOOMS the whole page in when a focused input's text is smaller
   than 16px, and there is no way back out of that zoom except pinching — which
   here means the visitor's first act of typing throws the pinned finale off
   frame and leaves the fixed canvas behind it scaled. 16px exactly: the rest of
   the terminal stays at its authored size, and only the one field a phone can
   focus is bumped. Desktop is untouched. */
@media (max-width: 768px) {
  .term-field {
    font-size: 16px;
  }

  /* `60vh` is a desktop-shaped cap: on a 1080px screen it is 648px and the
     session never reaches it, but on a phone it is 506px against 538px of
     transcript, so the card arrived already scrolled — an inner scroller inside
     a page that is itself scrolling, with no affordance a touch device shows.
     Size it to the room actually left instead: the viewport, less the window
     chrome, the prompt and a margin off the top and bottom of the screen. The
     session then fits outright and nothing scrolls until the visitor has typed
     enough to fill it, at which point scrolling is what a terminal should do.
     `dvh` because a phone's `100vh` is the URL-bar-hidden height, which is more
     screen than there usually is; the `vh` line above it is the fallback. */
  .term-body {
    max-height: calc(100vh - 11rem);
    max-height: calc(100dvh - 11rem);
  }

  /* 44px of tappable height, up from 31. These two links are the section's
     actual call to action and a thumb is not a cursor — the extra is padding,
     so nothing about how they read changes. */
  .token {
    padding: 0.6rem 0.05rem;
  }

  /* The prompt loses its host. `frederic@berlin:~$` is 18 characters, which on a
     390px card is 158 of the 284px inside it — so the field the visitor is meant
     to type into had about 13 characters of room, the placeholder truncated to
     "type a com", and anything typed scrolled out of sight as they went. At `~$`
     the same field gets 29. Nothing is lost: the host is in the window title bar
     two lines above, which is where a terminal puts it anyway — and every
     transcript line stops wrapping as well, since they were each paying the same
     158px before their first word. */
  .p-host {
    display: none;
  }
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
