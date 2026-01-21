/**
 * 🎨 DEEP SIGHT DOODLES v12 - THEMATIC HIGH DENSITY
 * Doodles thématiques: analyse vidéo, études, clavier, IA
 *
 * ✨ v12:
 * - Densité augmentée (2x plus d'icônes)
 * - Opacité plus élevée pour meilleure visibilité
 * - Icônes thématiques Deep Sight (vidéo, études, clavier, graphiques)
 * - Taille de tile réduite pour plus de répétition
 */

import React, { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface DoodleBackgroundProps {
  density?: number;
  variant?: 'default' | 'analysis' | 'video' | 'academic';
}

// 🎬 VIDÉO & STREAMING
const ICONS_VIDEO = [
  // Play button
  "M5 3l14 9-14 9V3z",
  // Play circle
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4-6 4z",
  // Video camera
  "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
  // Film
  "M4 2v20h16V2H4zm2 2h2v2H6V4zm4 0h4v2h-4V4zm6 0h2v2h-2V4zM6 18h2v2H6v-2zm4 0h4v2h-4v-2zm6 0h2v2h-2v-2z",
  // TV/Screen
  "M2 4h20v12H2V4zm5 16h10m-5-4v4",
  // Pause
  "M6 4h4v16H6V4zm8 0h4v16h-4V4z",
  // YouTube
  "M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z",
  // Streaming waves
  "M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0",
];

// 📚 ÉTUDES & APPRENTISSAGE
const ICONS_STUDY = [
  // Book open
  "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3zm18 0h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z",
  // Graduation cap
  "M22 10l-10-5L2 10l10 5 10-5zM6 12v5c0 2 2.7 3 6 3s6-1 6-3v-5",
  // Pencil
  "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  // Document
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6",
  // Clipboard check
  "M9 2h6v4H9V2zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2m1 9l2 2 4-4",
  // Brain
  "M12 4c-2 0-3.5 1-4 2.5-.5-1-2-1.5-3-.5S3.5 8 4 9c-1 .5-1.5 2-.5 3s2 1.5 3 1c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5c1 .5 2 0 3-1s.5-2.5-.5-3c.5-1 0-2.5-1-3.5s-2.5 0-3 .5C15.5 5 14 4 12 4z",
  // Lightbulb
  "M9 18h6M10 22h4M12 2a6 6 0 0 0-6 6c0 2 1 3.5 2.5 5 .5.5 1 1.5 1 2.5V17h5v-1.5c0-1 .5-2 1-2.5 1.5-1.5 2.5-3 2.5-5a6 6 0 0 0-6-6z",
  // Bookmark
  "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
];

// ⌨️ CLAVIER & TECH
const ICONS_TECH = [
  // Keyboard
  "M2 6h20v12H2V6zm3 3h2v2H5V9zm4 0h2v2H9V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9zM5 13h14v2H5v-2z",
  // Monitor
  "M2 3h20v14H2V3zm5 18h10m-5-4v4",
  // Mouse
  "M12 2a5 5 0 0 0-5 5v10a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zm0 0v6",
  // Code
  "M16 18l6-6-6-6M8 6l-6 6 6 6",
  // Terminal
  "M4 17l6-6-6-6m8 14h8",
  // CPU
  "M6 6h12v12H6V6zM2 10h2m16 0h2M2 14h2m16 0h2M10 2v2m4-2v2M10 20v2m4-2v2",
  // Wifi
  "M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01",
  // Laptop
  "M2 18h20l-2-8H4l-2 8zM4 10V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5",
];

// 📊 GRAPHIQUES & ANALYSE
const ICONS_ANALYTICS = [
  // Bar chart
  "M18 20V10M12 20V4M6 20v-6",
  // Line chart
  "M3 3v18h18M7 14l4-4 4 4 5-6",
  // Pie chart
  "M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10h10z",
  // Trending up
  "M23 6l-9.5 9.5-5-5L1 18m22-12v6h-6",
  // Activity
  "M22 12h-4l-3 9L9 3l-3 9H2",
  // Target
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  // Layers
  "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  // Filter
  "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
];

// 🤖 IA & INTELLIGENCE
const ICONS_AI = [
  // Robot
  "M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z",
  // Sparkles/AI
  "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6",
  // Network
  "M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 7l5 5m5-5l-5 5",
  // Chat bot
  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10zm-9-7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  // Atom
  "M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 2c-4 0-7 4.5-7 10s3 10 7 10 7-4.5 7-10-3-10-7-10z",
  // Lightning/Fast
  "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  // Magic wand
  "M15 4l-4 4m6 6l4-4M5 19l14-14M21 3l-4 4 4-4zm-6 18l4-4-4 4zM3 21l4-4-4 4z",
  // Eye/Vision
  "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
];

// 🔍 RECHERCHE & EXPLORATION
const ICONS_SEARCH = [
  // Search/Magnifier
  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  // Compass
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z",
  // Globe
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  // Link
  "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  // Maximize/Fullscreen
  "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
  // Zoom in
  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM10 7v6m-3-3h6",
];

// ⭐ ÉTOILES ET ACCENTS
const ICONS_ACCENT = [
  // Star
  "M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6z",
  // Heart
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  // Hexagon
  "M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z",
  // Diamond
  "M12 2l10 10-10 10L2 12l10-10z",
  // Circle dot
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
];

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

const DoodleBackground: React.FC<DoodleBackgroundProps> = ({
  density = 100,
  variant = 'default'
}) => {
  const { isDark } = useTheme();

  // Palette de gris avec plus de contraste
  const grayPalette = isDark
    ? ['#9CA3AF', '#6B7280', '#D1D5DB', '#4B5563', '#E5E7EB']
    : ['#6B7280', '#9CA3AF', '#4B5563', '#D1D5DB', '#374151'];

  // Couleur accent violet Deep Sight
  const accentColor = isDark ? '#A78BFA' : '#8B5CF6';
  const accentColorSecondary = isDark ? '#C4B5FD' : '#7C3AED';

  // Combiner tous les icônes thématiques
  const ALL_ICONS = [
    ...ICONS_VIDEO,
    ...ICONS_STUDY,
    ...ICONS_TECH,
    ...ICONS_ANALYTICS,
    ...ICONS_AI,
    ...ICONS_SEARCH,
  ];

  // Créer un tile/pattern de doodles dense
  const tileDoodles = useMemo(() => {
    const items: Array<{
      id: number;
      path: string;
      x: number;
      y: number;
      rotation: number;
      scale: number;
      color: string;
      opacity: number;
      strokeWidth: number;
      fill: boolean;
    }> = [];

    const tileSize = 350; // Plus petit = plus de répétition

    // === COUCHE 1: Icônes accent très visibles (étoiles, formes) ===
    for (let i = 0; i < 8; i++) {
      const seed = 50 + i * 37;
      items.push({
        id: i,
        path: ICONS_ACCENT[Math.floor(seededRandom(seed) * ICONS_ACCENT.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: seededRandom(seed + 3) * 360,
        scale: 0.9 + seededRandom(seed + 4) * 0.6,
        color: seededRandom(seed + 5) > 0.5 ? accentColor : accentColorSecondary,
        opacity: isDark ? 0.18 : 0.22,
        strokeWidth: 1.8,
        fill: false,
      });
    }

    // === COUCHE 2: Vidéo (play, camera, etc.) - BEAUCOUP ===
    for (let i = 0; i < 25; i++) {
      const seed = 100 + i * 23;
      items.push({
        id: 100 + i,
        path: ICONS_VIDEO[Math.floor(seededRandom(seed) * ICONS_VIDEO.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: (seededRandom(seed + 3) - 0.5) * 30,
        scale: 0.65 + seededRandom(seed + 4) * 0.45,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 3)],
        opacity: isDark ? 0.15 : 0.18,
        strokeWidth: 1.6,
        fill: false,
      });
    }

    // === COUCHE 3: Études (livres, graduation, etc.) ===
    for (let i = 0; i < 25; i++) {
      const seed = 200 + i * 31;
      items.push({
        id: 200 + i,
        path: ICONS_STUDY[Math.floor(seededRandom(seed) * ICONS_STUDY.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: (seededRandom(seed + 3) - 0.5) * 25,
        scale: 0.6 + seededRandom(seed + 4) * 0.4,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 4)],
        opacity: isDark ? 0.14 : 0.17,
        strokeWidth: 1.5,
        fill: false,
      });
    }

    // === COUCHE 4: Tech (clavier, souris, code) ===
    for (let i = 0; i < 20; i++) {
      const seed = 300 + i * 17;
      items.push({
        id: 300 + i,
        path: ICONS_TECH[Math.floor(seededRandom(seed) * ICONS_TECH.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: (seededRandom(seed + 3) - 0.5) * 20,
        scale: 0.55 + seededRandom(seed + 4) * 0.4,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 3)],
        opacity: isDark ? 0.13 : 0.16,
        strokeWidth: 1.4,
        fill: false,
      });
    }

    // === COUCHE 5: Graphiques & Analytics ===
    for (let i = 0; i < 20; i++) {
      const seed = 400 + i * 41;
      items.push({
        id: 400 + i,
        path: ICONS_ANALYTICS[Math.floor(seededRandom(seed) * ICONS_ANALYTICS.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: (seededRandom(seed + 3) - 0.5) * 15,
        scale: 0.6 + seededRandom(seed + 4) * 0.35,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 4)],
        opacity: isDark ? 0.14 : 0.17,
        strokeWidth: 1.5,
        fill: false,
      });
    }

    // === COUCHE 6: IA & Intelligence ===
    for (let i = 0; i < 18; i++) {
      const seed = 500 + i * 29;
      // 30% avec couleur accent
      const useAccent = seededRandom(seed + 10) > 0.7;
      items.push({
        id: 500 + i,
        path: ICONS_AI[Math.floor(seededRandom(seed) * ICONS_AI.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: (seededRandom(seed + 3) - 0.5) * 35,
        scale: 0.6 + seededRandom(seed + 4) * 0.45,
        color: useAccent ? accentColor : grayPalette[Math.floor(seededRandom(seed + 5) * 3)],
        opacity: useAccent ? (isDark ? 0.20 : 0.24) : (isDark ? 0.14 : 0.17),
        strokeWidth: 1.6,
        fill: false,
      });
    }

    // === COUCHE 7: Recherche ===
    for (let i = 0; i < 15; i++) {
      const seed = 600 + i * 19;
      items.push({
        id: 600 + i,
        path: ICONS_SEARCH[Math.floor(seededRandom(seed) * ICONS_SEARCH.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: (seededRandom(seed + 3) - 0.5) * 25,
        scale: 0.55 + seededRandom(seed + 4) * 0.35,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 4)],
        opacity: isDark ? 0.13 : 0.16,
        strokeWidth: 1.4,
        fill: false,
      });
    }

    // === COUCHE 8: Petits points décoratifs ===
    for (let i = 0; i < 35; i++) {
      const seed = 700 + i * 13;
      const dotPath = "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z";
      items.push({
        id: 700 + i,
        path: dotPath,
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: 0,
        scale: 0.25 + seededRandom(seed + 3) * 0.35,
        color: seededRandom(seed + 6) > 0.8 ? accentColor : grayPalette[Math.floor(seededRandom(seed + 4) * grayPalette.length)],
        opacity: isDark ? 0.22 : 0.26,
        strokeWidth: 0,
        fill: true,
      });
    }

    // === COUCHE 9: Mini icônes supplémentaires (densité) ===
    for (let i = 0; i < 30; i++) {
      const seed = 800 + i * 47;
      items.push({
        id: 800 + i,
        path: ALL_ICONS[Math.floor(seededRandom(seed) * ALL_ICONS.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: seededRandom(seed + 3) * 360,
        scale: 0.35 + seededRandom(seed + 4) * 0.25,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * grayPalette.length)],
        opacity: isDark ? 0.10 : 0.12,
        strokeWidth: 1.2,
        fill: false,
      });
    }

    return items;
  }, [density, isDark, grayPalette, accentColor, accentColorSecondary, ALL_ICONS]);

  // Créer le SVG pattern en data URI
  const patternSvg = useMemo(() => {
    const paths = tileDoodles.map((d) => {
      return `<g transform="translate(${d.x}, ${d.y}) rotate(${d.rotation}) scale(${d.scale})" opacity="${d.opacity}">
        <path d="${d.path}" transform="translate(-12, -12)"
          fill="${d.fill ? d.color : 'none'}"
          stroke="${d.fill ? 'none' : d.color}"
          stroke-width="${d.strokeWidth}"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </g>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 350">${paths}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [tileDoodles]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: '100vh',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage: patternSvg,
        backgroundRepeat: 'repeat',
        backgroundSize: '350px 350px',
      }}
      aria-hidden="true"
    />
  );
};

export default DoodleBackground;
