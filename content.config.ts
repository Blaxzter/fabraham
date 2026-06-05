import { defineContentConfig, defineCollection, z } from '@nuxt/content';

// A reusable [x, y, z] tuple for camera poses authored in chapter frontmatter.
const vec3 = z.array(z.number()).length(3);

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

        // Data-driven 3D biographical timeline. One markdown file = one chapter.
        // Adding a milestone = writing markdown; the body prerenders for SEO (#5),
        // while the frontmatter drives the camera path and 3D line set-pieces.
        timeline: defineCollection({
            source: 'timeline/*.md',
            type: 'page',
            schema: z.object({
                title: z.string(),
                subtitle: z.string().optional(),
                // Sort key. Use gapped numeric prefixes on filenames too (10, 20, …)
                // so new chapters can be inserted between existing ones.
                order: z.number(),
                // Geographic anchor for the Berlin → Maastricht → Berlin spine.
                location: z.string().optional(),
                // Relative scroll length; drives both the DOM section height and the
                // camera segment width. The hero is heavier (it owns the ASCII assemble).
                weight: z.number().default(1),
                // Thin line/wireframe set-pieces that accompany this chapter.
                // An array so a chapter can stack pieces (e.g. Tatort = the
                // embeddings lattice + a thread-board topology).
                setPiece: z
                    .array(
                        z.enum([
                            'lattice',
                            'berlinSkyline',
                            'routeArc',
                            'threadBoard',
                            'documentGrid',
                            'staffLines',
                        ])
                    )
                    .optional(),
                // Variant for the recurring lattice motif (gan → embeddings → rag), etc.
                setPieceVariant: z.string().optional(),
                // Accent colour for the chapter card.
                accent: z.string().optional(),
                // Camera pose the camera settles into while this chapter is centered.
                cameraPosition: vec3,
                cameraRotation: vec3,
            }),
        }),
    },
});
