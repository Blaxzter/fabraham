/**
 * The four moments the project timeline is measured against.
 *
 * These are markers, not headings: each sits AT its own date in the
 * newest-first list, and the era it opens runs upward from it (forward in time)
 * to the next marker. That is why the label reads "from …" — the alternative,
 * treating them as group headers, puts "Claude Code lands" above four projects
 * that are newer than it.
 *
 * Dates are the sort keys and nothing else reads them. The Claude Code one is
 * not a guess: it is the first co-authored commit in this repository's own git
 * history.
 */
export interface Era {
  id: string;
  /** Sorts it into the timeline. */
  date: string;
  /** The pill. */
  when: string;
  title: string;
  place: string;
  accent: string;
  note: string;
}

export const ERAS: Era[] = [
  {
    id: "claude",
    date: "2026-06-05",
    when: "from 5 Jun 2026",
    title: "Claude Code lands",
    place: "first co-authored commit",
    accent: "#00ff9c",
    note: "Everything above this line was built with it. The commit weeks jump from single digits to forty-plus, and four new projects start within four months.",
  },
  {
    id: "respeak",
    date: "2022-07-01",
    when: "from 2022",
    title: "Back to Berlin — Respeak",
    place: "Tatort, then Experte",
    accent: "#ff6b6b",
    note: "A chat game contracted for 100k concurrent that went live at 18,000; then tech lead on a RAG platform that has to cite every answer it gives. The side projects never stopped.",
  },
  {
    id: "msc",
    date: "2020-09-01",
    when: "from Sept 2020",
    title: "M.Sc. Artificial Intelligence",
    place: "Maastricht",
    accent: "#c4a0ff",
    note: "Two years to actually understand the machine learning I had been using on the side. Specialised in generative models; graduated at 8.25.",
  },
  {
    id: "bsc",
    date: "2016-10-01",
    when: "from Oct 2016",
    title: "B.Sc. Computer Science",
    place: "TU Berlin",
    accent: "#9ad1ff",
    note: "Multi-agent systems at GT-ARC; the identity-management apps behind ~47,000 students and 9,000 staff at RWTH Aachen. The root of the whole thing.",
  },
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
