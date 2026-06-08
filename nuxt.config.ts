import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-05-15',
    devtools: { enabled: true },

    // SSR on (Nuxt default): `nuxt generate` prerenders every route to real HTML
    // for crawlers + social cards (issue #5). The 3D canvas + boot screen stay
    // client-only via <ClientOnly> in pages/index.vue, so the GLB loader never
    // runs during prerender — which means no server and, crucially, no D1 (#9).

    // Pin the dev server to 3030 so this project doesn't collide with other
    // local Nuxt apps (e.g. the Gesangbuch PWA on 3000).
    devServer: { port: 3030 },

    css: ['~/assets/css/tailwind.css', '~/assets/css/boot.css'],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: [],
            exclude: ['@nuxtjs/mdc'],
        },
    },

    nitro: {
        // Pure static output (.output/public) for Cloudflare Pages — no server,
        // no runtime D1. @nuxt/content is queried at build time and baked into
        // the prerendered HTML/payloads.
        preset: 'static',
        prerender: {
            // Crawl from these entry routes and follow links so every project
            // page (/projects/*) is emitted as a static HTML file.
            crawlLinks: true,
            routes: ['/', '/projects'],
        },
        // Dev-only fs mount at the project root, used by server/api/_tuning.post.ts
        // so the dev tuning panel can write tuning.config.json. Not present in the
        // static prod build (devStorage applies only to `nuxt dev`).
        devStorage: {
            root: { driver: 'fs', base: '.' },
        },
    },

    modules: [
        '@nuxt/eslint',
        '@tresjs/nuxt',
        'shadcn-nuxt',
        '@nuxt/content',
        '@nuxt/image',
        '@nuxtjs/color-mode',
        '@pinia/nuxt',
    ],

    shadcn: {
        /**
         * Prefix for all the imported component
         */
        prefix: '',
        /**
         * Directory that the component lives in.
         * @default "./components/ui"
         */
        componentDir: './components/ui',
    },

    colorMode: {
        classSuffix: '',
    },
});
