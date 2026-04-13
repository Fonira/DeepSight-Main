import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./contexts/ThemeContext";

// 🔍 Initialisation Sentry (monitoring des erreurs)
import { initSentry, SentryErrorBoundary, isSentryEnabled } from "./lib/sentry";
initSentry();

document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") document.body.classList.add("user-is-tabbing");
});
document.addEventListener("mousedown", () => {
  document.body.classList.remove("user-is-tabbing");
});

// 🛡️ Global handler for chunk loading errors (post-deployment cache issues)
// Safari reports these as "Load failed" instead of "Failed to fetch"
window.addEventListener("error", (event) => {
  const msg = event.message || "";
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk")
  ) {
    const RELOAD_KEY = "chunk_reload_ts";
    try {
      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 30000) {
        sessionStorage.setItem(RELOAD_KEY, now.toString());
        window.location.reload();
      }
    } catch {
      // sessionStorage unavailable
    }
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message || String(event.reason) || "";
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("Load failed") // Safari-specific
  ) {
    const RELOAD_KEY = "chunk_reload_ts";
    try {
      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 30000) {
        sessionStorage.setItem(RELOAD_KEY, now.toString());
        window.location.reload();
      }
    } catch {
      // sessionStorage unavailable
    }
  }
});

// 🔄 Nuclear cache cleanup — purge ALL stale caches to prevent chunk mismatch crashes
// This runs once per deploy (tracked by BUILD_VERSION in sessionStorage)
declare const __BUILD_TIMESTAMP__: string;
const BUILD_VERSION = __BUILD_TIMESTAMP__;
try {
  const cachedVersion = sessionStorage.getItem("ds_build_ver");
  if (cachedVersion !== BUILD_VERSION) {
    sessionStorage.setItem("ds_build_ver", BUILD_VERSION);
    // Purge ALL browser caches (SW-managed and others)
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
    // Unregister ALL service workers to force fresh fetch
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
    }
    // If this is NOT the first visit (cachedVersion exists but differs), force reload
    if (cachedVersion) {
      window.location.reload();
    }
  }
} catch {
  // sessionStorage unavailable — skip versioning
}

// 🔄 Force Service Worker update for any remaining SWs
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      reg.update().catch(() => {});
    }
  });
}

// Composant de fallback en cas d'erreur critique
const ErrorFallback = () => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
      <h1 className="text-2xl font-bold text-red-400 mb-4">😵 Oups !</h1>
      <p className="text-white/80 mb-6">
        Une erreur inattendue s'est produite. Notre équipe a été notifiée.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
      >
        Recharger la page
      </button>
    </div>
  </div>
);

// Render avec ou sans Sentry Error Boundary
const AppWithErrorBoundary = isSentryEnabled ? (
  <HelmetProvider>
    <SentryErrorBoundary fallback={<ErrorFallback />} showDialog>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </SentryErrorBoundary>
  </HelmetProvider>
) : (
  <HelmetProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </HelmetProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{AppWithErrorBoundary}</StrictMode>,
);
