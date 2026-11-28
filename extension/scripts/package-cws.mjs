#!/usr/bin/env node
/**
 * Paquet Chrome Web Store — zip de dist/ prêt à téléverser.
 *
 *   npm run package:cws        (build de production puis ce script)
 *   → release/deepsight-extension-v<version>.zip
 *
 * Par rapport à dist/ (ce qu'on charge en local) :
 *  - `key` est retiré du manifest : il fige l'ID de l'extension non
 *    empaquetée, mais le Store refuse un manifest qui le contient ;
 *  - les source maps sont exclues ;
 *  - voix coupée (`voice: false` dans src/utils/features.ts) : les fichiers
 *    propres aux appels vocaux sont exclus, la permission `offscreen` et
 *    les hôtes ElevenLabs de la CSP sont retirés. Le Store refuse les
 *    permissions inutilisées, et le SDK ElevenLabs référence un worklet
 *    hébergé sur un CDN (code distant interdit en MV3).
 *
 * Aucune dépendance : le zip (deflate) est écrit avec zlib de Node.
 */

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const OUT_DIR = join(ROOT, "release");

/** Fichiers de dist/ qui ne servent qu'aux appels vocaux. */
const VOICE_ONLY_FILES = new Set([
  "elevenlabs-sdk.js",
  "rawAudioProcessor.js",
  "audioConcatProcessor.js",
  "offscreen-mic.html",
  "offscreen-mic.js",
  "mic-permission.html",
  "mic-permission.js",
]);

const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db"]);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function readVoiceSwitch() {
  const featuresPath = join(ROOT, "src", "utils", "features.ts");
  const source = readFileSync(featuresPath, "utf8");
  const match = source.match(/\bvoice:\s*(true|false)\b/);
  if (!match) fail("FEATURES.voice introuvable dans src/utils/features.ts");
  return match[1] === "true";
}

function listFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

function storeManifest(raw, voiceEnabled) {
  const manifest = JSON.parse(raw);
  const changes = [];
  if ("key" in manifest) {
    delete manifest.key;
    changes.push("key retiré");
  }
  if (!voiceEnabled) {
    const permissions = Array.isArray(manifest.permissions)
      ? manifest.permissions
      : [];
    if (permissions.includes("offscreen")) {
      manifest.permissions = permissions.filter((p) => p !== "offscreen");
      changes.push("permission offscreen retirée");
    }
    const csp = manifest.content_security_policy?.extension_pages;
    if (typeof csp === "string" && csp.includes("elevenlabs")) {
      manifest.content_security_policy.extension_pages = csp
        .split(";")
        .map((directive) =>
          directive
            .trim()
            .split(/\s+/)
            .filter((token) => !token.includes("elevenlabs"))
            .join(" "),
        )
        .join("; ");
      changes.push("hôtes ElevenLabs retirés de la CSP");
    }
  }
  return {
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    version: manifest.version,
    changes,
  };
}

// ── Écriture zip (deflate, entrées en UTF-8, horodatage fixe) ──

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// 2026-01-01 00:00 en format DOS : zip identique d'un build à l'autre.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const UTF8_FLAG = 0x0800;

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < data.length;
    const body = useDeflate ? compressed : data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + body.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

// ── Main ──

let distFiles;
try {
  distFiles = listFiles(DIST);
} catch {
  fail("dist/ introuvable : lance d'abord `npm run build`.");
}

const voiceEnabled = readVoiceSwitch();
const entries = [];
const excluded = [];
let manifestInfo = null;

for (const file of distFiles) {
  const name = relative(DIST, file).split(sep).join("/");
  const base = name.split("/").pop();
  if (IGNORED_NAMES.has(base) || name.endsWith(".map")) {
    excluded.push(name);
    continue;
  }
  if (!voiceEnabled && VOICE_ONLY_FILES.has(name)) {
    excluded.push(name);
    continue;
  }
  if (name === "manifest.json") {
    manifestInfo = storeManifest(readFileSync(file, "utf8"), voiceEnabled);
    entries.push({ name, data: Buffer.from(manifestInfo.content, "utf8") });
    continue;
  }
  entries.push({ name, data: readFileSync(file) });
}

if (!manifestInfo) fail("dist/manifest.json introuvable.");

// Le manifest en tête de l'archive (convention ; le Store ne l'exige pas).
const isManifest = (entry) => entry.name === "manifest.json";
entries.sort((a, b) => Number(isManifest(b)) - Number(isManifest(a)));

mkdirSync(OUT_DIR, { recursive: true });
const zipName = `deepsight-extension-v${manifestInfo.version}.zip`;
const zipPath = join(OUT_DIR, zipName);
const zip = buildZip(entries);
writeFileSync(zipPath, zip);

const sizeKb = (zip.length / 1024).toFixed(0);
console.log(
  `✔ ${relative(ROOT, zipPath)} — ${entries.length} fichiers, ${sizeKb} Ko`,
);
console.log(`  voix : ${voiceEnabled ? "activée" : "coupée"}`);
if (manifestInfo.changes.length) {
  console.log(`  manifest : ${manifestInfo.changes.join(", ")}`);
}
if (excluded.length) console.log(`  exclus : ${excluded.join(", ")}`);
