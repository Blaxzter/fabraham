import { defineContentConfig, defineCollection, z } from "@nuxt/content";

export default defineContentConfig({
  collections: {
    projects: defineCollection({
      source: "projects/*.md",
      type: "page",
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        status: z.string(),
        technologies: z.array(z.string()),
        github: z.string(),
        demo: z.string(),
        featured: z.boolean(),
        image: z.string(),
      }),
    }),
  },
});
