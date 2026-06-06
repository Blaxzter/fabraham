import { defineContentConfig, defineCollection, z } from '@nuxt/content';

// A reusable [x, y, z] tuple for camera poses authored in section frontmatter.
const vec3 = z.array(z.number()).length(3);

const setPieceEnum = z.enum([
    'lattice',
    'berlinSkyline',
    'routeArc',
    'threadBoard',
    'documentGrid',
    'staffLines',
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

        // Top-level peer "sections" — the backbone of the scroll experience. Each
        // section is a content piece (of a `type`) paired with a 3D scene state
        // (camera pose + set-pieces); the scroll engine interpolates the camera
        // between sections. Adding/reordering a section = editing markdown.
        sections: defineCollection({
            source: 'sections/*.md',
            type: 'page',
            schema: z.object({
                title: z.string(),
                subtitle: z.string().optional(),
                order: z.number(),
                type: z.enum(['biography', 'tech-stack', 'contact', 'interlude']),
                // Relative scroll length AND camera segment width.
                weight: z.number().default(1),
                // Artistic alignment of the HTML content piece over the canvas.
                align: z
                    .enum(['center', 'left', 'right', 'top', 'bottom', 'free'])
                    .default('center'),
                offset: z
                    .object({ x: z.number().optional(), y: z.number().optional() })
                    .optional(),
                maxWidth: z.string().optional(),
                accent: z.string().optional(),
                // 3D renderings active during this section.
                setPiece: z.array(setPieceEnum).optional(),
                setPieceVariant: z.string().optional(),
                // Camera pose the camera settles into while this section is centered.
                cameraPosition: vec3,
                cameraRotation: vec3,
                // Per-type config (e.g. tech-stack items) — narrowed by consumers.
                data: z.record(z.string(), z.any()).optional(),
            }),
        }),

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
