#!/usr/bin/env node
/**
 * Refreshes the GitHub half of `content/projects/*.md`.
 *
 * Run by hand, output committed — the same arrangement as
 * `scripts/make-germany-svg.py`. The site is prerendered to static files with
 * no server, so nothing may call the GitHub API at request time; and the API
 * is rate-limited and occasionally returns 202 while it computes stats, which
 * is not something a build should depend on.
 *
 *   node scripts/fetch-github-projects.mjs            # refresh every file
 *   node scripts/fetch-github-projects.mjs logolab    # just one
 *
 * Needs a token with public repo read: GITHUB_TOKEN, or `gh auth token`.
 *
 * What it touches: only the fields below the "refreshed by" fence in each
 * file — pushed, stars, langs, spark, commits. The authored half above it (the
 * human title, the prose, the accent, the skin, the hover set-piece) is never
 * written, because none of it is GitHub's to say.
 *
 * `spark` is 52 weekly counts of MY commits, oldest first, in GitHub's own
 * Sunday-anchored window. For repos I own alone that is the participation
 * endpoint; for shared ones (`shared: true` in the frontmatter) it buckets my
 * authored commits by hand, because the repo-wide numbers would credit me with
 * my colleagues' work.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "content/projects";
const ME = ["Blaxzter", "FAbrahamDev"];
const FENCE = "# --- refreshed by scripts/fetch-github-projects.mjs; do not hand-edit ---";

/** Week 0 opens on the Sunday 52 weeks back; keep in step with eras.ts. */
const WEEK_ZERO = Date.UTC(2025, 8, 21);

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync("gh auth token", { encoding: "utf8" }).trim();
  } catch {
    throw new Error("No GitHub token: set GITHUB_TOKEN or run `gh auth login`.");
  }
}

const TOKEN = token();

async function api(path, { retries = 5 } = {}) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`https://api.github.com/${path}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "fabraham-projects",
      },
    });
    // The stats endpoints answer 202 the first time while GitHub computes them.
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
  }
  throw new Error(`GET ${path} kept answering 202`);
}

const yamlString = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso) {
  const d = new Date(iso);
  const thisYear = new Date().getUTCFullYear();
  const y = d.getUTCFullYear();
  return y === thisYear
    ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`
    : `${MON[d.getUTCMonth()]} ${y}`;
}

/** My commits, bucketed into the 52-week window. Used for shared repos. */
async function mySpark(repo) {
  const weeks = new Array(52).fill(0);
  for (const who of ME) {
    for (let page = 1; page <= 5; page++) {
      const batch = await api(`repos/${repo}/commits?author=${who}&per_page=100&page=${page}`);
      if (!batch.length) break;
      for (const c of batch) {
        const i = Math.floor((Date.parse(c.commit.author.date) - WEEK_ZERO) / 604800000);
        if (i >= 0 && i < 52) weeks[i]++;
      }
      if (batch.length < 100) break;
    }
  }
  return weeks;
}

/** My latest commit subjects — not the repo's, which on a shared repo is someone else's. */
async function myCommits(repo, shared) {
  const query = shared ? `repos/${repo}/commits?author=${ME[0]}&per_page=20` : `repos/${repo}/commits?per_page=20`;
  let list = await api(query);
  if (shared && !list.length) list = await api(`repos/${repo}/commits?author=${ME[1]}&per_page=20`);
  return list
    .filter((c) => !c.commit.message.startsWith("Merge"))
    .slice(0, 2)
    .map((c) => ({
      date: shortDate(c.commit.author.date),
      message: c.commit.message.split("\n")[0].slice(0, 78),
    }));
}

async function refresh(file) {
  const path = join(DIR, file);
  const src = readFileSync(path, "utf8");
  const at = src.indexOf(FENCE);
  if (at < 0) throw new Error(`${file}: no fence — cannot tell authored from derived`);

  const repo = /^repo:\s*"(.+?)"/m.exec(src)?.[1];
  if (!repo) throw new Error(`${file}: no repo field`);
  const shared = /^shared:\s*true\s*$/m.test(src);

  const [meta, langs, commits] = await Promise.all([
    api(`repos/${repo}`),
    api(`repos/${repo}/languages`),
    myCommits(repo, shared),
  ]);

  let spark;
  if (shared) {
    spark = await mySpark(repo);
  } else {
    const part = await api(`repos/${repo}/stats/participation`);
    spark = part.all ?? new Array(52).fill(0);
  }

  const top = Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const lines = [
    FENCE,
    `pushed: ${yamlString(meta.pushed_at.slice(0, 10))}`,
    `stars: ${meta.stargazers_count}`,
    `langs: [${top.map(yamlString).join(", ")}]`,
    `spark: [${spark.join(", ")}]`,
  ];
  if (commits.length) {
    lines.push("commits:");
    for (const c of commits) {
      lines.push(`  - date: ${yamlString(c.date)}`);
      lines.push(`    message: ${yamlString(c.message)}`);
    }
  } else {
    lines.push("commits: []");
  }

  // Everything after the fence up to the closing --- is ours to rewrite.
  const rest = src.slice(at);
  const end = rest.indexOf("\n---");
  writeFileSync(path, src.slice(0, at) + lines.join("\n") + rest.slice(end), "utf8");
  console.log(`  ${file.padEnd(34)} ${repo} · ${spark.reduce((a, b) => a + b, 0)} commits/52w`);
}

const only = process.argv.slice(2);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .filter((f) => !only.length || only.some((o) => f.startsWith(o)));

console.log(`Refreshing ${files.length} project file(s) from GitHub…`);
let failed = 0;
for (const f of files) {
  try {
    await refresh(f);
  } catch (err) {
    failed++;
    console.error(`  ${f.padEnd(34)} FAILED: ${err.message}`);
  }
}
console.log(failed ? `Done, ${failed} failed.` : "Done.");
process.exit(failed ? 1 : 0);
