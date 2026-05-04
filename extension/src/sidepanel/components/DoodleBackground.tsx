/**
 * DOODLE BACKGROUND — Extension Sidepanel (port simplifié du frontend web v13)
 *
 * Adaptations sidepanel (vs frontend/src/components/DoodleBackground.tsx) :
 * - TILE 280px (vs 500px) → ~1.4 tiles visibles dans 400px
 * - ~60 éléments (vs 200) répartis sur 7 layers
 * - Dark mode forcé (sidepanel toujours sombre)
 * - Pas de useLocation : seed statique mémorisé au mount
 * - Pas de framer-motion : SVG static via data URI
 * - Pas de désactivation mobile : actif TOUJOURS
 * - prefers-reduced-motion → render null
 *
 * Garde tous les arrays d'icônes du fichier source web (ICONS_VIDEO, ICONS_STUDY,
 * ICONS_TECH, ICONS_AI, ICONS_CREATIVE, ICONS_ABSTRACT, ICONS_OBJECTS,
 * ICONS_WHIMSICAL, ICONS_SCIENCE, ICONS_BRAND, SHAPES_ORGANIC, SHAPES_DECORATIVE).
 */

import React, { useMemo, useState, useEffect } from "react";

// ─── SVG Icon Paths (24×24 viewBox, copiés du frontend web) ─────────────────
// prettier-ignore
const ICONS_VIDEO: string[] = ["M5 3l14 9-14 9V3z","M6 4h4v16H6zm8 0h4v16h-4z","M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z","M2 4h20v12H2zm5 16h10m-5-4v4","M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14V8l6 4-6 4z","M3 18v-6a9 9 0 0118 0v6","M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0","M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2","M22.54 6.42A2.78 2.78 0 0020.6 4.42C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z","M4 2v20h16V2zm2 2h2v2H6zm4 0h4v2h-4zm6 0h2v2h-2zM6 18h2v2H6zm4 0h4v2h-4zm6 0h2v2h-2z","M15 3l6 6-6 6M9 21l-6-6 6-6","M12 2v4m0 12v4M2 12h4m12 0h4"];
// prettier-ignore
const ICONS_STUDY: string[] = ["M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z","M22 10l-10-5L2 10l10 5zm-16 2v5c0 2 2.7 3 6 3s6-1 6-3v-5","M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z","M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zm0 0v6h6","M9 18h6M10 22h4M12 2a6 6 0 00-6 6c0 2 1 3.5 2.5 5 .5.5 1 1.5 1 2.5V17h5v-1.5c0-1 .5-2 1-2.5 1.5-1.5 2.5-3 2.5-5a6 6 0 00-6-6z","M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z","M10 2v6l-2 4h8l-2-4V2zm-2 12v2m8-2v2M8 22h8","M3 21c3 0 7-1 7-8V5M14 5c0 6.5 4 8 7 8","M9 2h6v4H9zM16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m1 9l2 2 4-4","M12 4c-2 0-3.5 1-4 2.5-.5-1-2-1.5-3-.5S3.5 8 4 9c-1 .5-1.5 2-.5 3s2 1.5 3 1c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5c1 .5 2 0 3-1s.5-2.5-.5-3c.5-1 0-2.5-1-3.5s-2.5 0-3 .5C15.5 5 14 4 12 4z","M6 9H3V4h3m12 5h3V4h-3M12 15a6 6 0 006-6V3H6v6a6 6 0 006 6zm0 0v4m-4 2h8","M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4a2 2 0 012-2h14v14H6.5A2.5 2.5 0 004 18.5z"];
// prettier-ignore
const ICONS_TECH: string[] = ["M16 18l6-6-6-6M8 6l-6 6 6 6","M4 17l6-6-6-6m8 14h8","M6 6h12v12H6zM2 10h2m16 0h2M2 14h2m16 0h2M10 2v2m4-2v2M10 20v2m4-2v2","M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6","M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01","M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3","M2 18h20l-2-8H4zm2-8V5a2 2 0 012-2h12a2 2 0 012 2v5","M16 5H8a6 6 0 000 12h8a6 6 0 000-12zm0 8a2 2 0 100-4 2 2 0 000 4z","M12 2a5 5 0 00-5 5v10a5 5 0 0010 0V7a5 5 0 00-5-5zm0 0v6","M2 6h20v12H2zm3 3h2v2H5zm4 0h2v2H9zm4 0h2v2h-2zm4 0h2v2h-2zM5 13h14v2H5z","M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0","M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z"];
// prettier-ignore
const ICONS_AI: string[] = ["M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6","M13 2L3 14h9l-1 8 10-12h-9z","M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8zm11-3a3 3 0 100 6 3 3 0 000-6z","M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z","M22 2L11 13m11-11l-7 20-4-9-9-4z","M4.9 19.1C1 15.2 1 8.8 4.9 4.9m14.2 0c3.9 3.9 3.9 10.3 0 14.2M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4m8.4 0c2.3 2.3 2.3 6.1 0 8.4M12 12h.01","M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z","M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z","M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z","M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5","M5 5a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM7 7l5 5m5-5l-5 5m-5 5l5-5m5 5l-5-5","M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 2c-5 0-8 5-8 10s3 10 8 10 8-5 8-10-3-10-8-10z"];
// prettier-ignore
const ICONS_CREATIVE: string[] = ["M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6z","M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z","M12 2l8.5 5v10L12 22l-8.5-5V7z","M12 2l10 10-10 10L2 12z","M2 17l3-7 4 4 3-9 3 9 4-4 3 7z","M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z","M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z","M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"];
// prettier-ignore
const ICONS_ABSTRACT: string[] = ["M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z","M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5","M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z","M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 6v6l4 2","M3 12h4l3-9 4 18 3-9h4","M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.83-.13 2.68-.36A6.92 6.92 0 0012 15a7 7 0 017-7c0-.65-.09-1.28-.26-1.88C17.33 3.55 14.87 2 12 2z","M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"];
// prettier-ignore
const ICONS_OBJECTS: string[] = ["M5 12h14a1 1 0 011 1v1a6 6 0 01-6 6H10a6 6 0 01-6-6v-1a1 1 0 011-1zM20 13h1a2 2 0 010 4h-1M8 6c0-1 .5-2 1.5-2s1 1 0 2-.5 2-1.5 2S8 7 8 6z","M12 2c-2 0-4 3-4 8v4l-3 3h14l-3-3v-4c0-5-2-8-4-8zM12 8v4M10 10h4","M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a5 5 0 100-10 5 5 0 000 10z","M12 2a10 10 0 100 20 10 10 0 000-20zM12 8a4 4 0 100 8 4 4 0 000-8z","M12 2c-4 0-7 4-7 8 0 3 1.5 5.5 3.5 7l3.5 2v2h0a1 1 0 002 0v-2l3.5-2c2-1.5 3.5-4 3.5-7 0-4-3-8-7-8z","M21 3l-8 8M6 13l5 5M2 22l4-4M10 18l3-3M7 15l3-3M13 5l6-3","M12 2v4M12 18v4M2 12h4M18 12h4M12 2l2 6-2 4-2-4 2-6z"];
// prettier-ignore
const ICONS_WHIMSICAL: string[] = ["M12 12a5 5 0 100-10 5 5 0 000 10zM3.6 15.4C2 14.3 1.3 13 2 12c1.2-2 5.5-2.5 9.8-.8M20.4 8.6C22 9.7 22.7 11 22 12c-1.2 2-5.5 2.5-9.8.8","M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10a2 2 0 002-2c0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3a2 2 0 012-2h2.4A6 6 0 0022 9.5C22 5.4 17.5 2 12 2z","M3 11h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 11l2-6h14l2 6M12 11v4M10 15h4","M9 2h6v4l3 6v6a3 3 0 01-3 3H9a3 3 0 01-3-3v-6l3-6zM9 2h6M7 14h10"];
// prettier-ignore
const ICONS_SCIENCE: string[] = ["M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0M12 2c-5 0-8 5-8 10s3 10 8 10 8-5 8-10-3-10-8-10z","M9 2h6v4l3 8v4a3 3 0 01-3 3H9a3 3 0 01-3-3v-4l3-8zM9 2h6M7 14h10","M12 22V8M12 2c4 0 8 3 8 8s-3 9-8 12c-5-3-8-7-8-12s4-8 8-8z","M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0","M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"];
// prettier-ignore
const ICONS_BRAND: string[] = ["M2.5 7A2.5 2.5 0 015 4.5h14A2.5 2.5 0 0121.5 7v10a2.5 2.5 0 01-2.5 2.5H5A2.5 2.5 0 012.5 17V7zm7.5 2v6l5-3-5-3z","M12 8a4 4 0 100 8 4 4 0 000-8zm0-6v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9l2.12 2.12M2 12h3m14 0h3"];
// prettier-ignore
const SHAPES_ORGANIC: string[] = ["M12.3 2.1c5.4.2 9.8 4.3 10.1 9.7.3 5.6-4.1 10.2-9.7 10.5-5.6.3-10.2-4.1-10.5-9.7C1.9 7.2 6 2.4 11.3 2.1z","M15.5 5.5c3.5 2 5 6 4 10s-4.5 7-8 7.5-7-1-9-4.5-1.5-8 1.5-11S12 3.5 15.5 5.5z","M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"];
// prettier-ignore
const SHAPES_DECORATIVE: string[] = ["M12 10a2 2 0 100 4 2 2 0 000-4z","M12 5v14M5 12h14","M18 6L6 18M6 6l12 12","M12 8a4 4 0 100 8 4 4 0 000-8z","M12 6l6 10H6z","M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"];

const ICON_POOL: string[] = [
  ...ICONS_VIDEO,
  ...ICONS_STUDY,
  ...ICONS_TECH,
  ...ICONS_AI,
  ...ICONS_CREATIVE,
  ...ICONS_ABSTRACT,
  ...ICONS_OBJECTS,
  ...ICONS_WHIMSICAL,
  ...ICONS_SCIENCE,
  ...ICONS_BRAND,
];
const ROTATIONS = [0, 12, -12, 25, -25, 40, -40, 55, -55, 90, -90, 135, 180];
const DARK_PALETTE = [
  "#A78BFA",
  "#818CF8",
  "#F472B6",
  "#FBBF24",
  "#34D399",
  "#60A5FA",
  "#F87171",
  "#C084FC",
  "#A5B4FC",
  "#E5E7EB",
];
const ACCENT_PRIMARY = "#D4A054";
const ACCENT_SECONDARY = "#C8903A";

// ─── Helpers ────────────────────────────────────────────────────────────────
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

interface DoodleItem {
  path: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  opacity: number;
  strokeWidth: number;
  fill: boolean;
}

const TILE = 280;
// Seed statique mémorisé au niveau module → constant durant la session
const STATIC_SEED = Math.floor(Math.random() * 100000);

// ─── Component ──────────────────────────────────────────────────────────────
const DoodleBackground: React.FC = () => {
  // prefers-reduced-motion → render null
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq?.removeEventListener?.("change", handler);
  }, []);

  const items = useMemo<DoodleItem[]>(() => {
    if (reducedMotion) return [];
    const out: DoodleItem[] = [];
    const pickStr = (pool: string[], seed: number): string =>
      pool[Math.floor(seededRandom(seed) * pool.length)];
    const pickNum = (pool: number[], seed: number): number =>
      pool[Math.floor(seededRandom(seed) * pool.length)];
    const sw = (seed: number, base: number): number =>
      +(base + (seededRandom(seed) - 0.5) * 0.6).toFixed(2);

    const vo = STATIC_SEED;

    // Layer 1 : Back (large) — 8 items
    for (let i = 0; i < 8; i++) {
      const s = vo + 100 + i * 37;
      out.push({
        path: pickStr(ICON_POOL, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: pickNum(ROTATIONS, s + 3),
        scale: 0.95 + seededRandom(s + 4) * 0.4,
        color: pickStr(DARK_PALETTE, s + 9),
        opacity: 0.12 + seededRandom(s + 5) * 0.06,
        strokeWidth: sw(s + 10, 1.6),
        fill: false,
      });
    }
    // Layer 2 : Mid — 12 items
    for (let i = 0; i < 12; i++) {
      const s = vo + 300 + i * 23;
      out.push({
        path: pickStr(ICON_POOL, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: pickNum(ROTATIONS, s + 3),
        scale: 0.55 + seededRandom(s + 4) * 0.3,
        color: pickStr(DARK_PALETTE, s + 9),
        opacity: 0.18 + seededRandom(s + 5) * 0.08,
        strokeWidth: sw(s + 10, 1.4),
        fill: false,
      });
    }
    // Layer 3 : Front (small bold) — 10 items
    for (let i = 0; i < 10; i++) {
      const s = vo + 600 + i * 31;
      out.push({
        path: pickStr(ICON_POOL, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: pickNum(ROTATIONS, s + 3),
        scale: 0.4 + seededRandom(s + 4) * 0.22,
        color: pickStr(DARK_PALETTE, s + 9),
        opacity: 0.22 + seededRandom(s + 5) * 0.1,
        strokeWidth: sw(s + 10, 1.3),
        fill: false,
      });
    }
    // Layer 4 : Brand accent doré DeepSight — 6 items
    for (let i = 0; i < 6; i++) {
      const s = vo + 900 + i * 41;
      out.push({
        path: pickStr(ICON_POOL, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: pickNum(ROTATIONS, s + 3),
        scale: 0.5 + seededRandom(s + 4) * 0.3,
        color: seededRandom(s + 6) > 0.5 ? ACCENT_PRIMARY : ACCENT_SECONDARY,
        opacity: 0.28 + seededRandom(s + 5) * 0.12,
        strokeWidth: sw(s + 10, 1.6),
        fill: false,
      });
    }
    // Layer 5 : Micro (tiny scattered) — 9 items
    for (let i = 0; i < 9; i++) {
      const s = vo + 1200 + i * 47;
      out.push({
        path: pickStr(ICON_POOL, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.22 + seededRandom(s + 4) * 0.18,
        color: pickStr(DARK_PALETTE, s + 9),
        opacity: 0.14 + seededRandom(s + 5) * 0.06,
        strokeWidth: sw(s + 10, 1.1),
        fill: false,
      });
    }
    // Layer 6 : Decorative dots/shapes (filled) — 12 items
    for (let i = 0; i < 12; i++) {
      const s = vo + 1500 + i * 13;
      const useAccent = seededRandom(s + 7) > 0.78;
      out.push({
        path: pickStr(SHAPES_DECORATIVE, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.18 + seededRandom(s + 4) * 0.25,
        color: useAccent ? ACCENT_PRIMARY : pickStr(DARK_PALETTE, s + 11),
        opacity: useAccent
          ? 0.26 + seededRandom(s + 5) * 0.12
          : 0.2 + seededRandom(s + 5) * 0.1,
        strokeWidth: 0,
        fill: true,
      });
    }
    // Layer 7 : Organic hand-drawn (subtle) — 3 items
    for (let i = 0; i < 3; i++) {
      const s = vo + 2500 + i * 53;
      out.push({
        path: pickStr(SHAPES_ORGANIC, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.6 + seededRandom(s + 4) * 0.4,
        color: pickStr(DARK_PALETTE, s + 9),
        opacity: 0.06 + seededRandom(s + 5) * 0.04,
        strokeWidth: sw(s + 10, 1.0),
        fill: false,
      });
    }

    return out;
  }, [reducedMotion]);

  // Build the tiled SVG data URI
  const patternSvg = useMemo<string | null>(() => {
    if (items.length === 0) return null;
    const paths = items
      .map(
        (d) =>
          `<g transform="translate(${d.x.toFixed(1)},${d.y.toFixed(1)}) rotate(${d.rotation}) scale(${d.scale.toFixed(2)})" opacity="${d.opacity.toFixed(3)}"><path d="${d.path}" transform="translate(-12,-12)" fill="${d.fill ? d.color : "none"}" stroke="${d.fill ? "none" : d.color}" stroke-width="${d.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></g>`,
      )
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}">${paths}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [items]);

  if (reducedMotion || !patternSvg) return null;

  // Gradient mask radial pour fade aux bords (premium edge fading)
  const maskGradient =
    "radial-gradient(ellipse 100% 100% at 50% 50%, black 50%, transparent 100%)";

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.35,
        backgroundImage: patternSvg,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE}px ${TILE}px`,
        maskImage: maskGradient,
        WebkitMaskImage: maskGradient,
      }}
    />
  );
};

export default DoodleBackground;
