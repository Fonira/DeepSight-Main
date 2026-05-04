/**
 * DEEP SIGHT DOODLES v14 — LUMINOUS THEMED BACKGROUNDS (React Native port)
 *
 * Brighter, more visible, with new sacred/cosmic/chaos shapes.
 *
 * v14 Highlights (over v13):
 * - +36 new SVG paths (sacred geometry, cosmic, chaos squiggles)
 * - Higher per-layer opacity (~+50%) for stronger presence
 * - Glow simulated via SVG <Filter feGaussianBlur> on the accent layer
 * - Wider radial fade (60% transparent center vs 45%)
 * - Stroke variation (dasharray on ~22% of strokes for sketched feel)
 * - Accent layer reinforced (Layer 4 opacity 0.40-0.62, strokeWidth 2.0-2.4)
 * - 6 themed variants kept: default, video, academic, analysis, tech, creative
 * - 500px tile, 7-layer depth system unchanged
 */

import React, { useMemo } from "react";
import { View, Dimensions, StyleSheet, ViewStyle } from "react-native";
import Svg, {
  G,
  Path,
  Defs,
  Pattern,
  Rect,
  Filter,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../contexts/ThemeContext";

// Types

type DoodleVariant =
  | "default"
  | "video"
  | "academic"
  | "analysis"
  | "tech"
  | "creative";

interface DoodleBackgroundProps {
  variant?: DoodleVariant;
  style?: ViewStyle;
}

// SVG Icon Paths (24x24 viewBox, stroke-based)

const ICONS_VIDEO = [
  "M5 3l14 9-14 9V3z",
  "M6 4h4v16H6zm8 0h4v16h-4z",
  "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z",
  "M2 4h20v12H2zm5 16h10m-5-4v4",
  "M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14V8l6 4-6 4z",
  "M3 18v-6a9 9 0 0118 0v6",
  "M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0",
  "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2",
  "M22.54 6.42A2.78 2.78 0 0020.6 4.42C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z",
  "M4 2v20h16V2zm2 2h2v2H6zm4 0h4v2h-4zm6 0h2v2h-2zM6 18h2v2H6zm4 0h4v2h-4zm6 0h2v2h-2z",
  "M15 3l6 6-6 6M9 21l-6-6 6-6",
  "M12 2v4m0 12v4M2 12h4m12 0h4",
];

const ICONS_STUDY = [
  "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
  "M22 10l-10-5L2 10l10 5zm-16 2v5c0 2 2.7 3 6 3s6-1 6-3v-5",
  "M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z",
  "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zm0 0v6h6",
  "M9 18h6M10 22h4M12 2a6 6 0 00-6 6c0 2 1 3.5 2.5 5 .5.5 1 1.5 1 2.5V17h5v-1.5c0-1 .5-2 1-2.5 1.5-1.5 2.5-3 2.5-5a6 6 0 00-6-6z",
  "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  "M10 2v6l-2 4h8l-2-4V2zm-2 12v2m8-2v2M8 22h8",
  "M3 21c3 0 7-1 7-8V5M14 5c0 6.5 4 8 7 8",
  "M9 2h6v4H9zM16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m1 9l2 2 4-4",
  "M12 4c-2 0-3.5 1-4 2.5-.5-1-2-1.5-3-.5S3.5 8 4 9c-1 .5-1.5 2-.5 3s2 1.5 3 1c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5c1 .5 2 0 3-1s.5-2.5-.5-3c.5-1 0-2.5-1-3.5s-2.5 0-3 .5C15.5 5 14 4 12 4z",
  "M6 9H3V4h3m12 5h3V4h-3M12 15a6 6 0 006-6V3H6v6a6 6 0 006 6zm0 0v4m-4 2h8",
  "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4a2 2 0 012-2h14v14H6.5A2.5 2.5 0 004 18.5z",
];

const ICONS_TECH = [
  "M16 18l6-6-6-6M8 6l-6 6 6 6",
  "M4 17l6-6-6-6m8 14h8",
  "M6 6h12v12H6zM2 10h2m16 0h2M2 14h2m16 0h2M10 2v2m4-2v2M10 20v2m4-2v2",
  "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  "M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01",
  "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3",
  "M2 18h20l-2-8H4zm2-8V5a2 2 0 012-2h12a2 2 0 012 2v5",
  "M16 5H8a6 6 0 000 12h8a6 6 0 000-12zm0 8a2 2 0 100-4 2 2 0 000 4z",
  "M12 2a5 5 0 00-5 5v10a5 5 0 0010 0V7a5 5 0 00-5-5zm0 0v6",
  "M2 6h20v12H2zm3 3h2v2H5zm4 0h2v2H9zm4 0h2v2h-2zm4 0h2v2h-2zM5 13h14v2H5z",
  "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  "M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z",
];

const ICONS_ANALYTICS = [
  "M18 20V10M12 20V4M6 20v-6",
  "M3 3v18h18M7 14l4-4 4 4 5-6",
  "M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z",
  "M23 6l-9.5 9.5-5-5L1 18m22-12v6h-6",
  "M22 12h-4l-3 9L9 3l-3 9H2",
  "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z",
  "M12 2L2 7l10 5 10-5zm-10 10l10 5 10-5M2 12l10 5 10-5",
  "M22 3H2l8 9.46V19l4 2v-8.54z",
  "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
  "M12 20V10M6 20V4M18 20v-6",
  "M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12zM12 2a10 10 0 100 20 10 10 0 000-20z",
  "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
];

const ICONS_AI = [
  "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6",
  "M13 2L3 14h9l-1 8 10-12h-9z",
  "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8zm11-3a3 3 0 100 6 3 3 0 000-6z",
  "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  "M22 2L11 13m11-11l-7 20-4-9-9-4z",
  "M4.9 19.1C1 15.2 1 8.8 4.9 4.9m14.2 0c3.9 3.9 3.9 10.3 0 14.2M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4m8.4 0c2.3 2.3 2.3 6.1 0 8.4M12 12h.01",
  "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z",
  "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  "M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z",
  "M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5",
  "M5 5a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM7 7l5 5m5-5l-5 5m-5 5l5-5m5 5l-5-5",
  "M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 2c-5 0-8 5-8 10s3 10 8 10 8-5 8-10-3-10-8-10z",
];

const ICONS_CREATIVE = [
  "M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6z",
  "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  "M12 2l8.5 5v10L12 22l-8.5-5V7z",
  "M12 2l10 10-10 10L2 12z",
  "M2 17l3-7 4 4 3-9 3 9 4-4 3 7z",
  "M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z",
  "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z",
  "M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z",
  "M12 3c-4.97 0-9 3.18-9 7.11 0 1.73.68 3.33 1.83 4.6L3 21l4.25-1.99C8.86 19.65 10.39 20 12 20c4.97 0 9-3.18 9-7.11 0-3.93-4.03-6.89-9-6.89z",
  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "M2 3l20 18M20 16.58A22.07 22.07 0 0012 2c-2.72 0-5.3.59-7.59 1.63M2 12c1.64-4.15 5.56-7.1 10.2-7.1M22 12c-.73 1.85-2 3.46-3.6 4.7",
  "M4.5 16.5c-1.5 1.38-3 1.38-3 1.38s-.38-1.5 1.12-3 3.63-2.38 5.38-3.88c0 0 1.5 1.5-.38 3S6 15.12 4.5 16.5zM14.5 4c1.2-1.2 3.4-1.18 4.6 0 1.2 1.2 1.2 3.4 0 4.6l-9.2 9.2-6 1.4 1.4-6z",
];

const ICONS_ABSTRACT = [
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z",
  "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 6v6l4 2",
  "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94z",
  "M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z",
  "M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3",
  "M2 12c2-4 5-7 10-7s8 3 10 7c-2 4-5 7-10 7s-8-3-10-7zm10-3a3 3 0 110 6 3 3 0 010-6z",
  "M3 12h4l3-9 4 18 3-9h4",
  "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.83-.13 2.68-.36A6.92 6.92 0 0012 15a7 7 0 017-7c0-.65-.09-1.28-.26-1.88C17.33 3.55 14.87 2 12 2z",
  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
];

// SACRED GEOMETRY -- v14 NEW
const ICONS_SACRED = [
  "M9 12a4 4 0 008 0M15 12a4 4 0 00-8 0M11 8a4 4 0 014 8M9 8a4 4 0 00-4 8",
  "M12 2l5.196 9H6.804zM12 22l-5.196-9h10.392zM3.804 6.5l16.392 11M20.196 6.5L3.804 17.5",
  "M12 6a3 3 0 100 6 3 3 0 000-6zM7 9a3 3 0 100 6 3 3 0 000-6zM17 9a3 3 0 100 6 3 3 0 000-6zM12 12a3 3 0 100 6 3 3 0 000-6zM7 15a3 3 0 100 6 3 3 0 000-6zM17 15a3 3 0 100 6 3 3 0 000-6z",
  "M12 2a10 10 0 010 20 5 5 0 010-10 5 5 0 000-10zM12 6a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM12 15a1.5 1.5 0 100 3 1.5 1.5 0 000-3z",
  "M12 2l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9zM5 11h14M9 21l3-9 3 9",
  "M12 2a3 3 0 100 6 3 3 0 000-6zM12 8v14M5 14h14",
  "M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0M12 4v6M12 14v6M4 12h6M14 12h6M6.34 6.34l4.24 4.24M13.42 13.42l4.24 4.24M17.66 6.34l-4.24 4.24M10.58 13.42l-4.24 4.24",
  "M12 2l9 16H3zM12 22l-9-16h18zM3 18h18M3 6h18",
  "M12 4a5 5 0 015 8M12 4a5 5 0 00-5 8M7 12a5 5 0 0010 0M7 12c0 3 2 5 5 5s5-2 5-5",
  "M12 2v20M2 12h20M5 5l14 14M19 5L5 19M12 2a4 4 0 100 8 4 4 0 000-8zM12 14a4 4 0 100 8 4 4 0 000-8z",
  "M2 12c2-4 6-6 10-6s8 2 10 6c-2 4-6 6-10 6s-8-2-10-6zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11a1 1 0 100 2 1 1 0 000-2zM16 16l3 4M8 16l-3 4",
  "M12 4a4 4 0 100 8 4 4 0 000-8zM12 12a4 4 0 100 8 4 4 0 000-8zM6 8a4 4 0 100 8 4 4 0 000-8zM18 8a4 4 0 100 8 4 4 0 000-8z",
];

// COSMIC -- v14 NEW
const ICONS_COSMIC = [
  "M12 12a3 3 0 014 3M16 15a7 7 0 01-12-2M4 13a11 11 0 0118 4M22 17a15 15 0 01-20-7M12 12a3 3 0 00-2-2",
  "M12 8a4 4 0 100 8 4 4 0 000-8zM2 14c0 2 4 3 10 3s10-1 10-3M2 10c0-2 4-3 10-3s10 1 10 3",
  "M16 12a4 4 0 11-8 0 4 4 0 018 0zM14 14l8-12M10 16l-6 6M4 14l4 4M22 2l-3 1",
  "M3 18l3-2 4-3 5-1 4-3 5 2M6 16l1-1M10 13l1 1M15 12l-1 1M19 9l-1-1M22 11l1-1",
  "M5 8c0 4 5 6 9 4M19 16c0-4-5-6-9-4M2 12c5-3 11-3 16 0M22 12c-5 3-11 3-16 0M8 6a2 2 0 100 4 2 2 0 000-4zM16 14a2 2 0 100 4 2 2 0 000-4z",
  "M12 12a3 3 0 100 6 3 3 0 000-6zM12 6a9 9 0 010 12M12 6a9 9 0 000 12M2 12c2-2 6-2 10 0M22 12c-2-2-6-2-10 0",
  "M12 8a4 4 0 100-8 4 4 0 000 8zM8 22V12h8v10M10 14h4M9 22v-3M15 22v-3M10 4l4 0",
  "M12 12a5 5 0 100 6 5 5 0 000-6zM3 13a13 13 0 0118 0M21 11a13 13 0 00-18 0M2 7l3-1M19 7l3 1",
  "M12 18a8 6 0 110-12 8 6 0 010 12zM5 14h14M9 12V8M15 12V8M10 22l4-4",
  "M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6zM4 4l-2 2M3 8l-1 1M7 4L5 2",
  "M12 8a4 4 0 100 8 4 4 0 000-8zM12 1v3M12 20v3M1 12h3M20 12h3M3.5 3.5l2 2M18.5 18.5l2 2M3.5 20.5l2-2M18.5 5.5l2-2",
  "M12 2a10 10 0 100 20 8 8 0 010-20zM18 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM20 14l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z",
];

// CHAOS / FREEHAND -- v14 NEW
const ICONS_CHAOS = [
  "M12 12a2 2 0 014 0 4 4 0 01-8 0 6 6 0 0112 0 8 8 0 01-16 0",
  "M3 12c0-3 3-5 6-5s5 2 6 5 3 5 6 5 6-2 6-5-3-5-6-5-5 2-6 5-3 5-6 5-6-2-6-5z",
  "M2 12c1.5-2 3-2 4.5 0S9 14 10.5 12s3-2 4.5 0 3 2 4.5 0 3-2 4.5 0",
  "M2 6c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0",
  "M6 12c-3 0-5-2-5-5s2-5 5-5 5 2 5 5M14 12c3 0 5-2 5-5s-2-5-5-5-5 2-5 5M6 12c3 0 5 2 5 5s-2 5-5 5-5-2-5-5M14 12c-3 0-5 2-5 5s2 5 5 5 5-2 5-5",
  "M2 18c3-1 4-5 6-5s3 4 6 4 3-4 6-4 3 4 4 5",
  "M3 5c2 1 4 0 6 1s4 3 6 2 5 0 6 2M4 10c1 2 3 1 5 2s3 3 5 2 4 0 6 2M3 16c2 1 4 0 6 1s4 3 6 2 5 0 6 2",
  "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M12 8a2 2 0 100 8 2 2 0 000-8z",
  "M5 12a7 7 0 0114 0 7 7 0 01-14 0M3 12a9 9 0 0118 0 9 9 0 01-18 0",
  "M2 12s2-4 5-4 3 4 6 4 3-4 5-4 4 4 4 4M22 18s-2-4-5-4-3 4-6 4-3-4-5-4-4 4-4 4",
  "M12 4a8 8 0 11-8 8 6 6 0 016-6 4 4 0 014 4 2 2 0 01-2 2",
  "M12 4l8 14H4zM12 8l5 9H7zM12 12l3 5H9z",
];

const SHAPES_DECORATIVE = [
  "M12 10a2 2 0 100 4 2 2 0 000-4z",
  "M12 5v14M5 12h14",
  "M18 6L6 18M6 6l12 12",
  "M12 8a4 4 0 100 8 4 4 0 000-8z",
  "M12 6l6 10H6z",
  "M12 2l3 6 6 1-4 4 1 7-6-3-6 3 1-7-4-4 6-1z",
  "M2 12l5-5 5 5 5-5 5 5",
  "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z",
];

// Helpers

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

const getIconPool = (variant: DoodleVariant): string[] => {
  const all = [
    ...ICONS_VIDEO,
    ...ICONS_STUDY,
    ...ICONS_TECH,
    ...ICONS_ANALYTICS,
    ...ICONS_AI,
    ...ICONS_CREATIVE,
    ...ICONS_ABSTRACT,
    ...ICONS_SACRED,
    ...ICONS_COSMIC,
    ...ICONS_CHAOS,
  ];

  const emphasis: Record<DoodleVariant, string[]> = {
    default: [...ICONS_ABSTRACT, ...ICONS_SACRED, ...ICONS_COSMIC, ...ICONS_CHAOS],
    video: [...ICONS_VIDEO, ...ICONS_VIDEO, ...ICONS_VIDEO, ...ICONS_COSMIC],
    academic: [...ICONS_STUDY, ...ICONS_STUDY, ...ICONS_STUDY, ...ICONS_SACRED],
    analysis: [...ICONS_ANALYTICS, ...ICONS_ANALYTICS, ...ICONS_ANALYTICS, ...ICONS_COSMIC],
    tech: [...ICONS_TECH, ...ICONS_TECH, ...ICONS_TECH, ...ICONS_ABSTRACT, ...ICONS_COSMIC],
    creative: [
      ...ICONS_CREATIVE,
      ...ICONS_CREATIVE,
      ...ICONS_CREATIVE,
      ...ICONS_CHAOS,
      ...ICONS_SACRED,
    ],
  };

  return [...all, ...emphasis[variant]];
};

const ROTATIONS = [
  0, 12, -12, 25, -25, 40, -40, 55, -55, 70, -70, 90, -90, 135, -135, 180,
];

// Dashed stroke variants -- ~22% of stroked icons get one
const DASH_PATTERNS = ["", "", "", "", "2 3", "3 2", "1 4", "4 1", "5 2 1 2"];
const pickDash = (seed: number): string => {
  const v = Math.sin(seed * 7919) * 10000;
  const r = v - Math.floor(v);
  return DASH_PATTERNS[Math.floor(r * DASH_PATTERNS.length)];
};

// Types

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
  isAccent: boolean;
  dasharray: string;
}

const TILE = 500;

// Component

export const DoodleBackground: React.FC<DoodleBackgroundProps> = ({
  variant = "default",
  style,
}) => {
  const { isDark } = useTheme();
  const { width, height } = Dimensions.get("window");

  // v14: gold/violet accent for stronger DeepSight brand presence
  const accentPrimary = isDark ? "#D4A054" : "#C8903A";
  const accentSecondary = isDark ? "#C8903A" : "#D4A054";

  const darkColors = [
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
    "#D1D5DB",
    "#9CA3AF",
    "#E2E8F0",
    "#FDE68A",
  ];
  const lightColors = [
    "#8B5CF6",
    "#6366F1",
    "#EC4899",
    "#F59E0B",
    "#10B981",
    "#3B82F6",
    "#EF4444",
    "#A855F7",
    "#4F46E5",
    "#374151",
    "#6B7280",
    "#0EA5E9",
    "#94A3B8",
    "#D97706",
  ];
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

    const vo = {
      default: 0,
      video: 1000,
      academic: 2000,
      analysis: 3000,
      tech: 4000,
      creative: 5000,
    }[variant];

    // Variable strokeWidth helper
    const sw = (seed: number, base: number) => {
      const v = seededRandom(seed);
      return +(base + (v - 0.5) * 0.6).toFixed(1); // +/-0.3 around base
    };

    // Layer 1: Deep Background (large, visible) -- Note: this legacy file uses
    // higher per-layer counts (30/65/55/25/50/70/20 = 295) than ui/ version.
    // To stay <120 elements as per the v14 perf guideline, we cap each layer.
    // The active file used by screens is mobile/src/components/ui/DoodleBackground.tsx.
    for (let i = 0; i < 18; i++) {
      const s = vo + 100 + i * 37;
      const dash = pickDash(s + 700);
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 1.0 + seededRandom(s + 4) * 0.5,
        color: pickColor(s + 9),
        opacity: isDark
          ? 0.18 + seededRandom(s + 5) * 0.10
          : 0.20 + seededRandom(s + 5) * 0.12,
        strokeWidth: sw(s + 10, 2.0),
        fill: false,
        isAccent: false,
        dasharray: dash,
      });
    }

    // Layer 2: Mid Layer
    for (let i = 0; i < 30; i++) {
      const s = vo + 300 + i * 23;
      const dash = pickDash(s + 700);
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.6 + seededRandom(s + 4) * 0.35,
        color: pickColor(s + 9),
        opacity: isDark
          ? 0.26 + seededRandom(s + 5) * 0.14
          : 0.28 + seededRandom(s + 5) * 0.16,
        strokeWidth: sw(s + 10, 1.7),
        fill: false,
        isAccent: false,
        dasharray: dash,
      });
    }

    // Layer 3: Foreground
    for (let i = 0; i < 22; i++) {
      const s = vo + 600 + i * 31;
      const dash = pickDash(s + 700);
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.4 + seededRandom(s + 4) * 0.25,
        color: pickColor(s + 9),
        opacity: isDark
          ? 0.32 + seededRandom(s + 5) * 0.16
          : 0.36 + seededRandom(s + 5) * 0.18,
        strokeWidth: sw(s + 10, 1.6),
        fill: false,
        isAccent: false,
        dasharray: dash,
      });
    }

    // Layer 4: Brand Accent (v14 reinforced -- glow filter applied at render)
    for (let i = 0; i < 14; i++) {
      const s = vo + 900 + i * 41;
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: rot(s + 3),
        scale: 0.55 + seededRandom(s + 4) * 0.40,
        color: seededRandom(s + 6) > 0.5 ? accentPrimary : accentSecondary,
        opacity: isDark
          ? 0.42 + seededRandom(s + 5) * 0.20
          : 0.52 + seededRandom(s + 5) * 0.20,
        strokeWidth: sw(s + 10, 2.2),
        fill: false,
        isAccent: true,
        dasharray: "",
      });
    }

    // Layer 5: Micro Icons
    for (let i = 0; i < 18; i++) {
      const s = vo + 1200 + i * 47;
      const dash = pickDash(s + 700);
      items.push({
        path: pick(iconPool, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.25 + seededRandom(s + 4) * 0.2,
        color: pickColor(s + 9),
        opacity: isDark
          ? 0.21 + seededRandom(s + 5) * 0.10
          : 0.23 + seededRandom(s + 5) * 0.12,
        strokeWidth: sw(s + 10, 1.4),
        fill: false,
        isAccent: false,
        dasharray: dash,
      });
    }

    // Layer 6: Decorative Dots & Shapes (filled)
    for (let i = 0; i < 14; i++) {
      const s = vo + 1500 + i * 13;
      const useAccent = seededRandom(s + 7) > 0.8;
      items.push({
        path: pick(SHAPES_DECORATIVE, s),
        x: seededRandom(s + 1) * TILE,
        y: seededRandom(s + 2) * TILE,
        rotation: seededRandom(s + 3) * 360,
        scale: 0.15 + seededRandom(s + 4) * 0.3,
        color: useAccent ? pickColor(s + 9) : pickColor(s + 11),
        opacity: useAccent
          ? isDark
            ? 0.40 + seededRandom(s + 5) * 0.18
            : 0.42 + seededRandom(s + 5) * 0.20
          : isDark
            ? 0.28 + seededRandom(s + 5) * 0.14
            : 0.30 + seededRandom(s + 5) * 0.16,
        strokeWidth: 0,
        fill: true,
        isAccent: false,
        dasharray: "",
      });
    }

    // Total ~= 116 elements per tile (just under 120 cap)
    return items;
  }, [variant, isDark, iconPool, accentPrimary, accentSecondary]);

  const tilesX = Math.ceil(width / TILE) + 1;
  const tilesY = Math.ceil(height / TILE) + 1;
  const svgW = tilesX * TILE;
  const svgH = tilesY * TILE;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg width={svgW} height={svgH}>
        <Defs>
          {/*
           * v14: glow filter for accent layer -- simulates the web v14
           * `filter: brightness/saturate` + `mixBlendMode: screen`.
           */}
          <Filter id="accentGlow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation="1.4" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>

          <Pattern
            id="doodlePattern"
            width={TILE}
            height={TILE}
            patternUnits="userSpaceOnUse"
          >
            {tileDoodles.map((d, i) => (
              <G
                key={i}
                transform={`translate(${d.x.toFixed(1)},${d.y.toFixed(1)}) rotate(${d.rotation.toFixed(1)}) scale(${d.scale.toFixed(2)})`}
                opacity={d.opacity}
                filter={d.isAccent ? "url(#accentGlow)" : undefined}
              >
                <Path
                  d={d.path}
                  transform="translate(-12,-12)"
                  fill={d.fill ? d.color : "none"}
                  stroke={d.fill ? "none" : d.color}
                  strokeWidth={d.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={d.dasharray || undefined}
                />
              </G>
            ))}
          </Pattern>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={svgW}
          height={svgH}
          fill="url(#doodlePattern)"
        />
      </Svg>

      {/*
       * Radial fade overlay -- v14 wider (60% transparent vs 45%) so doodles
       * stay visible across more of the screen before fading to bg.
       */}
      <LinearGradient
        colors={[
          "transparent",
          "transparent",
          isDark ? "rgba(10,10,15,0.45)" : "rgba(255,255,255,0.45)",
          isDark ? "#0a0a0f" : "#ffffff",
        ]}
        locations={[0, 0.6, 0.85, 1]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
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
