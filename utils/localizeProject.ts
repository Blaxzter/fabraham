/**
 * A project doc with its authored fields in the current language.
 *
 * The German wording sits in each project file's optional `de:` block (above
 * the fence, see content.config.ts); the GitHub-derived half is the same in both
 * languages. Any field the block leaves out falls back to the English, so a
 * half-translated project still renders whole.
 */
type Authored = { title: string; description: string; spec: string; note?: string };
type WithGerman = Authored & { de?: Partial<Authored> | null };

export function localizeProject<T extends WithGerman>(doc: T, locale: string): T {
  if (locale !== "de" || !doc.de) return doc;
  const de = doc.de;
  return {
    ...doc,
    title: de.title ?? doc.title,
    description: de.description ?? doc.description,
    spec: de.spec ?? doc.spec,
    note: de.note ?? doc.note,
  };
}
