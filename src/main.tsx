import "./styles/tokens.css";
import "./styles/chrome.css";
import "./styles/roadmap.css";
import "./styles/pages.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initStore } from "./store";

const mount = document.getElementById("root");
if (mount === null) throw new Error("#root missing from document");

await initStore();

createRoot(mount).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .catch((error: unknown) => {
        console.error("northstar: service worker registration failed", error);
      });
  } else {
    // The worker serves assets cache-first, which is correct for hashed
    // production filenames but poisonous in development, where Vite serves
    // modules at stable paths like `/src/main.tsx`. Tear it down so the dev
    // server is always the source of truth.
    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in globalThis) {
          const names = await caches.keys();
          await Promise.all(names.map((name) => caches.delete(name)));
        }
      } catch (error: unknown) {
        console.error("northstar: could not release the service worker", error);
      }
    })();
  }
}
