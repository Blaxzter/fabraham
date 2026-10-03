import { computed } from "vue";
import { ERAS, type Era } from "~/components/projects/eras";

/**
 * The project timeline: the `projects` collection and the era markers merged
 * into one newest-first list.
 *
 * Ordering is derived, not hand-maintained — everything sorts on its own `date`
 * (a repo's creation date, or the era's own moment). That is what keeps a dated
 * marker from drifting above a project that is newer than it, which is exactly
 * the bug a hand-ordered array produced.
 */
export interface ProjectRow {
  kind: "project";
  id: string;
  /** -1 = left of the vine, +1 = right of it. Alternates down the list. */
  side: -1 | 1;
  doc: ProjectDoc;
}

export interface EraRow {
  kind: "era";
  id: string;
  side: 0;
  era: Era;
}

export type TimelineRow = ProjectRow | EraRow;

export interface ProjectDoc {
  id?: string;
  path?: string;
  title: string;
  description: string;
  repo: string;
  url: string;
  home?: string;
  date: string;
  accent: string;
  skin: string;
  emergent: string;
  spec: string;
  shared?: boolean;
  private?: boolean;
  note?: string;
  /** German wording of the authored fields; see `localizeProject`. */
  de?: { title?: string; description?: string; spec?: string; note?: string } | null;
  pushed: string;
  stars: number;
  langs: string[];
  spark: number[];
  commits: { date: string; message: string }[];
}

/**
 * Dates on /projects, in the page's language: British order in English
 * ("5 Jun 2026"), German in German ("5. Juni 2026"). Always UTC, because every
 * date here is a calendar date (a repo's creation day, a GitHub week bucket),
 * not a moment, and a local timezone would shift it by a day.
 */
export function useProjectDates() {
  const { locale } = useI18n();
  const tag = computed(() => (locale.value === "de" ? "de-DE" : "en-GB"));
  const format = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag.value, { timeZone: "UTC", ...opts }).format(d);
  return {
    tag,
    /** "5 Jun 2026" / "5. Juni 2026". */
    day: (d: Date) => format(d, { day: "numeric", month: "short", year: "numeric" }),
    /** "Aug 2026" / "Aug. 2026". */
    month: (d: Date) => format(d, { month: "short", year: "numeric" }),
    /** "Mar ’26" / "März ’26": the chart's axis and its month table. */
    monthShort: (d: Date) =>
      `${format(d, { month: "short" })} ’${String(d.getUTCFullYear()).slice(2)}`,
    format,
  };
}

export function useProjectTimeline() {
  const { locale } = useI18n();
  const { data, pending, error } = useAsyncData("projects-timeline", () =>
    queryCollection("projects").all()
  );

  // Localised here, once, so every card, the chart and the hero read the same
  // wording. Only the authored fields change; the GitHub half is shared.
  const projects = computed<ProjectDoc[]>(() =>
    [...((data.value ?? []) as unknown as ProjectDoc[])]
      .map((doc) => localizeProject(doc, locale.value))
      .sort((a, b) => b.date.localeCompare(a.date))
  );

  const rows = computed<TimelineRow[]>(() => {
    const merged: { date: string; row: TimelineRow }[] = [
      ...projects.value.map((doc) => ({
        date: doc.date,
        row: { kind: "project", id: doc.repo, side: 1, doc } as ProjectRow,
      })),
      ...ERAS.map((era) => ({
        date: era.date,
        row: { kind: "era", id: era.id, side: 0, era } as EraRow,
      })),
    ];
    merged.sort((a, b) => b.date.localeCompare(a.date));

    // Sides alternate across the PROJECTS only, so an era marker in the middle
    // of the list does not flip the zigzag and leave two cards stacked on the
    // same side of the vine.
    let flip: -1 | 1 = -1;
    return merged.map(({ row }) => {
      if (row.kind !== "project") return row;
      flip = flip === -1 ? 1 : -1;
      return { ...row, side: flip };
    });
  });

  /**
   * Every repo's weekly commits, summed. This is the hero chart's series, and
   * it is genuinely mine: on the two shared repos the `spark` in frontmatter
   * already counts only my own commits.
   */
  const weekly = computed(() => {
    const out = new Array(52).fill(0) as number[];
    for (const p of projects.value) {
      p.spark.forEach((v, i) => {
        out[i]! += v;
      });
    }
    return out;
  });

  const totalCommits = computed(() => weekly.value.reduce((a, b) => a + b, 0));
  const repoCount = computed(() => projects.value.length);
  const reachesBack = computed(() => {
    const oldest = projects.value[projects.value.length - 1]?.date;
    return oldest ? oldest.slice(0, 4) : "";
  });

  return { projects, rows, weekly, totalCommits, repoCount, reachesBack, pending, error };
}
