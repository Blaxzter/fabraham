import { computed } from "vue";

/**
 * Routes dev-panel tuning groups to where they're shown:
 *
 * - A group lands under a scene/milestone when its **id matches a set-piece name**
 *   that scene uses (the section/milestone → set-piece mapping that already lives
 *   in registry.ts / content frontmatter), OR when it carries an explicit
 *   `section` tag (for non-set-piece groups that still belong to a scene).
 * - Everything left over — no section tag and not a set-piece used anywhere — is
 *   "global" and shown under the global tab.
 *
 * This means a set-piece only has to name its tuning group after itself
 * (`useTuning("lattice", "Lattice")`) and it automatically appears beside every
 * milestone that renders a `lattice` — no manual scene bookkeeping.
 */
export function useDevPanelGroups() {
  const sections = useSectionsStore();
  const tuning = useTuningStore();
  const { milestones } = useBiographyMilestones();

  // Every set-piece name used by any top-level section or biography milestone.
  const usedPieceNames = computed(() => {
    const names = new Set<string>();
    for (const s of sections.sections) for (const n of s.setPiece) names.add(n);
    for (const m of milestones.value) for (const n of m.setPiece) names.add(n);
    return names;
  });

  // Groups surfaced under a scene: explicit `section` tag, or id == a set-piece
  // name this scene/milestone renders.
  const groupsFor = (sectionId: string | undefined, pieceNames: string[]) =>
    Object.values(tuning.groups).filter(
      (g) =>
        (sectionId !== undefined && g.section === sectionId) ||
        pieceNames.includes(g.id)
    );

  // Leftovers: not tied to a scene and not a (scene-surfaced) set-piece group.
  const globalGroups = computed(() =>
    Object.values(tuning.groups).filter(
      (g) => !g.section && !usedPieceNames.value.has(g.id)
    )
  );

  return { usedPieceNames, groupsFor, globalGroups };
}
