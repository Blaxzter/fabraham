/**
 * Stylized screenshots for the home page's project teaser cards.
 *
 * Run by hand, output committed — the same deal as `fetch-github-projects.mjs`.
 * These are pictures of live sites, so they go stale silently; re-run when a
 * project's front end changes.
 *
 *   node scripts/shoot-project-screens.mjs            # all
 *   node scripts/shoot-project-screens.mjs episko     # one
 *
 * Needs Chrome. It drives a headless instance over CDP rather than pulling in
 * Playwright, because the only thing wanted here is "load, arrange, capture".
 *
 * Each project gets a RECIPE, because the useful frame is almost never the one
 * the front page opens on: Episko's `/` is a marketing hero that reduces to a
 * blurred headline, and LogoLab opens on a Preview tab full of placeholders.
 * The recipe says which view actually shows the work.
 *
 * Captured neutral (no colour grading) on purpose — the duotone lives in CSS on
 * the card, keyed to each project's own accent, so a re-shoot never has to match
 * a treatment by hand.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "public/projects");
const PORT = 9333;
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Viewport we compose against. The card crops to its own aspect in CSS. */
const W = 1440;
const H = 900;

const SHOTS = [
  {
    slug: "speeden-and-cuben",
    url: "https://speeden-and-cuben.fabraham.dev",
    // The case grid IS the product, and a wall of coloured cubes is the one
    // thing that still reads at 196px. Nothing to arrange.
    settle: 9000,
  },
  {
    slug: "episko",
    url: "https://episko.dev",
    // The hero, and only the hero. Everything below the fold on this site is
    // revealed on scroll and will not render for a headless capture — crept
    // down in fourteen steps with waits and the frame still came back black, at
    // 0.9 viewports as well as 1.75. So this is the honest frame: it is what the
    // site opens on, and the gradient headline over the pixel-ghost flock is
    // recognisably Episko even shrunk onto a card.
    settle: 10000,
  },
  {
    slug: "logolab",
    url: "https://logolab.fabraham.dev",
    // Onto the Vectorize tab — the trace is what the project is FOR, and the
    // default Preview tab is placeholder phone mockups.
    // Load an example first, THEN switch tabs. The bare Vectorize tab is an
    // empty state that says "No logo to vectorize" — a picture of the thing
    // not being used. "Outline" is the white line-art sample, which is also the
    // one that sits best next to this site's own line work.
    steps: [
      { click: /try an example/i, wait: 2500 },
      { click: /^outline/i, wait: 3500, optional: true },
      { click: /^\s*vectorize/i, wait: 6000 },
    ],
    settle: 11000,
  },
  {
    slug: "puttyparty",
    url: "https://puttyparty.de",
    // The landing hero already shows the product: a scorecard and the live
    // board beside it, ranks, ties and climbers. Server-rendered, so it is
    // there on first paint and needs no arranging.
    settle: 6000,
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(tabWs, fn) {
  const ws = new WebSocket(tabWs);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) =>
    new Promise((res) => {
      const n = ++id;
      pending.set(n, res);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  try {
    return await fn(send);
  } finally {
    ws.close();
  }
}

async function main() {
  const only = process.argv[2];
  const jobs = only ? SHOTS.filter((s) => s.slug === only) : SHOTS;
  if (!jobs.length) {
    console.error(`no shot named "${only}" — have: ${SHOTS.map((s) => s.slug).join(", ")}`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  let failed = false;

  // Fresh every run: a stale profile carries service workers and caches from the
  // last pass, which is exactly how a capture ends up being a picture of an
  // error page.
  const profile = resolve(ROOT, "node_modules/.cache/shoot-chrome");
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--enable-unsafe-swiftshader",
      "--use-angle=metal",
      "--hide-scrollbars",
      `--window-size=${W},${H}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(`http://127.0.0.1:${PORT}/json/version`);
        break;
      } catch {
        await sleep(500);
      }
    }

    for (const job of jobs) {
      const tab = await (
        await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })
      ).json();
      const bytes = await cdp(tab.webSocketDebuggerUrl, async (send) => {
        await send("Page.enable");
        await send("Emulation.setDeviceMetricsOverride", {
          width: W,
          height: H,
          deviceScaleFactor: 1,
          mobile: false,
        });
        // LogoLab is a PWA, and the service worker it installs on the first
        // visit serves a shell that fails outright on the next run — a whole
        // capture pass came back as Chrome's "site can't be reached" page.
        // Bypassing it makes every run look like a first visit.
        await send("Network.enable");
        await send("Network.setBypassServiceWorker", { bypass: true });
        await send("Page.navigate", { url: job.url });
        await sleep(job.settle ?? 8000);

        for (const step of job.steps ?? []) {
          const r = await send("Runtime.evaluate", {
            returnByValue: true,
            expression: `
              (() => {
                const re = ${step.click};
                const el = [...document.querySelectorAll('button,a,[role=button],[role=tab],[role=option]')]
                  .find((e) => re.test((e.textContent || "").trim()));
                if (!el) return null;
                el.click();
                return (el.textContent || "").trim().slice(0, 40);
              })()`,
          });
          const hit = r.result?.result?.value;
          if (!hit && !step.optional) {
            console.warn(`  ${job.slug}: could not find ${step.click} — frame may be wrong`);
          }
          await sleep(step.wait ?? 2500);
        }

        if (job.creep) {
          const { to, steps, wait } = job.creep;
          for (let k = 1; k <= steps; k++) {
            await send("Runtime.evaluate", {
              expression: `scrollTo({ top: innerHeight * ${to} * ${k / steps}, behavior: "instant" })`,
            });
            await sleep(wait);
          }
          await sleep(job.after ?? 2500);
        }
        // `scale` halves it on the way out: 720x450 is plenty for a card that is
        // 196 CSS px wide even on a 2x display, and keeps the file small.
        const shot = await send("Page.captureScreenshot", {
          format: "webp",
          quality: 82,
          clip: { x: 0, y: 0, width: W, height: H, scale: 0.5 },
        });
        return shot.result?.data ? Buffer.from(shot.result.data, "base64") : null;
      });
      await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`).catch(() => {});
      if (!bytes) {
        console.error(`  ${job.slug}: FAILED`);
        continue;
      }
      // A near-empty file means the frame is blank — a scroll that outran the
      // page's reveals, or a shell that never rendered. Both have happened here,
      // and both ship a black rectangle that nobody notices until it is live.
      const kb = bytes.length / 1024;
      if (kb < 8) {
        console.error(
          `  ${job.slug}: REFUSED — ${kb.toFixed(1)} KB is a blank frame, not a screenshot. ` +
            `Left the existing file alone.`
        );
        failed = true;
        continue;
      }
      const file = resolve(OUT, `${job.slug}.webp`);
      writeFileSync(file, bytes);
      console.log(`  ${job.slug}: ${kb.toFixed(0)} KB -> public/projects/${job.slug}.webp`);
    }
  } finally {
    chrome.kill();
  }
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
