#!/usr/bin/env node
/**
 * vercel-headers-to-caddy.mjs
 *
 * Génère deploy/vps/caddy/generated/headers.caddy à partir des en-têtes
 * globaux ("source": "/(.*)") de frontend/vercel.json.
 *
 * Pourquoi : vercel.json reste la seule source de vérité pour la CSP et les
 * en-têtes de sécurité du site. Une modification de la CSP (ex. retrait de
 * Crisp ou de Google Fonts) s'applique au VPS au prochain deploy.sh, sans
 * avoir à recopier quoi que ce soit dans le Caddyfile.
 *
 * Usage (depuis la racine du repo) : node deploy/vps/scripts/vercel-headers-to-caddy.mjs
 * Exécuté automatiquement par deploy.sh, dans le container Node du build.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const vercelPath = resolve(repoRoot, "frontend/vercel.json");
const outPath = resolve(repoRoot, "deploy/vps/caddy/generated/headers.caddy");

// Ajoutés par Vercel automatiquement sur ses domaines, absents de vercel.json.
const EXTRA_HEADERS = [
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
];

// Gérés par le Caddyfile (cache par type de fichier), pas par ce bloc global.
const SKIPPED = new Set(["cache-control"]);

function fail(message) {
  console.error(`[vercel-headers-to-caddy] ERREUR : ${message}`);
  process.exit(1);
}

function quote(value) {
  // Les accolades seraient interprétées comme des placeholders Caddy.
  if (/[{}]/.test(value)) {
    fail(`valeur contenant { ou } non supportée : ${value.slice(0, 80)}…`);
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

let config;
try {
  config = JSON.parse(readFileSync(vercelPath, "utf8"));
} catch (err) {
  fail(`lecture de ${vercelPath} impossible (${err.message})`);
}

const globalRule = (config.headers ?? []).find((rule) => rule.source === "/(.*)");
if (!globalRule || !Array.isArray(globalRule.headers)) {
  fail('aucune règle "source": "/(.*)" avec des headers dans vercel.json');
}

const headers = globalRule.headers
  .filter(({ key }) => !SKIPPED.has(String(key).toLowerCase()))
  .map(({ key, value }) => {
    if (!/^[A-Za-z0-9-]+$/.test(String(key))) fail(`nom d'en-tête invalide : ${key}`);
    return [String(key), String(value)];
  });

const known = new Set(headers.map(([key]) => key.toLowerCase()));
for (const [key, value] of EXTRA_HEADERS) {
  if (!known.has(key.toLowerCase())) headers.push([key, value]);
}

const lines = [
  "# AUTO-GÉNÉRÉ par deploy/vps/scripts/vercel-headers-to-caddy.mjs",
  "# depuis frontend/vercel.json — ne pas modifier à la main.",
  "header {",
  ...headers.map(([key, value]) => `\t${key} ${quote(value)}`),
  "\t-Server",
  "}",
  "",
];

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`[vercel-headers-to-caddy] ${headers.length} en-têtes écrits dans ${outPath}`);
