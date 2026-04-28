#!/usr/bin/env node
/**
 * generate-sitemap.mjs — Generates frontend/public/sitemap.xml at build time.
 *
 * Wired via the `prebuild` npm script so each `vite build` regenerates a
 * fresh sitemap with today's lastmod, replacing the static checked-in
 * version. Routes are listed below; add a new entry whenever a public
 * page is added to App.tsx.
 *
 * Run manually: `node scripts/generate-sitemap.mjs`
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://www.deepsightsynthesis.com";
const TODAY = new Date().toISOString().split("T")[0];

/**
 * Public, indexable routes. Keep this in sync with App.tsx public routes.
 * Excludes /login, /auth/callback, /payment/success, /payment/cancel
 * (transient or auth gates) and /s/:shareToken (dynamic per-token).
 */
const ROUTES = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/about", priority: 0.8, changefreq: "monthly" },
  { path: "/upgrade", priority: 0.9, changefreq: "monthly" },
  { path: "/api-docs", priority: 0.6, changefreq: "monthly" },
  { path: "/contact", priority: 0.5, changefreq: "yearly" },
  { path: "/status", priority: 0.4, changefreq: "daily" },
  { path: "/legal", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/cgu", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/cgv", priority: 0.3, changefreq: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changefreq: "yearly" },
];

function buildSitemap() {
  const urls = ROUTES.map(
    ({ path, priority, changefreq }) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

const outputPath = resolve(__dirname, "../public/sitemap.xml");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, buildSitemap(), "utf-8");
console.log(
  `✓ Sitemap written: ${outputPath} (${ROUTES.length} URLs, lastmod=${TODAY})`,
);
