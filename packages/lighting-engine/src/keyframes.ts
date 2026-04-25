/**
 * @deepsight/lighting-engine — 48 Keyframes / 24h
 *
 * Une keyframe toutes les 30 minutes. Chaque keyframe définit un mood unique
 * avec ses couleurs, son angle de rayon central, ses opacités et étoiles.
 *
 * Le tableau est ordonné par heure croissante (0:00 → 23:30).
 * Chaque entrée est immutable (readonly) pour éviter les mutations accidentelles.
 *
 * 🎨 Pour modifier l'identité visuelle :
 *   - Changer une palette dans tokens.ts → impacte plusieurs keyframes
 *   - Ajuster une keyframe individuelle → impact très local
 */

import type { Keyframe } from "./types.js";
import { PALETTES } from "./tokens.js";

const P = PALETTES;

// Helper pour rester DRY
const kf = (
  hour: number,
  mood: string,
  beam: Keyframe["centralBeam"],
  ambient: Keyframe["ambient"],
  stars: Keyframe["stars"],
  moon: Keyframe["moon"],
  sun: Keyframe["sun"],
  rayHalo: Keyframe["rayHalo"],
): Keyframe => {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return {
    hour,
    time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    mood,
    centralBeam: beam,
    ambient,
    stars,
    moon,
    sun,
    rayHalo,
  };
};

/**
 * Les 48 keyframes / 24h. Indexé de 0 à 47.
 * Index N correspond à l'heure N × 0.5 (ex: index 28 = 14:00).
 */
export const KEYFRAMES: readonly Keyframe[] = [
  // ====================================================================
  // NUIT PROFONDE (00:00 → 04:30) — 10 keyframes — moon silver
  // ====================================================================
  kf(
    0.0,
    "Minuit profond",
    {
      type: "moon",
      color: P.moonDeep,
      opacity: 0.18,
      angleDeg: 135,
      blurPx: 14,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.22,
      secondaryOpacity: 0.1,
      tertiaryOpacity: 0.08,
    },
    { density: 1.0, opacity: 1.0 },
    { visible: true, xPercent: 50, opacity: 0.95 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    0.5,
    "Lune haute",
    {
      type: "moon",
      color: P.moonSilver,
      opacity: 0.2,
      angleDeg: 132,
      blurPx: 13,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.21,
      secondaryOpacity: 0.11,
      tertiaryOpacity: 0.09,
    },
    { density: 1.0, opacity: 1.0 },
    { visible: true, xPercent: 52, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.07 },
  ),

  kf(
    1.0,
    "Heure du loup",
    {
      type: "moon",
      color: P.moonSilver,
      opacity: 0.22,
      angleDeg: 128,
      blurPx: 12,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureViolet,
      tertiary: P.moonIce,
      primaryOpacity: 0.2,
      secondaryOpacity: 0.12,
      tertiaryOpacity: 0.1,
    },
    { density: 0.95, opacity: 0.98 },
    { visible: true, xPercent: 55, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.08 },
  ),

  kf(
    1.5,
    "Sommeil paradoxal",
    {
      type: "moon",
      color: P.moonSilver,
      opacity: 0.21,
      angleDeg: 125,
      blurPx: 12,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.19,
      secondaryOpacity: 0.11,
      tertiaryOpacity: 0.1,
    },
    { density: 0.9, opacity: 0.95 },
    { visible: true, xPercent: 58, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.07 },
  ),

  kf(
    2.0,
    "Silence d'argent",
    {
      type: "moon",
      color: P.moonSilver,
      opacity: 0.2,
      angleDeg: 122,
      blurPx: 13,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.18,
      secondaryOpacity: 0.1,
      tertiaryOpacity: 0.11,
    },
    { density: 0.9, opacity: 0.95 },
    { visible: true, xPercent: 60, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    2.5,
    "Nuit étoilée",
    {
      type: "moon",
      color: P.moonSilver,
      opacity: 0.19,
      angleDeg: 120,
      blurPx: 14,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.18,
      secondaryOpacity: 0.09,
      tertiaryOpacity: 0.12,
    },
    { density: 1.0, opacity: 1.0 },
    { visible: true, xPercent: 62, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    3.0,
    "Voile lunaire",
    {
      type: "moon",
      color: P.moonIce,
      opacity: 0.18,
      angleDeg: 118,
      blurPx: 14,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.17,
      secondaryOpacity: 0.08,
      tertiaryOpacity: 0.13,
    },
    { density: 0.95, opacity: 0.98 },
    { visible: true, xPercent: 65, opacity: 0.98 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.05 },
  ),

  kf(
    3.5,
    "Souffle nocturne",
    {
      type: "moon",
      color: P.moonIce,
      opacity: 0.17,
      angleDeg: 116,
      blurPx: 15,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.16,
      secondaryOpacity: 0.08,
      tertiaryOpacity: 0.12,
    },
    { density: 0.9, opacity: 0.95 },
    { visible: true, xPercent: 68, opacity: 0.95 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.05 },
  ),

  kf(
    4.0,
    "Avant l'aube",
    {
      type: "moon",
      color: P.moonIce,
      opacity: 0.16,
      angleDeg: 115,
      blurPx: 14,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonWarm,
      primaryOpacity: 0.16,
      secondaryOpacity: 0.09,
      tertiaryOpacity: 0.11,
    },
    { density: 0.85, opacity: 0.92 },
    { visible: true, xPercent: 70, opacity: 0.9 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.05 },
  ),

  kf(
    4.5,
    "Heure bleue",
    {
      type: "moon",
      color: P.moonIce,
      opacity: 0.15,
      angleDeg: 113,
      blurPx: 13,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.twilightDawn,
      primaryOpacity: 0.16,
      secondaryOpacity: 0.11,
      tertiaryOpacity: 0.1,
    },
    { density: 0.7, opacity: 0.85 },
    { visible: true, xPercent: 72, opacity: 0.8 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.05 },
  ),

  // ====================================================================
  // AUBE (05:00 → 06:30) — 4 keyframes — twilight rose-or
  // ====================================================================
  kf(
    5.0,
    "Premier souffle",
    {
      type: "twilight",
      color: P.twilightDawn,
      opacity: 0.14,
      angleDeg: 110,
      blurPx: 12,
    },
    {
      primary: P.ambientDay,
      secondary: P.twilightDawn,
      tertiary: P.twilightViolet,
      primaryOpacity: 0.18,
      secondaryOpacity: 0.13,
      tertiaryOpacity: 0.1,
    },
    { density: 0.5, opacity: 0.65 },
    { visible: true, xPercent: 75, opacity: 0.55 },
    { visible: true, xPercent: 80, opacity: 0.2 },
    { topOpacity: 0.07 },
  ),

  kf(
    5.5,
    "Aube naissante",
    {
      type: "twilight",
      color: P.twilightDawn,
      opacity: 0.16,
      angleDeg: 108,
      blurPx: 11,
    },
    {
      primary: P.ambientDay,
      secondary: P.twilightDawn,
      tertiary: P.signatureCyan,
      primaryOpacity: 0.2,
      secondaryOpacity: 0.16,
      tertiaryOpacity: 0.1,
    },
    { density: 0.3, opacity: 0.45 },
    { visible: true, xPercent: 78, opacity: 0.35 },
    { visible: true, xPercent: 78, opacity: 0.4 },
    { topOpacity: 0.1 },
  ),

  kf(
    6.0,
    "Premier rayon",
    {
      type: "twilight",
      color: P.sunRise,
      opacity: 0.2,
      angleDeg: 105,
      blurPx: 10,
    },
    {
      primary: P.twilightDawn,
      secondary: P.signatureCyan,
      tertiary: P.sunRise,
      primaryOpacity: 0.22,
      secondaryOpacity: 0.14,
      tertiaryOpacity: 0.13,
    },
    { density: 0.15, opacity: 0.25 },
    { visible: true, xPercent: 82, opacity: 0.18 },
    { visible: true, xPercent: 76, opacity: 0.65 },
    { topOpacity: 0.13 },
  ),

  kf(
    6.5,
    "Soleil naissant",
    {
      type: "twilight",
      color: P.sunRise,
      opacity: 0.23,
      angleDeg: 102,
      blurPx: 9,
    },
    {
      primary: P.sunRise,
      secondary: P.signatureCyan,
      tertiary: P.twilightDawn,
      primaryOpacity: 0.2,
      secondaryOpacity: 0.13,
      tertiaryOpacity: 0.14,
    },
    { density: 0.05, opacity: 0.1 },
    { visible: false, xPercent: 85, opacity: 0.05 },
    { visible: true, xPercent: 73, opacity: 0.85 },
    { topOpacity: 0.16 },
  ),

  // ====================================================================
  // MATIN (07:00 → 11:30) — 10 keyframes — sun gold
  // ====================================================================
  kf(
    7.0,
    "Lever doux",
    {
      type: "sun",
      color: P.sunMorning,
      opacity: 0.22,
      angleDeg: 100,
      blurPx: 9,
    },
    {
      primary: P.sunMorning,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.2,
      secondaryOpacity: 0.13,
      tertiaryOpacity: 0.12,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 70, opacity: 0.95 },
    { topOpacity: 0.18 },
  ),

  kf(
    7.5,
    "Matin clair",
    {
      type: "sun",
      color: P.sunMorning,
      opacity: 0.24,
      angleDeg: 98,
      blurPx: 9,
    },
    {
      primary: P.sunMorning,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.22,
      secondaryOpacity: 0.13,
      tertiaryOpacity: 0.11,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 67, opacity: 1.0 },
    { topOpacity: 0.19 },
  ),

  kf(
    8.0,
    "Lumière fraîche",
    {
      type: "sun",
      color: P.sunMorning,
      opacity: 0.25,
      angleDeg: 96,
      blurPx: 8,
    },
    {
      primary: P.sunMorning,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.23,
      secondaryOpacity: 0.14,
      tertiaryOpacity: 0.11,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 64, opacity: 1.0 },
    { topOpacity: 0.2 },
  ),

  kf(
    8.5,
    "Café du matin",
    {
      type: "sun",
      color: P.sunMorning,
      opacity: 0.25,
      angleDeg: 95,
      blurPx: 8,
    },
    {
      primary: P.sunMorning,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.24,
      secondaryOpacity: 0.14,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 61, opacity: 1.0 },
    { topOpacity: 0.2 },
  ),

  kf(
    9.0,
    "Plein matin",
    { type: "sun", color: P.sunNoon, opacity: 0.26, angleDeg: 93, blurPx: 8 },
    {
      primary: P.sunNoon,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.25,
      secondaryOpacity: 0.15,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 58, opacity: 1.0 },
    { topOpacity: 0.21 },
  ),

  kf(
    9.5,
    "Concentration",
    { type: "sun", color: P.sunNoon, opacity: 0.26, angleDeg: 92, blurPx: 8 },
    {
      primary: P.sunNoon,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.25,
      secondaryOpacity: 0.15,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 55, opacity: 1.0 },
    { topOpacity: 0.21 },
  ),

  kf(
    10.0,
    "Lumière du matin",
    { type: "sun", color: P.sunNoon, opacity: 0.27, angleDeg: 91, blurPx: 8 },
    {
      primary: P.sunNoon,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.25,
      secondaryOpacity: 0.16,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 52, opacity: 1.0 },
    { topOpacity: 0.22 },
  ),

  kf(
    10.5,
    "Avant midi",
    { type: "sun", color: P.sunNoon, opacity: 0.27, angleDeg: 91, blurPx: 8 },
    {
      primary: P.sunNoon,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.26,
      secondaryOpacity: 0.16,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 50, opacity: 1.0 },
    { topOpacity: 0.22 },
  ),

  kf(
    11.0,
    "Approche du zénith",
    { type: "sun", color: P.sunNoon, opacity: 0.27, angleDeg: 90, blurPx: 8 },
    {
      primary: P.sunNoon,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.26,
      secondaryOpacity: 0.16,
      tertiaryOpacity: 0.09,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 48, opacity: 1.0 },
    { topOpacity: 0.22 },
  ),

  kf(
    11.5,
    "Pré-zénith",
    { type: "sun", color: P.sunNoon, opacity: 0.28, angleDeg: 90, blurPx: 8 },
    {
      primary: P.sunNoon,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.27,
      secondaryOpacity: 0.17,
      tertiaryOpacity: 0.09,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 46, opacity: 1.0 },
    { topOpacity: 0.23 },
  ),

  // ====================================================================
  // MIDI / APRÈS-MIDI (12:00 → 16:30) — 10 keyframes — sun warm
  // ====================================================================
  kf(
    12.0,
    "Zénith",
    { type: "sun", color: P.sunNoon, opacity: 0.28, angleDeg: 90, blurPx: 8 },
    {
      primary: P.sunNoon,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.27,
      secondaryOpacity: 0.17,
      tertiaryOpacity: 0.09,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 44, opacity: 1.0 },
    { topOpacity: 0.23 },
  ),

  kf(
    12.5,
    "Pause déjeuner",
    { type: "sun", color: P.sunNoon, opacity: 0.27, angleDeg: 92, blurPx: 8 },
    {
      primary: P.sunNoon,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.26,
      secondaryOpacity: 0.17,
      tertiaryOpacity: 0.09,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 42, opacity: 1.0 },
    { topOpacity: 0.22 },
  ),

  kf(
    13.0,
    "Début d'après-midi",
    { type: "sun", color: P.sunGolden, opacity: 0.27, angleDeg: 94, blurPx: 8 },
    {
      primary: P.sunGolden,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.26,
      secondaryOpacity: 0.17,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 40, opacity: 1.0 },
    { topOpacity: 0.22 },
  ),

  kf(
    13.5,
    "Sieste impossible",
    { type: "sun", color: P.sunGolden, opacity: 0.27, angleDeg: 96, blurPx: 8 },
    {
      primary: P.sunGolden,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.26,
      secondaryOpacity: 0.16,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 38, opacity: 1.0 },
    { topOpacity: 0.21 },
  ),

  kf(
    14.0,
    "Reprise",
    { type: "sun", color: P.sunGolden, opacity: 0.26, angleDeg: 97, blurPx: 8 },
    {
      primary: P.sunGolden,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.25,
      secondaryOpacity: 0.16,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 36, opacity: 1.0 },
    { topOpacity: 0.2 },
  ),

  kf(
    14.5,
    "Pleine attention",
    { type: "sun", color: P.sunGolden, opacity: 0.26, angleDeg: 99, blurPx: 8 },
    {
      primary: P.sunGolden,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.25,
      secondaryOpacity: 0.15,
      tertiaryOpacity: 0.1,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 34, opacity: 1.0 },
    { topOpacity: 0.2 },
  ),

  kf(
    15.0,
    "Goûter d'or",
    {
      type: "sun",
      color: P.sunGolden,
      opacity: 0.25,
      angleDeg: 100,
      blurPx: 9,
    },
    {
      primary: P.sunGolden,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.24,
      secondaryOpacity: 0.15,
      tertiaryOpacity: 0.11,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 32, opacity: 1.0 },
    { topOpacity: 0.19 },
  ),

  kf(
    15.5,
    "Lumière oblique",
    {
      type: "sun",
      color: P.sunGolden,
      opacity: 0.25,
      angleDeg: 102,
      blurPx: 9,
    },
    {
      primary: P.sunGolden,
      secondary: P.signatureCyan,
      tertiary: P.signatureViolet,
      primaryOpacity: 0.24,
      secondaryOpacity: 0.14,
      tertiaryOpacity: 0.11,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 30, opacity: 1.0 },
    { topOpacity: 0.18 },
  ),

  kf(
    16.0,
    "Après-midi doré",
    { type: "sun", color: P.sunWarm, opacity: 0.24, angleDeg: 104, blurPx: 9 },
    {
      primary: P.sunWarm,
      secondary: P.signatureCyan,
      tertiary: P.twilightOrange,
      primaryOpacity: 0.23,
      secondaryOpacity: 0.14,
      tertiaryOpacity: 0.11,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 28, opacity: 1.0 },
    { topOpacity: 0.18 },
  ),

  kf(
    16.5,
    "Avant magic hour",
    { type: "sun", color: P.sunWarm, opacity: 0.24, angleDeg: 106, blurPx: 9 },
    {
      primary: P.sunWarm,
      secondary: P.signatureCyan,
      tertiary: P.twilightOrange,
      primaryOpacity: 0.23,
      secondaryOpacity: 0.13,
      tertiaryOpacity: 0.12,
    },
    { density: 0, opacity: 0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { visible: true, xPercent: 26, opacity: 1.0 },
    { topOpacity: 0.17 },
  ),

  // ====================================================================
  // CRÉPUSCULE (17:00 → 18:30) — 4 keyframes — twilight orange-violet
  // ====================================================================
  kf(
    17.0,
    "Magic hour",
    {
      type: "twilight",
      color: P.twilightOrange,
      opacity: 0.25,
      angleDeg: 108,
      blurPx: 10,
    },
    {
      primary: P.twilightOrange,
      secondary: P.twilightViolet,
      tertiary: P.signatureIndigo,
      primaryOpacity: 0.25,
      secondaryOpacity: 0.15,
      tertiaryOpacity: 0.13,
    },
    { density: 0.05, opacity: 0.1 },
    { visible: true, xPercent: 82, opacity: 0.2 },
    { visible: true, xPercent: 22, opacity: 0.85 },
    { topOpacity: 0.16 },
  ),

  kf(
    17.5,
    "Crépuscule chaud",
    {
      type: "twilight",
      color: P.twilightOrange,
      opacity: 0.23,
      angleDeg: 112,
      blurPx: 11,
    },
    {
      primary: P.twilightOrange,
      secondary: P.twilightMagenta,
      tertiary: P.signatureIndigo,
      primaryOpacity: 0.23,
      secondaryOpacity: 0.16,
      tertiaryOpacity: 0.14,
    },
    { density: 0.15, opacity: 0.3 },
    { visible: true, xPercent: 78, opacity: 0.45 },
    { visible: true, xPercent: 18, opacity: 0.55 },
    { topOpacity: 0.13 },
  ),

  kf(
    18.0,
    "Coucher de soleil",
    {
      type: "twilight",
      color: P.twilightMagenta,
      opacity: 0.2,
      angleDeg: 116,
      blurPx: 12,
    },
    {
      primary: P.twilightMagenta,
      secondary: P.twilightViolet,
      tertiary: P.signatureIndigo,
      primaryOpacity: 0.21,
      secondaryOpacity: 0.17,
      tertiaryOpacity: 0.15,
    },
    { density: 0.3, opacity: 0.5 },
    { visible: true, xPercent: 72, opacity: 0.65 },
    { visible: true, xPercent: 14, opacity: 0.3 },
    { topOpacity: 0.1 },
  ),

  kf(
    18.5,
    "Dernière lueur",
    {
      type: "twilight",
      color: P.twilightViolet,
      opacity: 0.18,
      angleDeg: 118,
      blurPx: 13,
    },
    {
      primary: P.twilightViolet,
      secondary: P.signatureIndigo,
      tertiary: P.moonWarm,
      primaryOpacity: 0.2,
      secondaryOpacity: 0.16,
      tertiaryOpacity: 0.13,
    },
    { density: 0.45, opacity: 0.7 },
    { visible: true, xPercent: 68, opacity: 0.8 },
    { visible: false, xPercent: 12, opacity: 0.1 },
    { topOpacity: 0.08 },
  ),

  // ====================================================================
  // SOIR / NUIT (19:00 → 23:30) — 10 keyframes — moon rising silver
  // ====================================================================
  kf(
    19.0,
    "Soir indigo",
    {
      type: "moon",
      color: P.twilightIndigo,
      opacity: 0.18,
      angleDeg: 120,
      blurPx: 13,
    },
    {
      primary: P.twilightIndigo,
      secondary: P.signatureViolet,
      tertiary: P.moonIce,
      primaryOpacity: 0.2,
      secondaryOpacity: 0.14,
      tertiaryOpacity: 0.12,
    },
    { density: 0.55, opacity: 0.78 },
    { visible: true, xPercent: 60, opacity: 0.9 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.07 },
  ),

  kf(
    19.5,
    "Lune levante",
    {
      type: "moon",
      color: P.moonWarm,
      opacity: 0.19,
      angleDeg: 122,
      blurPx: 13,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureViolet,
      tertiary: P.moonIce,
      primaryOpacity: 0.2,
      secondaryOpacity: 0.13,
      tertiaryOpacity: 0.12,
    },
    { density: 0.65, opacity: 0.85 },
    { visible: true, xPercent: 55, opacity: 0.95 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.07 },
  ),

  kf(
    20.0,
    "Soirée calme",
    {
      type: "moon",
      color: P.moonSilver,
      opacity: 0.2,
      angleDeg: 124,
      blurPx: 12,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.21,
      secondaryOpacity: 0.13,
      tertiaryOpacity: 0.11,
    },
    { density: 0.75, opacity: 0.9 },
    { visible: true, xPercent: 50, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    20.5,
    "Lecture du soir",
    {
      type: "moon",
      color: P.moonSilver,
      opacity: 0.21,
      angleDeg: 125,
      blurPx: 12,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.21,
      secondaryOpacity: 0.12,
      tertiaryOpacity: 0.11,
    },
    { density: 0.85, opacity: 0.93 },
    { visible: true, xPercent: 47, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    21.0,
    "Nuit posée",
    {
      type: "moon",
      color: P.moonSilver,
      opacity: 0.21,
      angleDeg: 127,
      blurPx: 12,
    },
    {
      primary: P.ambientNight,
      secondary: P.signatureIndigo,
      tertiary: P.moonIce,
      primaryOpacity: 0.2,
      secondaryOpacity: 0.11,
      tertiaryOpacity: 0.1,
    },
    { density: 0.9, opacity: 0.95 },
    { visible: true, xPercent: 45, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    21.5,
    "Tombée de la nuit",
    { type: "moon", color: P.moonSilver, opacity: 0.22, angleDeg: 128, blurPx: 12 },
    { primary: P.ambientNight, secondary: P.signatureIndigo, tertiary: P.moonIce, primaryOpacity: 0.21, secondaryOpacity: 0.11, tertiaryOpacity: 0.10 },
    { density: 0.95, opacity: 0.97 },
    { visible: true, xPercent: 42, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    22.0,
    "Calme nocturne",
    { type: "moon", color: P.moonSilver, opacity: 0.22, angleDeg: 130, blurPx: 13 },
    { primary: P.ambientNight, secondary: P.signatureIndigo, tertiary: P.moonIce, primaryOpacity: 0.21, secondaryOpacity: 0.10, tertiaryOpacity: 0.10 },
    { density: 1.0, opacity: 1.0 },
    { visible: true, xPercent: 40, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    22.5,
    "Lune pleine",
    { type: "moon", color: P.moonSilver, opacity: 0.21, angleDeg: 131, blurPx: 13 },
    { primary: P.ambientNight, secondary: P.signatureIndigo, tertiary: P.moonIce, primaryOpacity: 0.21, secondaryOpacity: 0.10, tertiaryOpacity: 0.10 },
    { density: 1.0, opacity: 1.0 },
    { visible: true, xPercent: 38, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    23.0,
    "Hypnagogique",
    { type: "moon", color: P.moonSilver, opacity: 0.20, angleDeg: 133, blurPx: 14 },
    { primary: P.ambientNight, secondary: P.signatureIndigo, tertiary: P.moonIce, primaryOpacity: 0.20, secondaryOpacity: 0.10, tertiaryOpacity: 0.09 },
    { density: 1.0, opacity: 1.0 },
    { visible: true, xPercent: 36, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),

  kf(
    23.5,
    "Nuit veloutée",
    { type: "moon", color: P.moonDeep, opacity: 0.19, angleDeg: 134, blurPx: 14 },
    { primary: P.ambientNight, secondary: P.signatureIndigo, tertiary: P.moonIce, primaryOpacity: 0.21, secondaryOpacity: 0.10, tertiaryOpacity: 0.09 },
    { density: 1.0, opacity: 1.0 },
    { visible: true, xPercent: 35, opacity: 1.0 },
    { visible: false, xPercent: 50, opacity: 0 },
    { topOpacity: 0.06 },
  ),
];

/**
 * Pour une heure décimale donnée, retourne :
 *  - la keyframe précédente (≤ hour)
 *  - la keyframe suivante (> hour, ou wrap autour de minuit)
 *  - le facteur de progression entre les 2 (0..1)
 */
export function findKeyframePair(hourDecimal: number): {
  from: Keyframe;
  to: Keyframe;
  factor: number;
} {
  const exactIndex = (hourDecimal % 24) * 2;
  const fromIndex = Math.floor(exactIndex) % 48;
  const toIndex = (fromIndex + 1) % 48;
  const factor = exactIndex - Math.floor(exactIndex);
  return {
    from: KEYFRAMES[fromIndex],
    to: KEYFRAMES[toIndex],
    factor,
  };
}

/**
 * Sanity check au build time : vérifie qu'on a bien 48 keyframes ordonnées.
 */
export function validateKeyframes(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (KEYFRAMES.length !== 48) {
    errors.push(`Expected 48 keyframes, got ${KEYFRAMES.length}`);
  }
  for (let i = 0; i < KEYFRAMES.length; i++) {
    const expectedHour = i * 0.5;
    if (Math.abs(KEYFRAMES[i].hour - expectedHour) > 0.001) {
      errors.push(`Keyframe ${i}: expected hour ${expectedHour}, got ${KEYFRAMES[i].hour}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
