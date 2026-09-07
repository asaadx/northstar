import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` must match the path the app is served from.
// Root domain (Vercel/Netlify/custom domain) -> "/"
// GitHub Pages project site -> "/northstar/"
export default defineConfig({
  base: process.env.NORTHSTAR_BASE ?? "/",
  plugins: [react()],
  define: {
    // Baked once per dev-server start, so a development run gets a fresh
    // database while page reloads and HMR updates within that run keep state.
    __DEV_RUN__: JSON.stringify(Date.now().toString(36)),
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  server: {
    port: 5173,
    host: true,
    // Vite blocks unknown Host headers. Needed to reach the server through
    // `tailscale serve` from another device on the tailnet.
    allowedHosts: [".ts.net"],
  },
  preview: {
    port: 4176,
    host: true,
    allowedHosts: [".ts.net"],
  },
});
