import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-05-15',
    devtools: { enabled: true },

    ssr: false,

    css: ['~/assets/css/tailwind.css', '~/assets/css/boot.css'],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: [],
            exclude: ['@nuxtjs/mdc'],
        },
    },

    nitro: {
        // Remove cloudflare-pages preset to avoid D1 database requirement
        // Cloudflare Pages works fine with static generation
        preset: 'static',
    },

    modules: [
        '@tresjs/nuxt',
        'shadcn-nuxt',
        '@nuxt/content',
        '@nuxt/image',
        '@nuxtjs/color-mode',
        '@pinia/nuxt',
        // "@nuxthub/core", // Temporarily disabled to debug atob issue
    ],

    // Add content configuration
    content: {
        // Disable database for now to debug atob issues
        // database: {
        //   type: process.env.NODE_ENV === "production" ? "d1" : "libsql",
        //   bindingName: "DB",
        // },
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

    colorMode: {
        classSuffix: '',
    },
});
