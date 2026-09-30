/**
 * The four moments the project timeline is measured against.
 *
 * These are markers, not headings: each sits AT its own date in the
 * newest-first list, and the era it opens runs upward from it (forward in time)
 * to the next marker. That is why the label reads "from …" — the alternative,
 * treating them as group headers, puts "Claude Code lands" above four projects
 * that are newer than it.
 *
 * The dates are the sort keys and the pills' dates. The Claude Code one is
 * not a guess: it is the first co-authored commit in this repository's own git
 * history.
 */
export interface Era {
  id: string;
  /** Sorts it into the timeline, and is the date the pill shows. */
  date: string;
  /**
   * How much of `date` the pill shows: the Claude Code marker is a known day,
   * the others are only known to the month.
   */
  precision: "day" | "month";
  accent: string;
}

// The wording (pill, title, place, note) lives in the locale files under
// `projects.eras.<id>`, so it can be translated; this is only what the timeline
// sorts and paints by.
export const ERAS: Era[] = [
  { id: "claude", date: "2026-06-05", precision: "day", accent: "#00ff9c" },
  { id: "respeak", date: "2023-03-01", precision: "month", accent: "#ff6b6b" },
  { id: "msc", date: "2020-09-01", precision: "month", accent: "#c4a0ff" },
  { id: "bsc", date: "2016-10-01", precision: "month", accent: "#9ad1ff" },
];

/**
 * The 52-week window every `spark` array is measured in: GitHub's participation
 * stats run Sunday-to-Saturday and end with the current partial week, so week 0
 * opens on this Sunday. `CLAUDE_WEEK` is 5 Jun 2026 expressed in that scale, and
 * is fractional on purpose — the marker falls between two buckets.
 */
export const WEEK_ZERO = Date.UTC(2025, 8, 21);
export const CLAUDE_WEEK = 36.7;
/** The first bucket that is wholly after Claude Code landed. */
export const CLAUDE_INDEX = 37;

/** Chart marks: emphasis, not a categorical pair — see CommitChart.vue. */
export const INK_LIVE = "#00e88f";
export const INK_PAST = "#4d6379";

/**
 * Below this width the zigzag collapses to a rail down the left margin, the
 * same way the biography cluster does at 1024. Restated in
 * `ProjectsTimeline.vue`'s media query and read by the vine geometry, so move
 * one and move both.
 */
export const RAIL_MAX_PX = 1000;
/** Where the rail sits, in px from the left edge of the timeline grid. */
export const RAIL_X = 26;
