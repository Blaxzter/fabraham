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
  note?: string;
  pushed: string;
  stars: number;
  langs: string[];
  spark: number[];
  commits: { date: string; message: string }[];
}

export function useProjectTimeline() {
  const { data, pending, error } = useAsyncData("projects-timeline", () =>
    queryCollection("projects").all()
  );

  const projects = computed<ProjectDoc[]>(() =>
    [...((data.value ?? []) as unknown as ProjectDoc[])].sort((a, b) =>
      b.date.localeCompare(a.date)
    )
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
