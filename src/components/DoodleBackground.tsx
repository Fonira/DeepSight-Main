/**
 * 🎨 DEEP SIGHT DOODLES v11 - ENHANCED GRAYSCALE
 * Doodles complexifiés avec nuances de gris et effets visuels
 *
 * ✨ v11:
 * - Nuances de gris multiples (3 niveaux)
 * - Icônes plus détaillées et variées
 * - Effets de profondeur avec tailles variables
 * - Opacités différentes pour effet de perspective
 * - Formes géométriques additionnelles
 */

import React, { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface DoodleBackgroundProps {
  density?: number;
  variant?: 'default' | 'analysis' | 'video' | 'academic';
}

// Icônes principales (tech, vidéo, analyse)
const ICONS_PRIMARY = [
  // Play / Video
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4-6 4z",
  "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm8 2v8l6-4-6-4z",
  "M5 3l14 9-14 9V3z",
  // Robot / AI
  "M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  // Brain
  "M12 4c-2 0-3.5 1-4 2.5-.5-1-2-1.5-3-.5S3.5 8 4 9c-1 .5-1.5 2-.5 3s2 1.5 3 1c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5c1 .5 2 0 3-1s.5-2.5-.5-3c.5-1 0-2.5-1-3.5s-2.5 0-3 .5C15.5 5 14 4 12 4z",
  // Chat
  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z",
  // Chart
  "M18 20V10M12 20V4M6 20v-6",
  "M3 3v18h18M7 14l4-4 4 4 5-6",
  // Lightbulb
  "M9 18h6M10 22h4M12 2a6 6 0 0 0-6 6c0 2 1 3.5 2.5 5 .5.5 1 1.5 1 2.5V17h5v-1.5c0-1 .5-2 1-2.5 1.5-1.5 2.5-3 2.5-5a6 6 0 0 0-6-6z",
  // Star
  "M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6z",
];

// Icônes secondaires (documents, outils)
const ICONS_SECONDARY = [
  // Book
  "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3zm18 0h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z",
  // Document
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6",
  // Code
  "M16 18l6-6-6-6M8 6l-6 6 6 6",
  // Clipboard
  "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9V2z",
  // Pen
  "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  // Clock
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4v6l4 2",
  // Search
  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  // Screen
  "M2 4h20v12H2V4zm5 16h10m-5-4v4",
  // Flask
  "M9 3h6m-5 0v6l-5 9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1l-5-9V3",
];

// Formes géométriques abstraites
const ICONS_GEOMETRIC = [
  // Hexagon
  "M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z",
  // Diamond
  "M12 2l10 10-10 10L2 12l10-10z",
  // Triangle
  "M12 2L2 20h20L12 2z",
  // Circle with dot
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  // Grid
  "M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z",
  // Circles connected
  "M5.5 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm13 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm-6.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 8l4 5m4-5l-4 5",
  // Atom
  "M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 2c-4 0-7 4.5-7 10s3 10 7 10 7-4.5 7-10-3-10-7-10zM2 12c0-4 4.5-7 10-7s10 3 10 7-4.5 7-10 7-10-3-10-7z",
  // Infinity
  "M5 12c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3-3-1.3-3-3zm11 0c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3-3-1.3-3-3zM8 12h8",
  // Wave
  "M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0",
  // Nodes
  "M6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 8l4 6m4-6l-4 6",
];

// Icônes tertiaires (détails fins)
const ICONS_TERTIARY = [
  // Sparkle
  "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6",
  // Lightning
  "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  // Signal
  "M22 12h-4l-3 9L9 3l-3 9H2",
  // Pie
  "M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10h10z",
  // Network
  "M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 7l5 5m5-5l-5 5",
  // Flag
  "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  // Menu
  "M4 6h16M4 12h16M4 18h7",
  // Layers
  "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
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

  // Palette de gris pour le mode sombre
  const grayPalette = isDark
    ? ['#6B7280', '#9CA3AF', '#4B5563', '#374151', '#D1D5DB'] // Gris variés dark
    : ['#9CA3AF', '#6B7280', '#D1D5DB', '#4B5563', '#E5E7EB']; // Gris variés light

  // Couleur accent subtile
  const accentColor = isDark ? '#8B5CF6' : '#7C3AED';

  // Créer un tile/pattern de doodles complexe
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
    }> = [];

    const cols = 10;
    const rows = 10;
    const tileSize = 500; // Plus grand pour plus de détails
    const cellW = tileSize / cols;
    const cellH = tileSize / rows;

    // Couche 1: Formes géométriques en arrière-plan (très subtiles)
    for (let i = 0; i < 15; i++) {
      const seed = 100 + i * 23;
      items.push({
        id: i,
        path: ICONS_GEOMETRIC[Math.floor(seededRandom(seed) * ICONS_GEOMETRIC.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: seededRandom(seed + 3) * 360,
        scale: 1.2 + seededRandom(seed + 4) * 0.8,
        color: grayPalette[4], // Gris le plus clair
        opacity: isDark ? 0.04 : 0.06,
        strokeWidth: 1.2,
      });
    }

    // Couche 2: Icônes tertiaires (petites, subtiles)
    for (let i = 0; i < 25; i++) {
      const seed = 200 + i * 31;
      items.push({
        id: 100 + i,
        path: ICONS_TERTIARY[Math.floor(seededRandom(seed) * ICONS_TERTIARY.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: (seededRandom(seed + 3) - 0.5) * 60,
        scale: 0.5 + seededRandom(seed + 4) * 0.3,
        color: grayPalette[3],
        opacity: isDark ? 0.06 : 0.08,
        strokeWidth: 1.0,
      });
    }

    // Couche 3: Icônes secondaires (taille moyenne)
    for (let i = 0; i < 30; i++) {
      const seed = 300 + i * 17;
      const col = i % cols;
      const row = Math.floor(i / cols) % rows;

      items.push({
        id: 200 + i,
        path: ICONS_SECONDARY[Math.floor(seededRandom(seed) * ICONS_SECONDARY.length)],
        x: col * cellW + cellW / 2 + (seededRandom(seed + 1) - 0.5) * 30,
        y: row * cellH + cellH / 2 + (seededRandom(seed + 2) - 0.5) * 30,
        rotation: (seededRandom(seed + 3) - 0.5) * 45,
        scale: 0.6 + seededRandom(seed + 4) * 0.4,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 3)],
        opacity: isDark ? 0.08 : 0.10,
        strokeWidth: 1.5,
      });
    }

    // Couche 4: Icônes principales (plus visibles)
    for (let i = 0; i < 20; i++) {
      const seed = 400 + i * 41;

      // Certaines icônes avec couleur accent
      const useAccent = seededRandom(seed + 10) > 0.85;

      items.push({
        id: 300 + i,
        path: ICONS_PRIMARY[Math.floor(seededRandom(seed) * ICONS_PRIMARY.length)],
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: (seededRandom(seed + 3) - 0.5) * 40,
        scale: 0.7 + seededRandom(seed + 4) * 0.5,
        color: useAccent ? accentColor : grayPalette[Math.floor(seededRandom(seed + 5) * 3)],
        opacity: useAccent ? (isDark ? 0.12 : 0.15) : (isDark ? 0.10 : 0.12),
        strokeWidth: 1.8,
      });
    }

    // Couche 5: Points et petits détails
    for (let i = 0; i < 40; i++) {
      const seed = 500 + i * 13;
      const dotPath = "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z";

      items.push({
        id: 400 + i,
        path: dotPath,
        x: seededRandom(seed + 1) * tileSize,
        y: seededRandom(seed + 2) * tileSize,
        rotation: 0,
        scale: 0.3 + seededRandom(seed + 3) * 0.4,
        color: grayPalette[Math.floor(seededRandom(seed + 4) * grayPalette.length)],
        opacity: isDark ? 0.15 : 0.18,
        strokeWidth: 0,
      });
    }

    return items;
  }, [density, isDark, grayPalette, accentColor]);

  // Créer le SVG pattern en data URI
  const patternSvg = useMemo(() => {
    const paths = tileDoodles.map((d) => {
      const isFilled = d.strokeWidth === 0;
      return `<g transform="translate(${d.x}, ${d.y}) rotate(${d.rotation}) scale(${d.scale})" opacity="${d.opacity}">
        <path d="${d.path}" transform="translate(-12, -12)"
          fill="${isFilled ? d.color : 'none'}"
          stroke="${isFilled ? 'none' : d.color}"
          stroke-width="${d.strokeWidth}"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </g>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">${paths}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [tileDoodles]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage: patternSvg,
        backgroundRepeat: 'repeat',
        backgroundSize: '500px 500px',
      }}
      aria-hidden="true"
    />
  );
};

export default DoodleBackground;
