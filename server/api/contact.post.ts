/**
 * Dev-only stand-in for the Worker's `POST /api/contact` (see worker/index.ts).
 *
 * `nuxt dev` doesn't run the Worker, so without this the terminal's `mail`
 * command could only be tried against a deploy. This validates the body with
 * the same `parseContact` the Worker uses and logs the message instead of
 * sending it. There is no Turnstile check here: in dev the page uses
 * Cloudflare's always-passing test sitekey, which proves nothing anyway.
 *
 * Like `_tuning.post.ts`, it never exists in production: the build is static,
 * and there `/api/*` goes to the Worker.
 */
import { parseContact } from "../../worker/contact";

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const msg = parseContact(await readBody(event));
  if (!msg) {
    setResponseStatus(event, 400);
    return { ok: false, error: "invalid" };
  }

  console.info("[contact:dev] would send →", msg);
  return { ok: true };
});
