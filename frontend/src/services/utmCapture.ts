/**
 * 🎯 UTM Auto-Capture Helper — Launch J0 (2026-05-15)
 *
 * Parse `window.location.search` au mount AppProvider, persiste les paramètres
 * UTM dans `localStorage` 30 jours (RGPD-tolerable : pas de PII, expire auto),
 * puis les attache à TOUS les events PostHog via `posthog.register()`.
 *
 * Sources canoniques tracked (SSOT vocab aligné avec backend Stripe metadata
 * `acquisition_channel` côté sub-agent Q) :
 *   `product_hunt | twitter | reddit | linkedin | indiehackers | hackernews |
 *    karim_inmail | mobile_deeplink | direct`.
 * Tout autre `utm_source` est conservé tel quel (debug + futurs canaux).
 *
 * Persistance : clé `deepsight_utm_v1` (versioned — bump version pour forcer
 * re-capture si schema change). Cleanup auto si `capturedAt > 30j`.
 *
 * Idempotent : si UTM déjà capturé < 30j, ne réécrase pas.
 *
 * Cross-team contract :
 * - Frontend (ce fichier) : capture URL params + referrer fallback + register.
 * - Backend `auth/router.py` : reçoit `signup_source/utm_*` au register, les
 *   persiste dans `User.preferences` (JSON, migration 008 prod).
 * - Backend `posthog_service.py` : fire `signup_completed/payment_completed/
 *   churn_event` server-side avec ces mêmes propriétés.
 */
import posthog from "posthog-js";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vocabulaire SSOT pour `utm_source` (et `signup_source` côté backend).
 * Aligné avec sub-agent Q Stripe `acquisition_channel`. Toute source non
 * listée est conservée brute (pour debug) — ne PAS l'invalider.
 */
export type CanonicalUtmSource =
  | "product_hunt"
  | "twitter"
  | "reddit"
  | "linkedin"
  | "indiehackers"
  | "hackernews"
  | "karim_inmail"
  | "mobile_deeplink"
  | "direct";

export interface CapturedUtm {
  /** Source canonique normalisée OU valeur brute si inconnue. */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  /** `document.referrer` au moment de la capture. */
  referrer?: string;
  /** `window.location.pathname` au moment de la capture. */
  landing_page?: string;
  /** ISO date — utilisé pour le TTL 30j. */
  capturedAt?: string;
}

const STORAGE_KEY = "deepsight_utm_v1"; // gitleaks:allow — localStorage key name, not a credential
const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 86400 * 1000;

/**
 * Mapping aliases bruts (URL params lower-cased OU referrer hostnames) →
 * vocabulaire SSOT. Ordre = priorité de match dans `inferSourceFromReferrer`.
 */
const KNOWN_SOURCES: Record<string, CanonicalUtmSource> = {
  // Product Hunt
  producthunt: "product_hunt",
  product_hunt: "product_hunt",
  ph: "product_hunt",
  "producthunt.com": "product_hunt",
  // Twitter / X
  twitter: "twitter",
  x: "twitter",
  "t.co": "twitter",
  "twitter.com": "twitter",
  "x.com": "twitter",
  // Reddit
  reddit: "reddit",
  "reddit.com": "reddit",
  "old.reddit.com": "reddit",
  // LinkedIn
  linkedin: "linkedin",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  // Indie Hackers
  indiehackers: "indiehackers",
  ih: "indiehackers",
  "indiehackers.com": "indiehackers",
  // Hacker News
  hackernews: "hackernews",
  hn: "hackernews",
  "news.ycombinator.com": "hackernews",
  // Karim B2B InMail
  karim: "karim_inmail",
  karim_inmail: "karim_inmail",
  // Mobile deeplink (extension/app → web)
  mobile: "mobile_deeplink",
  mobile_deeplink: "mobile_deeplink",
  app: "mobile_deeplink",
  extension: "mobile_deeplink",
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function normalizeSource(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim();
  if (!lower) return undefined;
  return KNOWN_SOURCES[lower] ?? raw;
}

function readStored(): CapturedUtm | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CapturedUtm;
    if (parsed.capturedAt) {
      const ageMs = Date.now() - new Date(parsed.capturedAt).getTime();
      if (ageMs > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(utm: CapturedUtm): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
  } catch {
    // Safari private mode / quota exceeded — silent no-op
  }
}

function inferSourceFromReferrer(
  referrer: string,
): CanonicalUtmSource | string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    // Match exact hostname first
    if (host in KNOWN_SOURCES) return KNOWN_SOURCES[host];
    // Then partial substring match for subdomains
    for (const [needle, label] of Object.entries(KNOWN_SOURCES)) {
      if (host.includes(needle)) return label;
    }
    // Garde le hostname brut comme dernier recours (debug)
    return host;
  } catch {
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * À appeler une fois au mount de l'App (cf. `App.tsx` `useEffect` initial).
 *
 * Idempotent : si UTM déjà capturé < 30j, ne réécrase pas et register juste
 * dans PostHog (au cas où ce serait une navigation post-init via SPA route).
 *
 * Safe à appeler avant `posthog.init()` — `posthog-js` queue les appels en
 * attendant l'init, donc pas de race condition. Pas de side effect si
 * localStorage indispo (Safari private mode → silent no-op).
 */
export function captureUtmParams(): CapturedUtm {
  const existing = readStored();
  if (existing) {
    posthog.register(existing);
    return existing;
  }

  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";

  const utm: CapturedUtm = {
    utm_source:
      normalizeSource(params.get("utm_source")) ??
      inferSourceFromReferrer(referrer) ??
      "direct",
    utm_medium: params.get("utm_medium") ?? undefined,
    utm_campaign: params.get("utm_campaign") ?? undefined,
    utm_term: params.get("utm_term") ?? undefined,
    utm_content: params.get("utm_content") ?? undefined,
    referrer: referrer || undefined,
    landing_page: window.location.pathname || undefined,
    capturedAt: new Date().toISOString(),
  };

  writeStored(utm);

  // Register dans PostHog : ces props seront attachées à TOUS les events
  // futurs (pas juste signup) pour permettre breakdown sur n'importe quel
  // event ultérieur. Persistantes au niveau session PostHog.
  posthog.register(utm);

  return utm;
}

/**
 * Helper read-only à utiliser depuis n'importe quel composant qui veut
 * envoyer un event avec les UTM (ex : `handleClickSignUp`,
 * `handleSubscribe`). Retourne `{ utm_source: "direct" }` si rien capturé
 * (fallback safe pour ne jamais émettre des events orphelins de source).
 */
export function getCapturedUtm(): CapturedUtm {
  return readStored() ?? { utm_source: "direct" };
}

/**
 * Cleanup explicite. Utile au logout pour repartir d'une page propre, ou en
 * test/debug. Sinon le TTL 30j auto-purge.
 */
export function clearCapturedUtm(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
