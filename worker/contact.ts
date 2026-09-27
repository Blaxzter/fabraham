/**
 * What a contact message is, and the one place that decides whether a request
 * body is one. Shared by the Worker (production) and the dev stub in
 * `server/api/contact.post.ts`, so `nuxt dev` rejects exactly what prod does.
 *
 * The limits are generous for a person and small for a script. The message
 * cap leaves room under Telegram's 4096 characters for the header lines the
 * Worker adds; the name is held to a single line because it heads the message.
 */
export interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

export const LIMITS = { name: 100, email: 254, message: 3600 } as const;

// Deliberately loose: one @, something either side, a dot in the domain. The
// real check is whether a reply arrives.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseContact(body: unknown): ContactMessage | null {
  if (!body || typeof body !== "object") return null;
  const { name, email, message } = body as Record<string, unknown>;
  if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string")
    return null;

  const n = name.trim();
  const e = email.trim();
  const m = message.trim();
  if (!n || n.length > LIMITS.name || /[\r\n]/.test(n)) return null;
  if (e.length > LIMITS.email || !EMAIL_RE.test(e)) return null;
  if (!m || m.length > LIMITS.message) return null;

  return { name: n, email: e, message: m };
}
