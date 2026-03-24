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
 * - 500px tile with ~200 elements (reduced from 315 for breathing room)
 * - Grid-jitter placement for even distribution
 */

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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

// ─── DETAILED OBJECTS (complex illustrative doodles, WhatsApp-style) ─────────
const ICONS_OBJECTS = [
  // Coffee cup with steam curls
  'M5 12h14a1 1 0 011 1v1a6 6 0 01-6 6H10a6 6 0 01-6-6v-1a1 1 0 011-1zM20 13h1a2 2 0 010 4h-1M8 6c0-1 .5-2 1.5-2s1 1 0 2-.5 2-1.5 2S8 7 8 6zM12 5c0-1 .5-2 1.5-2s1 1 0 2-.5 2-1.5 2S12 6 12 5zM16 6c0-1 .5-2 1.5-2s1 1 0 2-.5 2-1.5 2S16 7 16 6z',
  // Rocket with flames
  'M12 2c-2 0-4 3-4 8v4l-3 3h14l-3-3v-4c0-5-2-8-4-8zM12 2c1 0 2.5 2 3 5M12 2c-1 0-2.5 2-3 5M9 17l-1 3c-.5 1.5.5 2.5 1.5 1.5l2.5-3M15 17l1 3c.5 1.5-.5 2.5-1.5 1.5L12 18.5M12 8v4M10 10h4',
  // Camera with lens detail
  'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a5 5 0 100-10 5 5 0 000 10zM12 15a3 3 0 100-6 3 3 0 000 6zM12 13a1 1 0 100-2 1 1 0 000 2z',
  // Cassette tape
  'M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2zM8 19l1.5-4h5L16 19M8 10a2 2 0 100-4 2 2 0 000 4zM16 10a2 2 0 100-4 2 2 0 000 4zM10 8h4M4 14h16',
  // Vinyl record with grooves
  'M12 2a10 10 0 100 20 10 10 0 000-20zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11a1 1 0 100 2 1 1 0 000-2zM5 12a7 7 0 010-3M19 12a7 7 0 000-3',
  // Polaroid camera
  'M4 4h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM2 17h20M12 14a4 4 0 100-8 4 4 0 000 8zM12 12a2 2 0 100-4 2 2 0 000 4zM4 2h4M16 2h4',
  // Hot air balloon
  'M12 2c-4 0-7 4-7 8 0 3 1.5 5.5 3.5 7l3.5 2v2h0a1 1 0 002 0v-2l3.5-2c2-1.5 3.5-4 3.5-7 0-4-3-8-7-8zM9 21h6M8 10c0-2 1.8-4 4-4M12 2v2M7 6l-1-1M17 6l1-1',
  // Lighthouse
  'M10 22h4M9 17h6v5H9zM10 2h4l1 5H9zM7 7h10l1 10H6zM3 7h18M12 2v-1M5 3l-2-1M19 3l2-1M4 12h1M19 12h1M12 7v4',
  // Anchor
  'M12 8a3 3 0 100-6 3 3 0 000 6zM12 8v14M5 12H2l3.5 9L12 22M19 12h3l-3.5 9L12 22M8 12h8',
  // Hourglass
  'M5 3h14M5 21h14M6 3v3a6 6 0 003 5.2L12 12l-3 .8A6 6 0 006 18v3M18 3v3a6 6 0 01-3 5.2L12 12l3 .8A6 6 0 0118 18v3M9 3v2M15 3v2M9 21v-2M15 21v-2',
  // Telescope
  'M21 3l-8 8M6 13l5 5M2 22l4-4M10 18l3-3M7 15l3-3M13 5l6-3M21 3l-3 6M13 11a2 2 0 100-4 2 2 0 000 4z',
  // Binoculars
  'M7 14a4 4 0 100-8 4 4 0 000 8zM17 14a4 4 0 100-8 4 4 0 000 8zM10 10h4M7 14v4a3 3 0 006 0v-4M17 14v4a3 3 0 01-6 0v-4M4 10V6M20 10V6M4 6h3M17 6h3',
  // Typewriter
  'M4 10h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2zM8 10V6a2 2 0 012-2h4a2 2 0 012 2v4M7 14h2M11 14h2M15 14h2M7 18h10M3 7l4-5M21 7l-4-5',
  // Compass rose
  'M12 2v4M12 18v4M2 12h4M18 12h4M12 2l2 6-2 4-2-4 2-6zM22 12l-6 2-4-2 4-2 6 2zM12 22l-2-6 2-4 2 4-2 6zM2 12l6-2 4 2-4 2-6-2z',
  // DNA double helix
  'M6 3c0 3 2 5 6 6s6 3 6 6-2 5-6 6-6 3-6 6M18 3c0 3-2 5-6 6s-6 3-6 6 2 5 6 6 6 3 6 6M9 6h6M8 9h8M9 12h6M8 15h8M9 18h6',
  // Satellite
  'M12 2l2 2-6 6-2-2zM18 8l2 2-6 6-2-2zM4.93 19.07l-1.41-1.41M7.76 16.24l-1.41-1.41M16 16a4 4 0 100-8M2 22l2-2',
];

// ─── WHIMSICAL & FUN (playful illustrative doodles) ─────────────────────────
const ICONS_WHIMSICAL = [
  // Planet with ring (Saturn)
  'M12 12a5 5 0 100-10 5 5 0 000 10zM3.6 15.4C2 14.3 1.3 13 2 12c1.2-2 5.5-2.5 9.8-.8M20.4 8.6C22 9.7 22.7 11 22 12c-1.2 2-5.5 2.5-9.8.8',
  // Constellation (connected stars)
  'M3 5l1-1 1 1-1 1zM10 3l1-1 1 1-1 1zM18 7l1-1 1 1-1 1zM14 13l1-1 1 1-1 1zM20 17l1-1 1 1-1 1zM7 15l1-1 1 1-1 1zM4 6l5-2M11 4l6 4M19 8l-4 4M15 14l4 4M8 16l6-2',
  // Paint palette with dots
  'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10a2 2 0 002-2c0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3a2 2 0 012-2h2.4A6 6 0 0022 9.5C22 5.4 17.5 2 12 2zM7.5 10.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 10.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  // Clapperboard
  'M4 6h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zM2 10h20M7 2l3 4M12 2l3 4M17 2l3 4',
  // Megaphone with sound waves
  'M3 11v2a1 1 0 001 1h2l5 5V5L6 10H4a1 1 0 00-1 1zM15 8a4 4 0 010 8M18 5a8 8 0 010 14',
  // Paper airplane detailed
  'M22 2L11 13M22 2l-7 20-4-9-9-4zM11 13l-2.5 2.5M13 3.5l3 1',
  // Magic crystal ball
  'M12 22a8 8 0 100-16 8 8 0 000 16zM7 22h10M8 8c0 1 1.5 2.5 4 2.5S16 9 16 8M12 6v1M9 7l.5.5M15 7l-.5.5',
  // Feather quill with inkwell
  'M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5zM16 8l-2 2M2 22v-3a2 2 0 012-2h3M2 22h5',
  // Treasure chest
  'M3 11h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 11l2-6h14l2 6M12 11v4M10 15h4M7 5v6M17 5v6',
  // Crown with jewels
  'M2 17l3-7 4 4 3-9 3 9 4-4 3 7zM2 17h20M4 20h16M9 13a1 1 0 100-2 1 1 0 000 2zM15 13a1 1 0 100-2 1 1 0 000 2zM12 7a1 1 0 100-2 1 1 0 000 2z',
  // Open book with pages
  'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7zM6 7h2M6 11h2M6 15h3M16 7h2M16 11h2M16 15h3',
  // Envelope with heart seal
  'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6M12 11l-.9.9a2 2 0 000 2.8l.9.9.9-.9a2 2 0 000-2.8z',
  // Shooting star with trail
  'M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6zM2 2l3 3M5 1l1 2M1 5l2 1',
  // Lantern / lamp
  'M10 2h4M12 2v2M8 4h8l1 3H7zM7 7h10v6a5 5 0 01-10 0zM9 18h6M10 18v2M14 18v2M8 21h8',
  // Potion bottle
  'M9 2h6v4l3 6v6a3 3 0 01-3 3H9a3 3 0 01-3-3v-6l3-6zM9 2h6M7 14h10M9 17h6M12 6v3',
  // Globe with airplane
  'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10M7 5l3 2-1 2M17 17l-3-1 1-2',
];

// ─── SCIENCE & NATURE (educational/discovery doodles) ───────────────────────
const ICONS_SCIENCE = [
  // Atom with orbiting electrons
  'M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0M12 2c-5 0-8 5-8 10s3 10 8 10 8-5 8-10-3-10-8-10zM4.93 4.93c3.13-1.56 7.88.94 10.61 5.57 2.73 4.63 2.73 9.44-.4 10.99M19.07 4.93c-3.13-1.56-7.88.94-10.61 5.57-2.73 4.63-2.73 9.44.4 10.99',
  // Microscope
  'M12 4a2 2 0 00-2 2v6a2 2 0 004 0V6a2 2 0 00-2-2zM14 12l4 4M8 22h8M12 18v4M6 22c0-3 2.5-5 6-5s6 2 6 5',
  // Beaker with bubbles
  'M9 2h6v4l3 8v4a3 3 0 01-3 3H9a3 3 0 01-3-3v-4l3-8zM9 2h6M7 14h10M10 17a1 1 0 100-2 1 1 0 000 2zM14 16a1 1 0 100-2 1 1 0 000 2zM12 19a1 1 0 100-2 1 1 0 000 2z',
  // Leaf with veins
  'M12 22V8M12 2c4 0 8 3 8 8s-3 9-8 12c-5-3-8-7-8-12s4-8 8-8zM8 10l4 4M16 10l-4 4M10 6l2 2M14 6l-2 2',
  // Wave / ocean
  'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
  // Mountain with sun
  'M2 20l5-8 3 3 4-7 4 7 3-3 5 8zM17 5a2 2 0 100-4 2 2 0 000 4zM17 1v1M21 5h-1M17 9v-1M13 5h1M19.5 2.5l-.7.7M14.5 7.5l.7-.7M14.5 2.5l.7.7M19.5 7.5l-.7-.7',
  // Snowflake
  'M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07M12 2l2 4-2 2-2-2zM12 22l2-4-2-2-2 2zM2 12l4 2 2-2-2-2zM22 12l-4 2-2-2 2-2z',
  // Butterfly
  'M12 4v18M8 8C4 4 1 8 3 12s6 6 9 4M16 8c4-4 7 0 5 4s-6 6-9 4M10 14c-2 2-5 4-7 2M14 14c2 2 5 4 7 2M12 4a1 1 0 100-2 1 1 0 000 2z',
  // Rainbow arc
  'M2 18a10 10 0 0120 0M4 18a8 8 0 0116 0M6 18a6 6 0 0112 0M8 18a4 4 0 018 0',
  // Flame / fire
  'M12 22c-4 0-7-3-7-7 0-3 2-5 3-8 .5-1.5 1-3.5 1-5 0 2.5 2 5 4 7 1 1 2 1.5 2 3 0 1-.5 2-2 2-2.5 0-4.5-3-4.5-5 4 2 6 5 6 8s-3 5-7 5z',
  // Prism / light refraction
  'M5 20L12 4l7 16zM3 14h8M13 14l8 2M13 14l4-6',
  // Magnifying glass with details
  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 8v4M8 10h4',
];

// ─── HAND-DRAWN GEOMETRIC (organic, imperfect shapes) ───────────────────────
const SHAPES_ORGANIC = [
  // Wobbly circle
  'M12.3 2.1c5.4.2 9.8 4.3 10.1 9.7.3 5.6-4.1 10.2-9.7 10.5-5.6.3-10.2-4.1-10.5-9.7C1.9 7.2 6 2.4 11.3 2.1z',
  // Sketchy square
  'M4.2 4.5h15.3c.3 0 .5.4.5.6v14.5c-.1.3-.3.5-.7.5H4.5c-.4-.1-.6-.4-.5-.8V5c0-.3.1-.5.5-.5z',
  // Imperfect triangle
  'M11.8 3.2l8.5 16.3c.2.3 0 .7-.4.7H4.3c-.4 0-.6-.3-.5-.6L11.2 3.3c.2-.3.5-.3.6-.1z',
  // Organic blob 1
  'M15.5 5.5c3.5 2 5 6 4 10s-4.5 7-8 7.5-7-1-9-4.5-1.5-8 1.5-11S12 3.5 15.5 5.5z',
  // Organic blob 2
  'M18 8c2 3 2 7 0 10s-5 5-8 5-6.5-1-8.5-4S0 12 1 9s3.5-5 6.5-6S16 5 18 8z',
  // Spiral
  'M12 12c0-1 .8-2 2-2s2.5 1 2.5 2.5-1.5 3-3 3-3.5-1.5-3.5-3.5 2-4 4-4 4.5 2 4.5 4.5-2.5 5-5 5-5.5-2.5-5.5-5.5c0-3.3 3-6 6-6',
  // Wavy line horizontal
  'M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0',
  // Squiggly underline
  'M3 18c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0 2-1 3 0 2 1 3 0',
  // Dotted arc
  'M4 16a8 8 0 0116 0M6 14a6 6 0 0112 0',
  // Hand-drawn star
  'M12.2 2.5l2.3 7.2 7.3.2-5.8 4.5 2.1 7.2-6.1-4.6-6.2 4.5 2.3-7.1-5.7-4.7 7.3-.3z',
  // Sketchy heart
  'M12 21.4C5 16 2 12.5 2 9c0-3.5 2.5-6 5.5-6 2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 19.5 3 22 5.5 22 9c0 3.5-3 7-10 12.4z',
  // Cross-hatch texture
  'M2 4l20 16M6 2l16 20M2 8l20 16M2 12l16 12M2 16l12 8M22 8L6 22M22 4L2 20M22 12L10 22',
];

// Small decorative fills + geometric mixed-media elements
const SHAPES_DECORATIVE = [
  'M12 10a2 2 0 100 4 2 2 0 000-4z',                       // Dot
  'M12 5v14M5 12h14',                                      // Cross
  'M18 6L6 18M6 6l12 12',                                  // X mark
  'M12 8a4 4 0 100 8 4 4 0 000-8z',                        // Ring
  'M12 6l6 10H6z',                                         // Small triangle
  'M12 2l3 6 6 1-4 4 1 7-6-3-6 3 1-7-4-4 6-1z',          // Star small
  'M2 12l5-5 5 5 5-5 5 5',                                // Zigzag
  'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',   // 4 squares
  // Mixed-media geometric elements
  'M4 4h2v2H4zM10 4h2v2h-2zM16 4h2v2h-2zM4 10h2v2H4zM10 10h2v2h-2zM16 10h2v2h-2zM4 16h2v2H4zM10 16h2v2h-2zM16 16h2v2h-2z', // 3×3 dot grid
  'M2 12h20M12 2v20',                                      // Crosshair line
  'M4 4l16 16M4 20L20 4',                                  // Diagonal cross
  'M6 6h12v12H6z',                                         // Square outline
  'M4 12a8 8 0 0116 0',                                    // Half circle arc
  'M2 22L12 2l10 20',                                      // Triangle large
  'M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4',          // Parallel dashes
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
    ...ICONS_OBJECTS, ...ICONS_WHIMSICAL, ...ICONS_SCIENCE,
  ];

  const emphasis: Record<DoodleVariant, string[]> = {
    default: [...ICONS_ABSTRACT, ...ICONS_OBJECTS, ...ICONS_WHIMSICAL],
    video: [...ICONS_VIDEO, ...ICONS_VIDEO, ...ICONS_VIDEO, ...ICONS_OBJECTS],
    academic: [...ICONS_STUDY, ...ICONS_STUDY, ...ICONS_STUDY, ...ICONS_SCIENCE],
    analysis: [...ICONS_ANALYTICS, ...ICONS_ANALYTICS, ...ICONS_ANALYTICS, ...ICONS_SCIENCE],
    tech: [...ICONS_TECH, ...ICONS_TECH, ...ICONS_TECH, ...ICONS_OBJECTS],
    creative: [...ICONS_CREATIVE, ...ICONS_CREATIVE, ...ICONS_CREATIVE, ...ICONS_WHIMSICAL],
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
  // ⚠️ Synchronous check to avoid first-render crash on mobile (React Error #300)
  const [isMobileOrReduced, setIsMobileOrReduced] = useState(() => {
    try {
      const isMobile = window.innerWidth < 1024;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return isMobile || prefersReduced;
    } catch {
      return true; // Safe default: disable on error
    }
  });
  useEffect(() => {
    const checkShouldDisable = () => {
      const isMobile = window.innerWidth < 1024;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setIsMobileOrReduced(isMobile || prefersReduced);
    };
    window.addEventListener('resize', checkShouldDisable);
    return () => window.removeEventListener('resize', checkShouldDisable);
  }, []);

  // 🎲 Seed dynamique : change à chaque navigation (nouveau pathname)
  const location = useLocation();
  const navCountRef = useRef(0);
  const [navSeed, setNavSeed] = useState(0);
  useEffect(() => {
    navCountRef.current += 1;
    setNavSeed(navCountRef.current * 7919); // prime multiplier for spread
  }, [location.pathname]);

  if (isMobileOrReduced) return null;

  const accentPrimary = isDark ? '#D4A054' : '#C8903A';
  const accentSecondary = isDark ? '#C8903A' : '#D4A054';

  // Rich multi-color palettes for both modes
  const darkColors = ['#A78BFA', '#818CF8', '#F472B6', '#FBBF24', '#34D399', '#60A5FA', '#F87171', '#C084FC', '#A5B4FC', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#E2E8F0', '#FDE68A'];
  const lightColors = ['#8B5CF6', '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#A855F7', '#4F46E5', '#374151', '#6B7280', '#0EA5E9', '#94A3B8', '#D97706'];
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

    // Variant seed offset + navigation seed for unique arrangement per page visit
    const vo = { default: 0, video: 1000, academic: 2000, analysis: 3000, tech: 4000, creative: 5000 }[variant] + navSeed;

    // Helper: variable strokeWidth (0.8–2.0) per element for mixed-media feel
    const sw = (seed: number, base: number) => {
      const v = seededRandom(seed);
      return +(base + (v - 0.5) * 0.8).toFixed(1); // ±0.4 around base
    };

    // ── Layer 1: Deep Background (large, visible) — 20 items ────────
    for (let i = 0; i < 20; i++) {
      const s = vo + 100 + i * 37;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 1.0 + seededRandom(s + 4) * 0.5,
        color: pickColor(s + 9),
        opacity: isDark ? 0.12 + seededRandom(s + 5) * 0.08 : 0.16 + seededRandom(s + 5) * 0.10,
        strokeWidth: sw(s + 10, 1.8),
        fill: false,
      });
    }

    // ── Layer 2: Mid Layer (medium, strong) — 40 items ──────────────
    for (let i = 0; i < 40; i++) {
      const s = vo + 300 + i * 23;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.6 + seededRandom(s + 4) * 0.35,
        color: pickColor(s + 9),
        opacity: isDark ? 0.18 + seededRandom(s + 5) * 0.10 : 0.22 + seededRandom(s + 5) * 0.12,
        strokeWidth: sw(s + 10, 1.5),
        fill: false,
      });
    }

    // ── Layer 3: Foreground (small, bold) — 35 items ────────────────
    for (let i = 0; i < 35; i++) {
      const s = vo + 600 + i * 31;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.4 + seededRandom(s + 4) * 0.25,
        color: pickColor(s + 9),
        opacity: isDark ? 0.22 + seededRandom(s + 5) * 0.12 : 0.30 + seededRandom(s + 5) * 0.14,
        strokeWidth: sw(s + 10, 1.4),
        fill: false,
      });
    }

    // ── Layer 4: Brand Accent (violet highlights) — 20 items ────────
    for (let i = 0; i < 20; i++) {
      const s = vo + 900 + i * 41;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.5 + seededRandom(s + 4) * 0.35,
        color: seededRandom(s + 6) > 0.5 ? accentPrimary : accentSecondary,
        opacity: isDark ? 0.30 + seededRandom(s + 5) * 0.14 : 0.45 + seededRandom(s + 5) * 0.16,
        strokeWidth: sw(s + 10, 1.8),
        fill: false,
      });
    }

    // ── Layer 5: Micro Icons (tiny scattered) — 30 items ────────────
    for (let i = 0; i < 30; i++) {
      const s = vo + 1200 + i * 47;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.25 + seededRandom(s + 4) * 0.2,
        color: pickColor(s + 9),
        opacity: isDark ? 0.14 + seededRandom(s + 5) * 0.08 : 0.16 + seededRandom(s + 5) * 0.10,
        strokeWidth: sw(s + 10, 1.2),
        fill: false,
      });
    }

    // ── Layer 6: Decorative Dots & Shapes (filled) — 40 items ───────
    for (let i = 0; i < 40; i++) {
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

    // ── Layer 7: Extra fill icons (medium filled shapes) — 15 items ─
    for (let i = 0; i < 15; i++) {
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

    // ── Layer 8: Organic hand-drawn shapes (stroked, large, subtle) — 12 items
    for (let i = 0; i < 12; i++) {
      const s = vo + 2500 + i * 53;
      items.push({
        path: pick(SHAPES_ORGANIC, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.7 + seededRandom(s + 4) * 0.5,
        color: pickColor(s + 9),
        opacity: isDark ? 0.06 + seededRandom(s + 5) * 0.04 : 0.08 + seededRandom(s + 5) * 0.05,
        strokeWidth: sw(s + 10, 1.0),
        fill: false,
      });
    }

    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, isDark, iconPool, accentPrimary, accentSecondary, navSeed]);

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
