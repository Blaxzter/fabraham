import { defineContentConfig, defineCollection, z } from '@nuxt/content';

const setPieceEnum = z.enum([
    'lattice',
    'berlinSkyline',
    'routeArc',
    'threadBoard',
    'documentGrid',
    'staffLines',
    'signalField',
    'stackFlight',
]);

export default defineContentConfig({
    collections: {
        // The public-work timeline rendered by `pages/projects/index.vue`.
        //
        // The split here mirrors the one the section registry makes: the AUTHORED
        // half (the human title, the prose, the accent, which skin and hover
        // set-piece the card wears) is hand-written and lives above the fence in
        // each file; the DERIVED half (stars, languages, last push, the 52-week
        // spark, the latest commit subjects) is GitHub's and is refreshed by
        // `scripts/fetch-github-projects.mjs`, run by hand with its output
        // committed — the same deal as `scripts/make-germany-svg.py`.
        //
        // `date` is the repository's creation date and is the only thing that
        // orders the timeline; the era markers in `components/projects/eras.ts`
        // are sorted into the same list by their own dates.
        projects: defineCollection({
            source: 'projects/*.md',
            type: 'page',
            schema: z.object({
                title: z.string(),
                description: z.string(),
                repo: z.string(),
                url: z.string(),
                home: z.string().optional(),
                date: z.string(),
                accent: z.string(),
                skin: z.enum([
                    'cubes', 'cockpit', 'hatch', 'alpha', 'rail', 'staff', 'tests',
                    'ascii', 'archive', 'scrub', 'week', 'desk', 'paper', 'lattice',
                    'event', 'genome',
                ]),
                emergent: z.enum([
                    'cubes', 'sessions', 'files', 'vectors', 'tags', 'notes', 'tests',
                    'ascii', 'archive', 'clips', 'rooms', 'paper', 'blocks', 'event', 'dna',
                ]),
                spec: z.string(),
                // True when the repo is not mine alone: the card says so, and its
                // activity block counts only my commits.
                shared: z.boolean().optional(),
                // Shown under the spark when the 52-week window does not tell the
                // honest story (e.g. my work on it predates the window).
                note: z.string().optional(),
                pushed: z.string(),
                stars: z.number(),
                langs: z.array(z.string()),
                // 52 weekly counts of MY commits, oldest first.
                spark: z.array(z.number()).length(52),
                commits: z.array(z.object({ date: z.string(), message: z.string() })),
            }),
        }),

        // NOTE: the top-level section sequence + scene spine (hero, pause,
        // biography, contact) is no longer markdown — it's typed config in
        // `components/home/sections/registry.ts`. The spine (order, type, weight,
        // camera pose, set-pieces, layout) is config every section needs, and each
        // section is a dedicated component, so markdown was the wrong tool. Only
        // the genuinely content-shaped, repeating collection stays as markdown:

        // Biographical milestones, rendered as ONE artistic cluster by the
        // `biography` section. These are pure content — no camera spine of their
        // own (that belongs to the biography section).
        biography: defineCollection({
            source: 'biography/*.md',
            type: 'page',
            schema: z.object({
                title: z.string(),
                subtitle: z.string().optional(),
                order: z.number(),
                location: z.string().optional(),
                accent: z.string().optional(),
                // Which side of the connector line the card sits on.
                side: z.enum(['left', 'right', 'auto']).default('auto'),
                // Free artistic nudge for the loose-cluster layout.
                offset: z
                    .object({ x: z.number().optional(), y: z.number().optional() })
                    .optional(),
                // The line backdrop(s) that bloom in 3D as this milestone centers.
                setPiece: z.array(setPieceEnum).optional(),
                setPieceVariant: z.string().optional(),
            }),
        }),
    },
});
