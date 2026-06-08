/**
 * Dev-only: the tuning panel POSTs its current values here and we write them to
 * the committed `tuning.config.json` — the deployed source of truth that every
 * visitor gets (loaded by useTuning). Commit the file to ship the values.
 *
 * Uses Nitro's storage layer (a dev-only `fs` mount at the project root, see
 * `nitro.devStorage` in nuxt.config.ts) rather than `node:fs`, so it needs no
 * `@types/node`. The production build is static (`preset: 'static'`) and has no
 * server, so this route never exists at runtime in prod; the `import.meta.dev`
 * guard is belt-and-braces.
 *
 * Writes are MERGED key-by-key into the existing file, so saving from a session
 * where some tunable components never mounted won't drop their saved values.
 */
type Group = Record<string, unknown>;
type Config = Record<string, Group>;

const FILE_KEY = "tuning.config.json";

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const body = await readBody<Config>(event);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: "Expected a group→values object" });
  }

  const storage = useStorage("root");

  let current: Config = {};
  const raw = await storage.getItemRaw(FILE_KEY);
  if (raw != null) {
    try {
      current = JSON.parse(String(raw)) as Config;
    } catch {
      /* corrupt / empty — start fresh */
    }
  }

  const merged: Config = { ...current };
  for (const group of Object.keys(body)) {
    merged[group] = { ...(current[group] ?? {}), ...body[group] };
  }

  await storage.setItemRaw(FILE_KEY, JSON.stringify(merged, null, 2) + "\n");

  return { ok: true, file: FILE_KEY, groups: Object.keys(merged).length };
});
