/**
 * Lighthouse CI configuration for DeepSight frontend.
 *
 * Used by `.github/workflows/lighthouse-ci.yml` against Vercel preview
 * deployments. The `url` array is filled in dynamically by the workflow
 * (the preview URL is appended to each path), so leave the placeholders
 * alone — the workflow does the substitution before invoking `lhci autorun`.
 *
 * Run locally:
 *   cd frontend
 *   npm run build
 *   npm run lighthouse:local   # boots `npm run preview` on :4173
 *
 * Budgets are tuned for a React SaaS with significant first-load JS.
 * Adjust here, NOT in the workflow.
 */

module.exports = {
  ci: {
    collect: {
      // The workflow overrides `url` at runtime by passing `urls:` to the
      // treosh/lighthouse-ci-action input — this list is the LOCAL fallback
      // for `npm run lighthouse:local` (which boots `vite preview` on 4173).
      url: [
        "http://localhost:4173/",
        "http://localhost:4173/login",
        "http://localhost:4173/upgrade",
        "http://localhost:4173/legal/privacy",
      ],
      // For `npm run lighthouse:local` only — boots `vite preview` first.
      // Ignored when the workflow passes its own URLs.
      startServerCommand: "npm run preview -- --port 4173",
      startServerReadyPattern: "Local:.*4173",
      startServerReadyTimeout: 60000,
      // Run each URL 3 times and report the median to reduce variance.
      numberOfRuns: 3,
      settings: {
        // Desktop preset → realistic for our primary user demographic.
        preset: "desktop",
        // Skip audits that don't apply to a SaaS dashboard (e.g. PWA).
        skipAudits: ["uses-http2", "canonical"],
        // Throttling is applied by the preset; keep network/CPU realistic.
        throttlingMethod: "simulate",
        // Chrome flags for headless CI.
        chromeFlags: "--no-sandbox --headless=new --disable-gpu",
      },
    },
    assert: {
      // ── WARN-ONLY MODE ──────────────────────────────────────────────
      // First runs only emit warnings — the workflow still passes.
      // To make these blocking, change `assertions` values from "warn"
      // to "error" (see docs/RUNBOOK.md §20).
      // ────────────────────────────────────────────────────────────────
      assertions: {
        // Category-level scores (0..1 scale)
        "categories:performance": [
          "warn",
          { minScore: 0.75, aggregationMethod: "median-run" },
        ],
        "categories:accessibility": [
          "warn",
          { minScore: 0.9, aggregationMethod: "median-run" },
        ],
        "categories:best-practices": [
          "warn",
          { minScore: 0.85, aggregationMethod: "median-run" },
        ],
        "categories:seo": [
          "warn",
          { minScore: 0.9, aggregationMethod: "median-run" },
        ],
        // Core Web Vitals (milliseconds / unitless)
        "largest-contentful-paint": [
          "warn",
          { maxNumericValue: 4000, aggregationMethod: "median-run" },
        ],
        "cumulative-layout-shift": [
          "warn",
          { maxNumericValue: 0.1, aggregationMethod: "median-run" },
        ],
        "interaction-to-next-paint": [
          "warn",
          { maxNumericValue: 500, aggregationMethod: "median-run" },
        ],
        "total-blocking-time": [
          "warn",
          { maxNumericValue: 600, aggregationMethod: "median-run" },
        ],
        // Disable noisy audits that fight legitimate Sentry / PostHog usage.
        "third-party-summary": "off",
        "uses-rel-preconnect": "off",
        "non-composited-animations": "off",
      },
    },
    upload: {
      // Public temporary storage by Lighthouse CI team — no secrets needed.
      // The PR commenter action (treosh/lighthouse-ci-action) reads results
      // from the workflow artifact, so this upload is purely optional.
      target: "temporary-public-storage",
    },
  },
};
