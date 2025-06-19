import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },

  ssr: false,

  css: ["~/assets/css/tailwind.css"],
  vite: {
    plugins: [tailwindcss()],
  },

  nitro: {
    preset: "cloudflare-pages",
    cloudflare: {
      wrangler: {
        name: "homepage-fabraham",
      },
    },
  },

  modules: [
    "@tresjs/nuxt",
    "shadcn-nuxt",
    "@nuxt/content",
    "@nuxt/image",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
    "@nuxthub/core",
  ],

  // Add content configuration for Cloudflare Pages
  content: {
    database: {
      type: "d1",
      bindingName: "DB",
    },
  },

  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: "./components/ui",
  },

  colorMode: {
    classSuffix: "",
  },
});
