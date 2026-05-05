/**
 * size-limit configuration for DeepSight frontend.
 *
 * Used by:
 *   - `npm run size`        → check the locally built bundle
 *   - `npm run size:check`  → CI gate (uses --json for machine-readable output)
 *   - `.github/workflows/bundle-size.yml` → comments diff on every PR
 *
 * We use the `@size-limit/file` plugin only — no runtime measurement.
 * Rationale: the runtime preset (`@size-limit/time`) needs a headless
 * Chrome and is flaky in CI/Windows. We only need to gate static asset
 * sizes (the most common regression vector).
 *
 * Budgets are gzipped sizes. They are intentionally generous — the goal
 * is to prevent regressions, not enforce a perfect bundle. Tighten over
 * time as we trim chunks.
 *
 * To tweak a budget:
 *   1. Run `cd frontend && npm run build && npm run size`
 *   2. Compare current sizes with the limits below
 *   3. Set new limit ≈ current + 5% (small headroom, no slack for drift)
 *   4. Document the change in the PR description
 */

module.exports = [
  // ── Initial bundle (entry chunk) ──────────────────────────────────
  // This is what users download before they see anything. Most critical.
  {
    name: "initial bundle (index)",
    path: "dist/assets/index-*.js",
    limit: "300 kB",
    gzip: true,
    brotli: false,
  },

  // ── Manual vendor chunks ─────────────────────────────────────────
  // These are split via `manualChunks` in vite.config.ts.
  // React + ReactDOM + Router are loaded on every page → cached aggressively.
  {
    name: "vendor-react",
    path: "dist/assets/vendor-react-*.js",
    limit: "85 kB",
    gzip: true,
    brotli: false,
  },
  {
    name: "vendor-query",
    path: "dist/assets/vendor-query-*.js",
    limit: "20 kB",
    gzip: true,
    brotli: false,
  },
  {
    name: "vendor-ui",
    path: "dist/assets/vendor-ui-*.js",
    limit: "30 kB",
    gzip: true,
    brotli: false,
  },
  {
    name: "vendor-motion",
    path: "dist/assets/vendor-motion-*.js",
    limit: "55 kB",
    gzip: true,
    brotli: false,
  },
  {
    name: "vendor-markdown",
    path: "dist/assets/vendor-markdown-*.js",
    limit: "60 kB",
    gzip: true,
    brotli: false,
  },
  {
    name: "vendor-state",
    path: "dist/assets/vendor-state-*.js",
    limit: "10 kB",
    gzip: true,
    brotli: false,
  },

  // ── Whole dist (catch-all) ────────────────────────────────────────
  // Sum of everything Vercel serves. Set generously since mermaid (~444 kB
  // brotli), katex (~78 kB), analytics dashboards, recharts and excalidraw
  // are lazy-loaded and can be heavy. Used to detect "I added a 2 MB lib"
  // without waiting for a granular limit to trip.
  // Baseline 2026-05-05: ~1.97 MB gzipped → limit set with ~12% headroom.
  {
    name: "total dist (all JS, gzipped)",
    path: "dist/assets/*.js",
    limit: "2200 kB",
    gzip: true,
    brotli: false,
  },
];
