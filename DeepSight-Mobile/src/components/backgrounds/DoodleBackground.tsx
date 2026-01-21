/**
 * DoodleBackground - Fond décoratif avec icônes thématiques
 * Port React Native du composant web DeepSight
 *
 * Utilise react-native-svg pour afficher un pattern répétitif
 * d'icônes liées à l'analyse vidéo, l'IA et l'apprentissage
 */

import React, { useMemo } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Svg, { G, Path, Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

// ============================================
// ICON PATHS - Thématiques DeepSight
// ============================================

// Video & Streaming
const ICONS_VIDEO = [
  "M5 3l14 9-14 9V3z", // Play
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4-6 4z", // Play circle
  "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z", // Camera
  "M4 2v20h16V2H4zm2 2h2v2H6V4zm4 0h4v2h-4V4zm6 0h2v2h-2V4zM6 18h2v2H6v-2zm4 0h4v2h-4v-2zm6 0h2v2h-2v-2z", // Film
  "M2 4h20v12H2V4zm5 16h10m-5-4v4", // TV
  "M6 4h4v16H6V4zm8 0h4v16h-4V4z", // Pause
];

// Study & Learning
const ICONS_STUDY = [
  "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3zm18 0h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z", // Book
  "M22 10l-10-5L2 10l10 5 10-5zM6 12v5c0 2 2.7 3 6 3s6-1 6-3v-5", // Graduation
  "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z", // Pencil
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6", // Document
  "M12 4c-2 0-3.5 1-4 2.5-.5-1-2-1.5-3-.5S3.5 8 4 9c-1 .5-1.5 2-.5 3s2 1.5 3 1c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5c1 .5 2 0 3-1s.5-2.5-.5-3c.5-1 0-2.5-1-3.5s-2.5 0-3 .5C15.5 5 14 4 12 4z", // Brain
  "M9 18h6M10 22h4M12 2a6 6 0 0 0-6 6c0 2 1 3.5 2.5 5 .5.5 1 1.5 1 2.5V17h5v-1.5c0-1 .5-2 1-2.5 1.5-1.5 2.5-3 2.5-5a6 6 0 0 0-6-6z", // Lightbulb
];

// Tech & Code
const ICONS_TECH = [
  "M2 6h20v12H2V6zm3 3h2v2H5V9zm4 0h2v2H9V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9zM5 13h14v2H5v-2z", // Keyboard
  "M2 3h20v14H2V3zm5 18h10m-5-4v4", // Monitor
  "M16 18l6-6-6-6M8 6l-6 6 6 6", // Code
  "M4 17l6-6-6-6m8 14h8", // Terminal
  "M6 6h12v12H6V6zM2 10h2m16 0h2M2 14h2m16 0h2M10 2v2m4-2v2M10 20v2m4-2v2", // CPU
];

// Analytics & Charts
const ICONS_ANALYTICS = [
  "M18 20V10M12 20V4M6 20v-6", // Bar chart
  "M3 3v18h18M7 14l4-4 4 4 5-6", // Line chart
  "M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10h10z", // Pie chart
  "M23 6l-9.5 9.5-5-5L1 18m22-12v6h-6", // Trending up
  "M22 12h-4l-3 9L9 3l-3 9H2", // Activity
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", // Target
];

// AI & Intelligence
const ICONS_AI = [
  "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6", // Sparkles
  "M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 7l5 5m5-5l-5 5", // Network
  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10zm-9-7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", // Chat bot
  "M13 2L3 14h9l-1 8 10-12h-9l1-8z", // Lightning
  "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", // Eye
];

// Search & Exploration
const ICONS_SEARCH = [
  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z", // Search
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z", // Compass
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z", // Globe
];

// Accent shapes
const ICONS_ACCENT = [
  "M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6z", // Star
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z", // Heart
  "M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z", // Hexagon
  "M12 2l10 10-10 10L2 12l10-10z", // Diamond
];

// ============================================
// HELPER FUNCTIONS
// ============================================

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

interface DoodleItem {
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
}

// ============================================
// COMPONENT
// ============================================

interface DoodleBackgroundProps {
  density?: 'low' | 'medium' | 'high';
}

export const DoodleBackground: React.FC<DoodleBackgroundProps> = ({
  density = 'medium',
}) => {
  const { isDark } = useTheme();
  const { width, height } = Dimensions.get('window');

  // Color palettes
  const grayPalette = isDark
    ? ['#9CA3AF', '#6B7280', '#D1D5DB', '#4B5563', '#E5E7EB']
    : ['#6B7280', '#9CA3AF', '#4B5563', '#D1D5DB', '#374151'];

  const accentColor = isDark ? '#A78BFA' : '#8B5CF6';
  const accentColorSecondary = isDark ? '#C4B5FD' : '#7C3AED';

  // Density multiplier
  const densityMultiplier = density === 'low' ? 0.5 : density === 'high' ? 1.5 : 1;

  const TILE_SIZE = 350;

  // Generate doodles with seeded random positions
  const doodles = useMemo(() => {
    const items: DoodleItem[] = [];
    const ALL_ICONS = [...ICONS_VIDEO, ...ICONS_STUDY, ...ICONS_TECH, ...ICONS_ANALYTICS, ...ICONS_AI, ...ICONS_SEARCH];

    // Layer 1: Accent icons (stars, hearts)
    const accentCount = Math.floor(6 * densityMultiplier);
    for (let i = 0; i < accentCount; i++) {
      const seed = 50 + i * 37;
      items.push({
        id: i,
        path: ICONS_ACCENT[Math.floor(seededRandom(seed) * ICONS_ACCENT.length)],
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: seededRandom(seed + 3) * 360,
        scale: 0.9 + seededRandom(seed + 4) * 0.5,
        color: seededRandom(seed + 5) > 0.5 ? accentColor : accentColorSecondary,
        opacity: isDark ? 0.15 : 0.18,
        strokeWidth: 1.8,
        fill: false,
      });
    }

    // Layer 2: Video icons
    const videoCount = Math.floor(15 * densityMultiplier);
    for (let i = 0; i < videoCount; i++) {
      const seed = 100 + i * 23;
      items.push({
        id: 100 + i,
        path: ICONS_VIDEO[Math.floor(seededRandom(seed) * ICONS_VIDEO.length)],
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: (seededRandom(seed + 3) - 0.5) * 30,
        scale: 0.6 + seededRandom(seed + 4) * 0.4,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 3)],
        opacity: isDark ? 0.12 : 0.15,
        strokeWidth: 1.5,
        fill: false,
      });
    }

    // Layer 3: Study icons
    const studyCount = Math.floor(15 * densityMultiplier);
    for (let i = 0; i < studyCount; i++) {
      const seed = 200 + i * 31;
      items.push({
        id: 200 + i,
        path: ICONS_STUDY[Math.floor(seededRandom(seed) * ICONS_STUDY.length)],
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: (seededRandom(seed + 3) - 0.5) * 25,
        scale: 0.55 + seededRandom(seed + 4) * 0.35,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 4)],
        opacity: isDark ? 0.11 : 0.14,
        strokeWidth: 1.4,
        fill: false,
      });
    }

    // Layer 4: Tech icons
    const techCount = Math.floor(12 * densityMultiplier);
    for (let i = 0; i < techCount; i++) {
      const seed = 300 + i * 17;
      items.push({
        id: 300 + i,
        path: ICONS_TECH[Math.floor(seededRandom(seed) * ICONS_TECH.length)],
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: (seededRandom(seed + 3) - 0.5) * 20,
        scale: 0.5 + seededRandom(seed + 4) * 0.35,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 3)],
        opacity: isDark ? 0.10 : 0.13,
        strokeWidth: 1.3,
        fill: false,
      });
    }

    // Layer 5: Analytics icons
    const analyticsCount = Math.floor(12 * densityMultiplier);
    for (let i = 0; i < analyticsCount; i++) {
      const seed = 400 + i * 41;
      items.push({
        id: 400 + i,
        path: ICONS_ANALYTICS[Math.floor(seededRandom(seed) * ICONS_ANALYTICS.length)],
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: (seededRandom(seed + 3) - 0.5) * 15,
        scale: 0.55 + seededRandom(seed + 4) * 0.3,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 4)],
        opacity: isDark ? 0.11 : 0.14,
        strokeWidth: 1.4,
        fill: false,
      });
    }

    // Layer 6: AI icons (some with accent color)
    const aiCount = Math.floor(10 * densityMultiplier);
    for (let i = 0; i < aiCount; i++) {
      const seed = 500 + i * 29;
      const useAccent = seededRandom(seed + 10) > 0.7;
      items.push({
        id: 500 + i,
        path: ICONS_AI[Math.floor(seededRandom(seed) * ICONS_AI.length)],
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: (seededRandom(seed + 3) - 0.5) * 35,
        scale: 0.55 + seededRandom(seed + 4) * 0.4,
        color: useAccent ? accentColor : grayPalette[Math.floor(seededRandom(seed + 5) * 3)],
        opacity: useAccent ? (isDark ? 0.16 : 0.20) : (isDark ? 0.11 : 0.14),
        strokeWidth: 1.5,
        fill: false,
      });
    }

    // Layer 7: Search icons
    const searchCount = Math.floor(8 * densityMultiplier);
    for (let i = 0; i < searchCount; i++) {
      const seed = 600 + i * 19;
      items.push({
        id: 600 + i,
        path: ICONS_SEARCH[Math.floor(seededRandom(seed) * ICONS_SEARCH.length)],
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: (seededRandom(seed + 3) - 0.5) * 25,
        scale: 0.5 + seededRandom(seed + 4) * 0.3,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * 4)],
        opacity: isDark ? 0.10 : 0.13,
        strokeWidth: 1.3,
        fill: false,
      });
    }

    // Layer 8: Decorative dots
    const dotCount = Math.floor(20 * densityMultiplier);
    for (let i = 0; i < dotCount; i++) {
      const seed = 700 + i * 13;
      const dotPath = "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z";
      items.push({
        id: 700 + i,
        path: dotPath,
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: 0,
        scale: 0.3 + seededRandom(seed + 3) * 0.4,
        color: seededRandom(seed + 6) > 0.85 ? accentColor : grayPalette[Math.floor(seededRandom(seed + 4) * grayPalette.length)],
        opacity: isDark ? 0.18 : 0.22,
        strokeWidth: 0,
        fill: true,
      });
    }

    // Layer 9: Mini icons for extra density
    const miniCount = Math.floor(15 * densityMultiplier);
    for (let i = 0; i < miniCount; i++) {
      const seed = 800 + i * 47;
      items.push({
        id: 800 + i,
        path: ALL_ICONS[Math.floor(seededRandom(seed) * ALL_ICONS.length)],
        x: seededRandom(seed + 1) * TILE_SIZE,
        y: seededRandom(seed + 2) * TILE_SIZE,
        rotation: seededRandom(seed + 3) * 360,
        scale: 0.3 + seededRandom(seed + 4) * 0.2,
        color: grayPalette[Math.floor(seededRandom(seed + 5) * grayPalette.length)],
        opacity: isDark ? 0.08 : 0.10,
        strokeWidth: 1.1,
        fill: false,
      });
    }

    return items;
  }, [isDark, densityMultiplier, grayPalette, accentColor, accentColorSecondary]);

  // Calculate number of tiles needed to cover screen
  const tilesX = Math.ceil(width / TILE_SIZE) + 1;
  const tilesY = Math.ceil(height / TILE_SIZE) + 1;

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={tilesX * TILE_SIZE} height={tilesY * TILE_SIZE}>
        <Defs>
          <Pattern
            id="doodlePattern"
            width={TILE_SIZE}
            height={TILE_SIZE}
            patternUnits="userSpaceOnUse"
          >
            {doodles.map((d) => (
              <G
                key={d.id}
                transform={`translate(${d.x}, ${d.y}) rotate(${d.rotation}) scale(${d.scale})`}
                opacity={d.opacity}
              >
                <Path
                  d={d.path}
                  transform="translate(-12, -12)"
                  fill={d.fill ? d.color : 'none'}
                  stroke={d.fill ? 'none' : d.color}
                  strokeWidth={d.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            ))}
          </Pattern>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={tilesX * TILE_SIZE}
          height={tilesY * TILE_SIZE}
          fill="url(#doodlePattern)"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});

export default DoodleBackground;
