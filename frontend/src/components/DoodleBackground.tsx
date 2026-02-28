/**
 * DEEP SIGHT DOODLES v13 — PREMIUM THEMED BACKGROUNDS
 *
 * Dense, creative, multi-layered doodle backgrounds with per-page themes.
 *
 * ✨ v13 Highlights:
 * - 53 unique SVG icon paths (Lucide-style, optimized for small render)
 * - 6 themed variants: default, video, academic, analysis, tech, creative
 * - 3-layer depth system (back, mid, front) + accent + micro + dots
 * - Radial gradient mask for premium edge fading
 * - Brand violet accent highlights on ~10% of icons
 * - 500px tile with ~150 elements for dense coverage
 * - Grid-jitter placement for even distribution
 */

import React, { useMemo, useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// ─── Types ──────────────────────────────────────────────────────────────────

type DoodleVariant = 'default' | 'video' | 'academic' | 'analysis' | 'tech' | 'creative';

interface DoodleBackgroundProps {
  variant?: DoodleVariant;
  className?: string;
}

// ─── SVG Icon Paths (24×24 viewBox, stroke-based) ──────────────────────────

const ICONS_VIDEO = [
  'M5 3l14 9-14 9V3z',                                     // Play
  'M6 4h4v16H6zm8 0h4v16h-4z',                             // Pause
  'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z', // Camera
  'M2 4h20v12H2zm5 16h10m-5-4v4',                          // TV
  'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14V8l6 4-6 4z', // Play circle
  'M3 18v-6a9 9 0 0118 0v6',                               // Headphones
  'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0',                    // Waveform
  'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2', // Mic
  'M22.54 6.42A2.78 2.78 0 0020.6 4.42C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z', // YouTube
  'M4 2v20h16V2zm2 2h2v2H6zm4 0h4v2h-4zm6 0h2v2h-2zM6 18h2v2H6zm4 0h4v2h-4zm6 0h2v2h-2z', // Film strip
  'M15 3l6 6-6 6M9 21l-6-6 6-6',                          // Fast forward/rewind
  'M12 2v4m0 12v4M2 12h4m12 0h4',                         // Record crosshair
];

const ICONS_STUDY = [
  'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z', // Book
  'M22 10l-10-5L2 10l10 5zm-16 2v5c0 2 2.7 3 6 3s6-1 6-3v-5', // Graduation
  'M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z',       // Pencil
  'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zm0 0v6h6', // Document
  'M9 18h6M10 22h4M12 2a6 6 0 00-6 6c0 2 1 3.5 2.5 5 .5.5 1 1.5 1 2.5V17h5v-1.5c0-1 .5-2 1-2.5 1.5-1.5 2.5-3 2.5-5a6 6 0 00-6-6z', // Lightbulb
  'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z',        // Bookmark
  'M10 2v6l-2 4h8l-2-4V2zm-2 12v2m8-2v2M8 22h8',          // Flask
  'M3 21c3 0 7-1 7-8V5M14 5c0 6.5 4 8 7 8',               // Quill
  'M9 2h6v4H9zM16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m1 9l2 2 4-4', // Clipboard
  'M12 4c-2 0-3.5 1-4 2.5-.5-1-2-1.5-3-.5S3.5 8 4 9c-1 .5-1.5 2-.5 3s2 1.5 3 1c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5c1 .5 2 0 3-1s.5-2.5-.5-3c.5-1 0-2.5-1-3.5s-2.5 0-3 .5C15.5 5 14 4 12 4z', // Brain
  'M6 9H3V4h3m12 5h3V4h-3M12 15a6 6 0 006-6V3H6v6a6 6 0 006 6zm0 0v4m-4 2h8', // Trophy
  'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4a2 2 0 012-2h14v14H6.5A2.5 2.5 0 004 18.5z', // Notebook
];

const ICONS_TECH = [
  'M16 18l6-6-6-6M8 6l-6 6 6 6',                           // Code
  'M4 17l6-6-6-6m8 14h8',                                  // Terminal
  'M6 6h12v12H6zM2 10h2m16 0h2M2 14h2m16 0h2M10 2v2m4-2v2M10 20v2m4-2v2', // CPU
  'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', // Sliders
  'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01', // Wifi
  'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',  // Shield check
  'M2 18h20l-2-8H4zm2-8V5a2 2 0 012-2h12a2 2 0 012 2v5',  // Laptop
  'M16 5H8a6 6 0 000 12h8a6 6 0 000-12zm0 8a2 2 0 100-4 2 2 0 000 4z', // Toggle
  'M12 2a5 5 0 00-5 5v10a5 5 0 0010 0V7a5 5 0 00-5-5zm0 0v6', // Mouse
  'M2 6h20v12H2zm3 3h2v2H5zm4 0h2v2H9zm4 0h2v2h-2zm4 0h2v2h-2zM5 13h14v2H5z', // Keyboard
  'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0', // Bell
  'M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z',       // Feather pen
];

const ICONS_ANALYTICS = [
  'M18 20V10M12 20V4M6 20v-6',                             // Bar chart
  'M3 3v18h18M7 14l4-4 4 4 5-6',                           // Line chart
  'M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z', // Pie chart
  'M23 6l-9.5 9.5-5-5L1 18m22-12v6h-6',                   // Trending up
  'M22 12h-4l-3 9L9 3l-3 9H2',                             // Activity
  'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z', // Target
  'M12 2L2 7l10 5 10-5zm-10 10l10 5 10-5M2 12l10 5 10-5', // Layers
  'M22 3H2l8 9.46V19l4 2v-8.54z',                          // Filter
  'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',   // Grid
  'M12 20V10M6 20V4M18 20v-6',                             // Bar chart alt
  'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12zM12 2a10 10 0 100 20 10 10 0 000-20z', // Compass
  'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71', // Link chain
];

const ICONS_AI = [
  'M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6', // Sparkles
  'M13 2L3 14h9l-1 8 10-12h-9z',                           // Lightning
  'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8zm11-3a3 3 0 100 6 3 3 0 000-6z', // Eye
  'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', // Chat
  'M22 2L11 13m11-11l-7 20-4-9-9-4z',                      // Paper plane
  'M4.9 19.1C1 15.2 1 8.8 4.9 4.9m14.2 0c3.9 3.9 3.9 10.3 0 14.2M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4m8.4 0c2.3 2.3 2.3 6.1 0 8.4M12 12h.01', // Broadcast
  'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z', // Globe
  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',          // Search
  'M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z', // Robot
  'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5', // Magic wand
  'M5 5a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM7 7l5 5m5-5l-5 5m-5 5l5-5m5 5l-5-5', // Neural network
  'M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 2c-5 0-8 5-8 10s3 10 8 10 8-5 8-10-3-10-8-10z', // Atom
];

const ICONS_CREATIVE = [
  'M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6z', // Star
  'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z', // Heart
  'M12 2l8.5 5v10L12 22l-8.5-5V7z',                       // Hexagon
  'M12 2l10 10-10 10L2 12z',                               // Diamond
  'M2 17l3-7 4 4 3-9 3 9 4-4 3 7z',                       // Crown
  'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',            // Cloud
  'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z', // Music
  'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z', // Sparkle 4pt
  'M12 3c-4.97 0-9 3.18-9 7.11 0 1.73.68 3.33 1.83 4.6L3 21l4.25-1.99C8.86 19.65 10.39 20 12 20c4.97 0 9-3.18 9-7.11 0-3.93-4.03-6.89-9-6.89z', // Thought bubble
  'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',          // Shield
  'M2 3l20 18M20 16.58A22.07 22.07 0 0012 2c-2.72 0-5.3.59-7.59 1.63M2 12c1.64-4.15 5.56-7.1 10.2-7.1M22 12c-.73 1.85-2 3.46-3.6 4.7', // Eye slash (complex)
  'M4.5 16.5c-1.5 1.38-3 1.38-3 1.38s-.38-1.5 1.12-3 3.63-2.38 5.38-3.88c0 0 1.5 1.5-.38 3S6 15.12 4.5 16.5zM14.5 4c1.2-1.2 3.4-1.18 4.6 0 1.2 1.2 1.2 3.4 0 4.6l-9.2 9.2-6 1.4 1.4-6z', // Quill pen (complex)
];

// Complex abstract & geometric shapes
const ICONS_ABSTRACT = [
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z', // Avatar circle
  'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', // 3D layers
  'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', // 3D box
  'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 6v6l4 2', // Clock
  'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94z', // Wrench
  'M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z', // Info circle
  'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3', // Focus frame
  'M2 12c2-4 5-7 10-7s8 3 10 7c-2 4-5 7-10 7s-8-3-10-7zm10-3a3 3 0 110 6 3 3 0 010-6z', // Eye alt
  'M3 12h4l3-9 4 18 3-9h4',                               // Heartbeat ECG
  'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.83-.13 2.68-.36A6.92 6.92 0 0012 15a7 7 0 017-7c0-.65-.09-1.28-.26-1.88C17.33 3.55 14.87 2 12 2z', // Moon
  'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', // Users
  'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42', // Sun rays
];

// Small decorative fills
const SHAPES_DECORATIVE = [
  'M12 10a2 2 0 100 4 2 2 0 000-4z',                       // Dot
  'M12 5v14M5 12h14',                                      // Cross
  'M18 6L6 18M6 6l12 12',                                  // X mark
  'M12 8a4 4 0 100 8 4 4 0 000-8z',                        // Ring
  'M12 6l6 10H6z',                                         // Small triangle
  'M12 2l3 6 6 1-4 4 1 7-6-3-6 3 1-7-4-4 6-1z',          // Star small
  'M2 12l5-5 5 5 5-5 5 5',                                // Zigzag
  'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',   // 4 squares
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

/** Build a weighted icon pool where the variant's theme appears 4× more often */
const getIconPool = (variant: DoodleVariant): string[] => {
  const all = [
    ...ICONS_VIDEO, ...ICONS_STUDY, ...ICONS_TECH,
    ...ICONS_ANALYTICS, ...ICONS_AI, ...ICONS_CREATIVE, ...ICONS_ABSTRACT,
  ];

  const emphasis: Record<DoodleVariant, string[]> = {
    default: [...ICONS_ABSTRACT, ...ICONS_ABSTRACT],
    video: [...ICONS_VIDEO, ...ICONS_VIDEO, ...ICONS_VIDEO],
    academic: [...ICONS_STUDY, ...ICONS_STUDY, ...ICONS_STUDY],
    analysis: [...ICONS_ANALYTICS, ...ICONS_ANALYTICS, ...ICONS_ANALYTICS],
    tech: [...ICONS_TECH, ...ICONS_TECH, ...ICONS_TECH, ...ICONS_ABSTRACT],
    creative: [...ICONS_CREATIVE, ...ICONS_CREATIVE, ...ICONS_CREATIVE, ...ICONS_ABSTRACT],
  };

  return [...all, ...emphasis[variant]];
};

// Fixed rotation angles for controlled, intentional feel
const ROTATIONS = [0, 12, -12, 25, -25, 40, -40, 55, -55, 70, -70, 90, -90, 135, -135, 180];

// ─── Component ──────────────────────────────────────────────────────────────

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

const TILE = 500;

const DoodleBackground: React.FC<DoodleBackgroundProps> = ({
  variant = 'default',
  className,
}) => {
  const { isDark } = useTheme();

  // 📱 Désactiver sur mobile (< 1024px) et pour prefers-reduced-motion
  const [isMobileOrReduced, setIsMobileOrReduced] = useState(false);
  useEffect(() => {
    const checkShouldDisable = () => {
      const isMobile = window.innerWidth < 1024;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setIsMobileOrReduced(isMobile || prefersReduced);
    };
    checkShouldDisable();
    window.addEventListener('resize', checkShouldDisable);
    return () => window.removeEventListener('resize', checkShouldDisable);
  }, []);

  if (isMobileOrReduced) return null;

  const accentPrimary = isDark ? '#A78BFA' : '#8B5CF6';
  const accentSecondary = isDark ? '#818CF8' : '#6366F1';

  // Rich multi-color palettes for both modes
  const darkColors = ['#A78BFA', '#818CF8', '#F472B6', '#FBBF24', '#34D399', '#60A5FA', '#F87171', '#C084FC', '#A5B4FC', '#E5E7EB', '#D1D5DB', '#9CA3AF'];
  const lightColors = ['#8B5CF6', '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#A855F7', '#4F46E5', '#374151', '#6B7280', '#0EA5E9'];
  const palette = isDark ? darkColors : lightColors;
  const pickColor = (seed: number) =>
    palette[Math.floor(seededRandom(seed) * palette.length)];

  const iconPool = useMemo(() => getIconPool(variant), [variant]);

  const tileDoodles = useMemo(() => {
    const items: DoodleItem[] = [];

    const pick = (pool: string[], seed: number) =>
      pool[Math.floor(seededRandom(seed) * pool.length)];

    const rot = (seed: number) =>
      ROTATIONS[Math.floor(seededRandom(seed) * ROTATIONS.length)];

    // Variant seed offset so each variant produces a unique arrangement
    const vo = { default: 0, video: 1000, academic: 2000, analysis: 3000, tech: 4000, creative: 5000 }[variant];

    // ── Layer 1: Deep Background (large, visible) ─────────────────────
    for (let i = 0; i < 30; i++) {
      const s = vo + 100 + i * 37;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 1.0 + seededRandom(s + 4) * 0.5,
        color: pickColor(s + 9),
        opacity: isDark ? 0.08 + seededRandom(s + 5) * 0.06 : 0.12 + seededRandom(s + 5) * 0.08,
        strokeWidth: 1.8,
        fill: false,
      });
    }

    // ── Layer 2: Mid Layer (medium, strong) ─────────────────────────
    for (let i = 0; i < 65; i++) {
      const s = vo + 300 + i * 23;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.6 + seededRandom(s + 4) * 0.35,
        color: pickColor(s + 9),
        opacity: isDark ? 0.13 + seededRandom(s + 5) * 0.08 : 0.16 + seededRandom(s + 5) * 0.10,
        strokeWidth: 1.6,
        fill: false,
      });
    }

    // ── Layer 3: Foreground (small, bold) ────────────────────────────
    for (let i = 0; i < 55; i++) {
      const s = vo + 600 + i * 31;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.4 + seededRandom(s + 4) * 0.25,
        color: pickColor(s + 9),
        opacity: isDark ? 0.18 + seededRandom(s + 5) * 0.10 : 0.20 + seededRandom(s + 5) * 0.12,
        strokeWidth: 1.6,
        fill: false,
      });
    }

    // ── Layer 4: Brand Accent (violet highlights, prominent) ────────
    for (let i = 0; i < 25; i++) {
      const s = vo + 900 + i * 41;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.5 + seededRandom(s + 4) * 0.35,
        color: seededRandom(s + 6) > 0.5 ? accentPrimary : accentSecondary,
        opacity: isDark ? 0.22 + seededRandom(s + 5) * 0.12 : 0.25 + seededRandom(s + 5) * 0.14,
        strokeWidth: 1.8,
        fill: false,
      });
    }

    // ── Layer 5: Micro Icons (tiny scattered, visible) ──────────────
    for (let i = 0; i < 50; i++) {
      const s = vo + 1200 + i * 47;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.25 + seededRandom(s + 4) * 0.2,
        color: pickColor(s + 9),
        opacity: isDark ? 0.14 + seededRandom(s + 5) * 0.08 : 0.16 + seededRandom(s + 5) * 0.10,
        strokeWidth: 1.4,
        fill: false,
      });
    }

    // ── Layer 6: Decorative Dots & Shapes (filled, bold) ────────────
    for (let i = 0; i < 70; i++) {
      const s = vo + 1500 + i * 13;
      const useAccent = seededRandom(s + 7) > 0.80;
      items.push({
        path: pick(SHAPES_DECORATIVE, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.15 + seededRandom(s + 4) * 0.3,
        color: useAccent ? pickColor(s + 9) : pickColor(s + 11),
        opacity: useAccent
          ? (isDark ? 0.28 + seededRandom(s + 5) * 0.14 : 0.30 + seededRandom(s + 5) * 0.16)
          : (isDark ? 0.20 + seededRandom(s + 5) * 0.12 : 0.22 + seededRandom(s + 5) * 0.14),
        strokeWidth: 0,
        fill: true,
      });
    }

    // ── Layer 7: Extra fill icons (medium filled shapes) ────────────
    for (let i = 0; i < 20; i++) {
      const s = vo + 2000 + i * 29;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.45 + seededRandom(s + 4) * 0.3,
        color: pickColor(s + 9),
        opacity: isDark ? 0.06 + seededRandom(s + 5) * 0.04 : 0.10 + seededRandom(s + 5) * 0.06,
        strokeWidth: 0,
        fill: true,
      });
    }

    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, isDark, iconPool, accentPrimary, accentSecondary]);

  // Build the tiled SVG data URI
  const patternSvg = useMemo(() => {
    const paths = tileDoodles
      .map(
        (d) =>
          `<g transform="translate(${d.x.toFixed(1)},${d.y.toFixed(1)}) rotate(${d.rotation}) scale(${d.scale.toFixed(2)})" opacity="${d.opacity.toFixed(3)}"><path d="${d.path}" transform="translate(-12,-12)" fill="${d.fill ? d.color : 'none'}" stroke="${d.fill ? 'none' : d.color}" stroke-width="${d.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></g>`
      )
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}">${paths}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [tileDoodles]);

  // Gradient mask for premium edge fading
  const maskGradient = 'radial-gradient(ellipse 100% 100% at 50% 50%, black 55%, transparent 100%)';

  return (
    <div
      className={className}
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
        backgroundSize: `${TILE}px ${TILE}px`,
        maskImage: maskGradient,
        WebkitMaskImage: maskGradient,
      }}
      aria-hidden="true"
    />
  );
};

export default DoodleBackground;
