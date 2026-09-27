/**
 * An invisible Turnstile challenge, loaded only when something asks for it.
 *
 * The contact terminal is the only thing on the site that talks to a server, and
 * most visitors never type `mail`. So the script isn't in the page head. It's
 * injected the first time `prepare()` runs (when a message starts being
 * written), which gives it the whole time the visitor spends typing to load.
 * `token()` then runs the challenge and resolves with a single-use token.
 *
 * The widget renders with `appearance: "interaction-only"` into the element it
 * is given, so it stays invisible unless Cloudflare actually wants the visitor
 * to click something, and then it appears inside the terminal instead of in a
 * floating box somewhere else.
 *
 * In dev the sitekey is Cloudflare's test key, which always passes invisibly:
 * the real widget only runs on fabraham.dev, and this way the flow can still be
 * walked end to end locally.
 */
import { onBeforeUnmount, type Ref } from "vue";

type Turnstile = {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(id: string): void;
  reset(id: string): void;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const DEV_SITEKEY = "1x00000000000000000000BB";
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Turnstile> | null = null;

function load(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing"));
    s.onerror = () => {
      loading = null; // let a later attempt retry
      s.remove();
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function useTurnstile(container: Ref<HTMLElement | null>, action: string) {
  const sitekey = import.meta.dev
    ? DEV_SITEKEY
    : (useRuntimeConfig().public.turnstileSiteKey as string);
  let ts: Turnstile | null = null;
  let id: string | null = null;
  let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

  const settle = (fn: (p: NonNullable<typeof pending>) => void) => {
    const p = pending;
    pending = null;
    if (p) fn(p);
  };

  async function prepare() {
    ts = await load();
    if (id || !container.value) return;
    id = ts.render(container.value, {
      sitekey,
      action,
      execution: "execute",
      appearance: "interaction-only",
      theme: "dark",
      callback: (t: string) => settle((p) => p.resolve(t)),
      "error-callback": () => settle((p) => p.reject(new Error("challenge failed"))),
      "expired-callback": () => settle((p) => p.reject(new Error("challenge expired"))),
    });
  }

  /** Run the challenge. Every call gets a fresh token (they're single-use). */
  async function token(): Promise<string> {
    await prepare();
    if (!ts || !id) throw new Error("turnstile not ready");
    ts.reset(id);
    return new Promise<string>((resolve, reject) => {
      pending = { resolve, reject };
      ts!.execute(id!);
    });
  }

  onBeforeUnmount(() => {
    if (ts && id) ts.remove(id);
    id = null;
  });

  return { prepare, token };
}
