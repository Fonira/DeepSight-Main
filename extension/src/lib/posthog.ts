// extension/src/lib/posthog.ts
//
// Init PostHog client pour l'extension Chrome DeepSight (Manifest V3).
//
// Scope d'utilisation :
//   - sidepanel (entry `sidepanel.html`)         ✅ wired
//   - viewer    (entry `viewer.html`, optionnel) ✅ wired
//   - background service worker                   ❌ NE PAS appeler
//   - content script (overlay YouTube Shadow DOM) ❌ NE PAS appeler
//     (le frontend web pose son propre posthog sur la page YouTube → on
//     éviterait le double-tracking si on l'ajoutait ici, et le content script
//     n'a pas accès à window de la même façon que les pages d'extension).
//
// Le module est volontairement "lazy" : si la clé `POSTHOG_KEY` n'est pas
// définie au build (via webpack DefinePlugin → process.env.POSTHOG_KEY) ou si
// `window` n'existe pas (service worker), `init()` no-op et `posthog` exporté
// reste l'objet du module mais sans réel `__loaded`. On garde le buffer
// in-memory de `utils/analytics.ts` comme fallback dans ces cas.
//
// Clé publique (frontend = même projet PostHog) :
//   phc_wckMZ2qV1QVvmL7zC7K4kHgKIfFHtUeQINcsaIT4ttc
// Host :
//   https://eu.i.posthog.com (résidence EU, RGPD).
// La clé est injectée à build time par webpack DefinePlugin (process.env.*).

import posthog from "posthog-js";

// `process.env.POSTHOG_KEY` / `POSTHOG_HOST` sont remplacés par webpack
// DefinePlugin à build time (cf. webpack.config.js). On déclare un type local
// minimal pour ne pas dépendre de @types/node.
declare const process: { env: { POSTHOG_KEY?: string; POSTHOG_HOST?: string } };

const POSTHOG_KEY: string =
  (typeof process !== "undefined" && process.env?.POSTHOG_KEY) || "";

const POSTHOG_HOST: string =
  (typeof process !== "undefined" && process.env?.POSTHOG_HOST) ||
  "https://eu.i.posthog.com";

let isInitialized = false;

/**
 * Initialise PostHog dans une page d'extension (sidepanel/viewer).
 * No-op si :
 *  - déjà initialisé
 *  - clé manquante (build sans VITE_POSTHOG_KEY/POSTHOG_KEY)
 *  - hors contexte `window` (service worker MV3, Node test runner)
 */
export function initPostHog(): void {
  if (isInitialized) return;
  if (!POSTHOG_KEY) return;
  if (typeof window === "undefined") return;

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Pas d'autocapture : on n'envoie que les events explicites définis dans
      // utils/analytics.ts (Voice Call + à venir).
      autocapture: false,
      // Pas de pageviews automatiques (l'extension n'est pas un site SPA).
      capture_pageview: false,
      // Profiles uniquement pour utilisateurs identifiés (RGPD).
      person_profiles: "identified_only",
      // Pas de session recording dans l'extension (perf + privacy + CSP).
      disable_session_recording: true,
      respect_dnt: true,
      // Persistence localStorage : OK pour pages d'extension (sidepanel/viewer
      // ont accès au DOM `window.localStorage`).
      persistence: "localStorage",
    });
    isInitialized = true;
  } catch {
    // Best effort — analytics ne doit jamais casser l'extension.
  }
}

export { posthog };
