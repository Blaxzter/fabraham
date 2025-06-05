import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },

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
    "@nuxt/content",
    "@nuxt/eslint",
    "@nuxt/fonts",
    "@nuxt/scripts",
    "@nuxt/test-utils",
    "shadcn-nuxt",
    "@nuxt/image",
    "@nuxtjs/color-mode",
    "@nuxthub/core",
    "@tresjs/nuxt",
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
