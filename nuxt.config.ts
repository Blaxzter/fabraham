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

    app: {
        head: {
            // The SVG is the favicon; the .ico is the fallback for anything that
            // still asks for one (Safari, old shortcut dialogs). Every raster here
            // is built from the logo by `pnpm build:icons`.
            link: [
                { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
                { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
                { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
                { rel: 'manifest', href: '/site.webmanifest' },
            ],
            meta: [{ name: 'theme-color', content: '#313131' }],
            // Dark only, on purpose: the site is one art-directed look, not a
            // themeable UI. The class switches the shadcn tokens and `dark:`
            // variants in tailwind.css to their dark set.
            htmlAttrs: { class: 'dark' },
        },
    },

    runtimeConfig: {
        public: {
            // The contact terminal's invisible Turnstile widget ("fabraham.dev
            // terminal", registered for fabraham.dev + www). Sitekeys are public.
            // `nuxt dev` swaps in Cloudflare's always-passing test key instead,
            // since this one refuses to run on localhost (see useTurnstile).
            turnstileSiteKey: '0x4AAAAAAFFeDHc4OPLoFR_g',
        },
    },

    css: ['~/assets/css/tailwind.css', '~/assets/css/boot.css', '~/assets/css/vine-transition.css'],
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
            routes: ['/', '/projects', '/de', '/de/projects'],
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
        '@pinia/nuxt',
        '@nuxtjs/i18n',
    ],

    // English at `/`, German at `/de/…`. Both are prerendered, so each language
    // is a real static page with hreflang links to the other (useLocaleHead in
    // app.vue). A first visit to `/` from a German browser is sent to `/de`
    // (client-side: the site is static); after that the choice lives in a cookie
    // set by the switch, and nothing redirects again.
    //
    // Pinned to 10.2.1: 10.2.4+ depends on vue-router 5 and would install a
    // second router next to Nuxt 4.2's vue-router 4.
    //
    // Messages are split per area (i18n/locales/<code>/*.json), each file with
    // one top-level namespace of the same name, so the files never collide when
    // vue-i18n merges them.
    i18n: {
        strategy: 'prefix_except_default',
        defaultLocale: 'en',
        baseUrl: 'https://fabraham.dev',
        locales: [
            {
                code: 'en',
                language: 'en-US',
                name: 'English',
                files: ['en/common.json', 'en/home.json', 'en/shell.json', 'en/projects.json'],
            },
            {
                code: 'de',
                language: 'de-DE',
                name: 'Deutsch',
                files: ['de/common.json', 'de/home.json', 'de/shell.json', 'de/projects.json'],
            },
        ],
        detectBrowserLanguage: {
            useCookie: true,
            cookieKey: 'i18n_locale',
            redirectOn: 'root',
            fallbackLocale: 'en',
        },
    },

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
});
