import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.BRIAN_PORT ?? 4400}`,
        changeOrigin: true,
        // SSE needs an un-buffered, long-lived connection.
        ws: false,
      },
    },
  },
  build: { outDir: "dist", sourcemap: false },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "brian",
        short_name: "brian",
        description: "A tiny local Kanban for work that needs a human in the loop.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0a0a0a",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Precache only hashed/immutable assets. The HTML shell is never
        // precached: a shell cached from build N pointing at assets from
        // build N+1 renders a blank page after every rebuild. Navigations
        // always go to the local server first, which is always available.
        globPatterns: ["**/*.{js,css,svg,png,woff2}"],
        globIgnores: ["**/index.html"],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "brian-shell",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // The SSE stream must never be handled by the service worker.
            urlPattern: ({ url }) => url.pathname === "/api/events",
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "brian-api",
              networkTimeoutSeconds: 10,
              // Only ever a last-resort offline fallback, expired aggressively.
              expiration: { maxEntries: 32, maxAgeSeconds: 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
