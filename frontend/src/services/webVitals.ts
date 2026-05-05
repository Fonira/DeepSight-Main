/**
 * 📈 Web Vitals Service — Core Web Vitals tracking → PostHog
 *
 * Capture les six metrics standard du W3C Web Vitals :
 * - **LCP** (Largest Contentful Paint)  — perceived load speed
 * - **FID** (First Input Delay)         — load responsiveness (legacy, remplacé par INP)
 * - **CLS** (Cumulative Layout Shift)   — visual stability
 * - **INP** (Interaction to Next Paint) — responsiveness (succède à FID, Core Web Vital depuis mars 2024)
 * - **TTFB** (Time To First Byte)       — server response time
 * - **FCP** (First Contentful Paint)    — initial render speed
 *
 * Architecture :
 * - La librairie `web-vitals` émet une mesure par metric une fois la page idle/déchargée
 * - Chaque mesure → `analytics.captureWebVital(...)` qui forward vers PostHog
 * - `analytics.captureWebVital` est auto-gated sur `hasAnalyticsConsent()` (RGPD)
 * - Les métriques côté Vercel Speed Insights sont collectées indépendamment via le
 *   composant `<SpeedInsights />` monté dans `App.tsx`.
 *
 * Bundle size : `web-vitals` v4 ~5 KB gzipped (loadé sync au boot).
 *
 * Usage :
 *   import { initWebVitals } from "@/services/webVitals";
 *   useEffect(() => { initWebVitals(); }, []);
 */

import {
  onCLS,
  onFCP,
  onFID,
  onINP,
  onLCP,
  onTTFB,
  type Metric,
} from "web-vitals";
import {
  analytics,
  type WebVitalPayload,
  type WebVitalName,
} from "./analytics";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 STATE
// ═══════════════════════════════════════════════════════════════════════════════

let initialized = false;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convertit le `Metric` brut de la lib `web-vitals` en payload compatible analytics.
 * Le `name` du `Metric` est déjà l'un des 6 codes W3C standards (typage compatible
 * avec `WebVitalName`, copie explicite ci-dessous pour traçabilité TypeScript).
 */
function toPayload(metric: Metric): WebVitalPayload {
  // Le type `Metric["name"]` de web-vitals est déjà 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB'
  // qui correspond exactement à `WebVitalName` — assignation directe sans cast.
  const name: WebVitalName = metric.name;
  return {
    name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  };
}

/**
 * Forward un `Metric` vers PostHog. Non-bloquant et silencieux en cas d'erreur
 * (ne doit JAMAIS faire planter l'app pour un événement de télémétrie).
 */
function reportMetric(metric: Metric): void {
  try {
    analytics.captureWebVital(toPayload(metric));
  } catch (err) {
    // Silent fail — telemetry must never break the app
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[webVitals] capture failed:", err);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialise les listeners Web Vitals. Idempotent — sûr à appeler plusieurs fois.
 *
 * Comportement :
 * - Enregistre 6 callbacks one-shot sur le cycle de vie de la page (visibilitychange,
 *   pagehide, etc.). La lib `web-vitals` se charge du timing optimal.
 * - Chaque metric n'est émise qu'une fois (sauf CLS qui peut être ré-émis si
 *   la layout shift augmente). Le `delta` permet de différencier accumulation et delta.
 * - Aucun fetch sync sur le mainline : tout passe via PostHog (qui buffer + flush async).
 *
 * @returns void — ne lève jamais (telemetry never breaks the app)
 */
export function initWebVitals(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;

  initialized = true;

  try {
    onLCP(reportMetric);
    onFID(reportMetric);
    onCLS(reportMetric);
    onINP(reportMetric);
    onTTFB(reportMetric);
    onFCP(reportMetric);
  } catch (err) {
    // Silent fail — telemetry must never break the app
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[webVitals] init failed:", err);
    }
  }
}

/**
 * Test-only helper to reset the singleton state. Not exported in the public API.
 * @internal
 */
export function __resetWebVitalsForTests(): void {
  initialized = false;
}
