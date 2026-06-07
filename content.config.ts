import { defineContentConfig, defineCollection, z } from '@nuxt/content';

const setPieceEnum = z.enum([
    'lattice',
    'berlinSkyline',
    'routeArc',
    'threadBoard',
    'documentGrid',
    'staffLines',
    'signalField',
]);

export default defineContentConfig({
    collections: {
        projects: defineCollection({
            source: 'projects/*.md',
            type: 'page',
            schema: z.object({
                title: z.string(),
                description: z.string(),
                date: z.string(),
                status: z.string(),
                technologies: z.array(z.string()),
                github: z.string().optional(),
                demo: z.string().optional(),
                featured: z.boolean().optional(),
                image: z.string().optional(),
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
