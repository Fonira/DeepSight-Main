/**
 * MICRO DOODLE BACKGROUND — Extension Popup Variant
 *
 * Miniaturized version of the web app's DoodleBackground for 400×600px popup.
 * 2-layer system (back + front) optimized for small space with tight edge fading.
 *
 * Features:
 * - ~40-60 SVG icons per tile (vs web's ~200 in 500px tile)
 * - 200px tile size (vs web's 500px)
 * - Back layer: 0.04-0.06 opacity, Front layer: 0.08-0.12
 * - ~10% accent icons in brand violet (#9B6B4A / #C8903A)
 * - Themed variants: video, study, tech, AI, creative
 * - No external dependencies — pure React + inline SVG + CSS
 * - Performance: Uses CSS background-image with SVG data URIs
 */

import React, { useMemo } from 'react';
import { ALL_DOODLE_PATHS } from './doodles/doodlePaths';

type MicroVariant = 'video' | 'study' | 'tech' | 'AI' | 'creative' | 'default';

interface MicroDoodleBackgroundProps {
  variant?: MicroVariant;
  className?: string;
}

/**
 * Additional icon paths for extension (extends the 21 from doodlePaths.ts)
 * Adds missing ones from the web's full library
 */
const EXTRA_ICONS = [
  // Pause (from web VIDEO)
  'M6 4h4v16H6zm8 0h4v16h-4z',
  // Pause circles (from web ABSTRACT)
  'M8 7c0-2 1-3 2-3s2 1 2 3v10c0 2-1 3-2 3s-2-1-2-3V7zm6 0c0-2 1-3 2-3s2 1 2 3v10c0 2-1 3-2 3s-2-1-2-3V7z',
  // Bookmark (from web STUDY)
  'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z',
  // Trophy (from web STUDY)
  'M6 9H3V4h3m12 5h3V4h-3M12 15a6 6 0 006-6V3H6v6a6 6 0 006 6zm0 0v4m-4 2h8',
  // Notebook (from web STUDY)
  'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4a2 2 0 012-2h14v14H6.5A2.5 2.5 0 004 18.5z',
  // Flask (from web STUDY)
  'M10 2v6l-2 4h8l-2-4V2zm-2 12v2m8-2v2M8 22h8',
  // Quill (from web STUDY)
  'M3 21c3 0 7-1 7-8V5M14 5c0 6.5 4 8 7 8',
  // Clipboard (from web STUDY)
  'M9 2h6v4H9zM16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m1 9l2 2 4-4',
  // Eye (from web AI)
  'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8zm11-3a3 3 0 100 6 3 3 0 000-6z',
  // Chat (from web AI)
  'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  // Paper plane (from web AI)
  'M22 2L11 13m11-11l-7 20-4-9-9-4z',
  // Broadcast (from web AI)
  'M4.9 19.1C1 15.2 1 8.8 4.9 4.9m14.2 0c3.9 3.9 3.9 10.3 0 14.2M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4m8.4 0c2.3 2.3 2.3 6.1 0 8.4M12 12h.01',
  // Magic wand (from web AI)
  'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5',
  // Neural network (from web AI)
  'M5 5a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM7 7l5 5m5-5l-5 5m-5 5l5-5m5 5l-5-5',
  // Atom (from web AI)
  'M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 2c-5 0-8 5-8 10s3 10 8 10 8-5 8-10-3-10-8-10z',
  // Pencil (from web STUDY)
  'M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z',
  // Terminal (from web TECH)
  'M4 17l6-6-6-6m8 14h8',
  // Sliders (from web TECH)
  'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
];

/**
 * Variant-specific icon pools (40-50 icons per variant)
 */
const getVariantIcons = (variant: MicroVariant | string): string[] => {
  const v = (variant as MicroVariant) || 'default';
  const basePool = [...ALL_DOODLE_PATHS, ...EXTRA_ICONS];

  // Categorized icons from doodlePaths.ts (by name)
  const videoIcons = basePool.slice(0, 5); // play, camera, headphones, youtube, waveform
  const studyIcons = [
    basePool[5], basePool[6], basePool[7], basePool[8], // book, lightbulb, brain, graduation
    ...EXTRA_ICONS.slice(2, 8), // bookmark, trophy, notebook, flask, quill, clipboard
  ];
  const aiIcons = [
    basePool[9], basePool[10], basePool[11], basePool[12], basePool[13], // sparkles, lightning, robot, search, globe
    ...EXTRA_ICONS.slice(8, 16), // eye, chat, paper plane, broadcast, magic wand, neural network, atom
  ];
  const techIcons = [
    basePool[14], basePool[15], // code, shield
    ...EXTRA_ICONS.slice(17, 20), // terminal, sliders
  ];
  const creativeIcons = [
    basePool[16], basePool[17], basePool[18], basePool[19], basePool[20], // star, heart, sparkle 4pt, crown, diamond
  ];

  switch (v) {
    case 'video':
      return [...basePool, ...videoIcons, ...videoIcons, ...videoIcons];
    case 'study':
      return [...basePool, ...studyIcons, ...studyIcons, ...studyIcons];
    case 'tech':
      return [...basePool, ...techIcons, ...techIcons, ...techIcons];
    case 'AI':
      return [...basePool, ...aiIcons, ...aiIcons, ...aiIcons];
    case 'creative':
      return [...basePool, ...creativeIcons, ...creativeIcons, ...creativeIcons];
    default:
      return basePool;
  }
};

/**
 * Seeded random for deterministic, consistent placement per variant
 */
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

/**
 * SVG rendering helper — converts a path to SVG string with styling
 */
const renderIconSVG = (
  path: string,
  x: number,
  y: number,
  scale: number,
  rotation: number,
  color: string,
  opacity: number,
  strokeWidth: number,
  fill: boolean
): string => {
  const size = 24 * scale;
  const offsetX = x - size / 2;
  const offsetY = y - size / 2;
  const transform = `translate(${offsetX}, ${offsetY}) rotate(${rotation} ${size / 2} ${size / 2})`;

  const svgPath = fill
    ? `<path d="${path}" fill="${color}" opacity="${opacity}" />`
    : `<path d="${path}" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;

  return `
    <g transform="${transform}">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" overflow="visible">
        ${svgPath}
      </svg>
    </g>
  `;
};

/**
 * Generate tile SVG with icons placed via seeded random
 */
const generateTileSVG = (
  tileSize: number,
  variant: MicroVariant | string,
  isDark: boolean = true,
  layerOpacityFactor: number = 1.0
): string => {
  const icons = getVariantIcons(variant as MicroVariant);
  const accentPrimary = isDark ? '#C8903A' : '#9B6B4A';
  const accentSecondary = isDark ? '#9B6B4A' : '#C8903A';

  const neutralColors = isDark
    ? ['#A78BFA', '#818CF8', '#FBBF24', '#34D399', '#60A5FA', '#F87171', '#C084FC']
    : ['#8B5CF6', '#6366F1', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#A855F7'];

  const pickColor = (seed: number, forceAccent = false) => {
    if (forceAccent) {
      return seededRandom(seed) > 0.5 ? accentPrimary : accentSecondary;
    }
    return neutralColors[Math.floor(seededRandom(seed) * neutralColors.length)];
  };

  const pick = (pool: string[], seed: number) => pool[Math.floor(seededRandom(seed) * pool.length)];

  const pickRotation = (seed: number) => {
    const rotations = [0, 15, -15, 30, -30, 45, -45, 90, -90, 180];
    return rotations[Math.floor(seededRandom(seed) * rotations.length)];
  };

  let svgElements = '';
  const variantOffsets: Record<MicroVariant, number> = {
    video: 1000,
    study: 2000,
    tech: 3000,
    AI: 4000,
    creative: 5000,
    default: 0,
  };
  const variantOffset = variantOffsets[variant as MicroVariant] ?? 0;

  // Back layer: 25 items, large, low opacity
  for (let i = 0; i < 25; i++) {
    const seed = variantOffset + 100 + i * 37;
    const path = pick(icons, seed);
    const x = seededRandom(seed + 1) * tileSize;
    const y = seededRandom(seed + 2) * tileSize;
    const rotation = pickRotation(seed + 3);
    const scale = 0.8 + seededRandom(seed + 4) * 0.4;
    const opacity = (0.04 + seededRandom(seed + 5) * 0.02) * layerOpacityFactor;
    const color = pickColor(seed + 9);
    const strokeWidth = 1.2 + (seededRandom(seed + 10) - 0.5) * 0.6;

    svgElements += renderIconSVG(path, x, y, scale, rotation, color, opacity, strokeWidth, false);
  }

  // Front layer: 30 items, medium, higher opacity
  for (let i = 0; i < 30; i++) {
    const seed = variantOffset + 300 + i * 23;
    const path = pick(icons, seed);
    const x = seededRandom(seed + 1) * tileSize;
    const y = seededRandom(seed + 2) * tileSize;
    const rotation = pickRotation(seed + 3);
    const scale = 0.5 + seededRandom(seed + 4) * 0.3;
    const opacity = (0.08 + seededRandom(seed + 5) * 0.04) * layerOpacityFactor;
    const isAccent = seededRandom(seed + 6) < 0.1; // ~10% accent
    const color = pickColor(seed + 9, isAccent);
    const strokeWidth = 1.4 + (seededRandom(seed + 10) - 0.5) * 0.6;

    svgElements += renderIconSVG(path, x, y, scale, rotation, color, opacity, strokeWidth, false);
  }

  // Micro accent dots: 15 items, tiny filled circles, accent color
  for (let i = 0; i < 15; i++) {
    const seed = variantOffset + 600 + i * 41;
    const x = seededRandom(seed + 1) * tileSize;
    const y = seededRandom(seed + 2) * tileSize;
    const radius = 0.5 + seededRandom(seed + 3) * 1.5;
    const opacity = (0.10 + seededRandom(seed + 4) * 0.05) * layerOpacityFactor;
    const color = seededRandom(seed + 5) > 0.5 ? accentPrimary : accentSecondary;

    svgElements += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" opacity="${opacity}" />`;
  }

  return `
    <svg width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      <defs>
        <mask id="tileEdgeFade">
          <rect width="${tileSize}" height="${tileSize}" fill="white" />
          <radialGradient id="edgeFadeGrad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="white" />
            <stop offset="100%" stop-color="black" />
          </radialGradient>
          <circle cx="${tileSize / 2}" cy="${tileSize / 2}" r="${tileSize * 0.55}" fill="url(#edgeFadeGrad)" />
        </mask>
      </defs>
      <g mask="url(#tileEdgeFade)">
        ${svgElements}
      </g>
    </svg>
  `;
};

/**
 * Convert SVG to data URI for CSS background-image
 */
const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
};

/**
 * Main Component
 */
const MicroDoodleBackground: React.FC<MicroDoodleBackgroundProps> = ({
  variant = 'default',
  className = '',
}) => {
  const TILE_SIZE = 200;

  // Memoize SVG generation per variant (expensive operation)
  const backgroundDataUri = useMemo(() => {
    const tileGradientSvg = generateTileSVG(TILE_SIZE, variant, true, 1.0);
    return svgToDataUri(tileGradientSvg);
  }, [variant]);

  // Memoize the combined style
  const backgroundStyle: React.CSSProperties = useMemo(
    () => ({
      backgroundImage: `url("${backgroundDataUri}")`,
      backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
      backgroundRepeat: 'repeat',
      backgroundAttachment: 'fixed',
    }),
    [backgroundDataUri]
  );

  return (
    <div
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{
        ...backgroundStyle,
        zIndex: -1,
      }}
      aria-hidden="true"
    />
  );
};

export default MicroDoodleBackground;
