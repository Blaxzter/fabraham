/**
 * The site's only server-side code: the contact terminal's `mail` command.
 *
 * Everything else is still the static `nuxt generate` output. `wrangler.jsonc`
 * sets `run_worker_first: ["/api/*"]`, so this Worker runs only for `/api/*`
 * and every other request is served straight from the asset store, the same way
 * it was before there was a Worker at all.
 *
 * One route, `POST /api/contact`, which:
 *   1. checks the shape of the message (see `parseContact`),
 *   2. redeems the invisible Turnstile token at siteverify — success, the
 *      `contact` action and one of our own hostnames, and it fails closed,
 *   3. forwards it to Frederic on Telegram, via a bot's `sendMessage`.
 *
 * Telegram and not email: the domain's mail is on Proton, and Cloudflare's
 * Email Routing would have to take over its MX records to send anything. A bot
 * needs no DNS at all. The visitor's address rides along in the message, so a
 * reply is one tap on it.
 *
 * Both the bot token and the chat id are secrets, so neither is in the repo.
 */
import { parseContact, type ContactMessage } from "./contact";

interface Env {
  /** Secret. The Turnstile widget's secret key. */
  TURNSTILE_SECRET: string;
  /** Comma-separated frontend hostnames siteverify must report. */
  TURNSTILE_HOSTNAMES: string;
  /** Secret. The bot's token, from @BotFather. */
  TELEGRAM_BOT_TOKEN: string;
  /** Secret. The chat the bot writes to: Frederic's own chat with it. */
  TELEGRAM_CHAT_ID: string;
}

const ACTION = "contact";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function verifyTurnstile(token: unknown, ip: string | null, env: Env) {
  const hostnames = new Set(
    (env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean)
  );
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 2048 ||
    hostnames.size === 0 ||
    !env.TURNSTILE_SECRET
  ) {
    return false;
  }

  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return false;
    const result = (await r.json()) as { success?: boolean; action?: string; hostname?: string };
    return (
      result.success === true &&
      result.action === ACTION &&
      typeof result.hostname === "string" &&
      hostnames.has(result.hostname)
    );
  } catch {
    // Network error, timeout or a body that isn't JSON: fail closed.
    return false;
  }
}

// Plain text, no parse_mode: nothing a visitor types can be mistaken for markup.
// Telegram links the address by itself.
function render(msg: ContactMessage, host: string) {
  return [`✉️ ${msg.name} · ${msg.email}`, `via ${host}`, "", msg.message].join("\n");
}

async function sendTelegram(text: string, env: Env) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      link_preview_options: { is_disabled: true },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  // Log the status, never the URL: the token is in it.
  if (!r.ok) throw new Error(`telegram ${r.status}`);
}

async function handleContact(request: Request, env: Env) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const msg = parseContact(body);
  if (!msg) return json({ ok: false, error: "invalid" }, 400);

  const human = await verifyTurnstile(
    body.token,
    request.headers.get("cf-connecting-ip"),
    env
  );
  if (!human) return json({ ok: false, error: "challenge" }, 403);

  try {
    await sendTelegram(render(msg, new URL(request.url).hostname), env);
  } catch (err) {
    console.error("contact: send failed", err);
    return json({ ok: false, error: "send" }, 502);
  }

  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/contact") {
      if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
      return handleContact(request, env);
    }
    return json({ ok: false, error: "not found" }, 404);
  },
};
