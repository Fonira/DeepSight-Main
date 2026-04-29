export type RGB = [number, number, number];
export type StarDensity = "sparse" | "dense";
export type BeamType = "sun" | "moon" | "twilight";
/**
 * v3 — Night sunflower mood:
 * - 'asleep'  : sunflower head down, brand accents glow softly (deep night)
 * - 'glowing' : sunflower transitioning, halo accents glow (twilight night)
 * - null      : daytime (no special night mode)
 */
export type NightMode = "asleep" | "glowing";
export interface KeyframeColors {
  primary: RGB;
  secondary: RGB;
  tertiary: RGB;
  rays: RGB;
  accent: RGB;
}
export interface Keyframe {
  hour: number;
  mood: string;
  beamType: BeamType;
  beamColor: RGB;
  beamAngleDeg: number;
  beamOpacity: number;
  sunVisible: boolean;
  sunOpacity: number;
  sunX: number;
  sunY: number;
  moonVisible: boolean;
  moonOpacity: number;
  moonX: number;
  moonY: number;
  ambientPrimary: number;
  ambientSecondary: number;
  ambientTertiary: number;
  starOpacityMul: number;
  starDensity: StarDensity;
  haloX: number;
  haloY: number;
  colors: KeyframeColors;
}
export interface BeamPreset {
  type: BeamType;
  color: RGB;
  cssColor?: string;
  angleDeg: number;
  opacity: number;
}
export interface DiscPreset {
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
}
export interface AmbientLayerPreset {
  primary: number;
  secondary: number;
  tertiary: number;
}
export interface ColorPalettePreset {
  primary: RGB;
  secondary: RGB;
  tertiary: RGB;
  rays: RGB;
  accent: RGB;
  cssPrimary?: string;
  cssSecondary?: string;
  cssTertiary?: string;
  cssRays?: string;
  cssAccent?: string;
}
export interface AmbientPreset {
  hour: number;
  mood: string;
  beam: BeamPreset;
  sun: DiscPreset;
  moon: DiscPreset;
  ambient: AmbientLayerPreset;
  starOpacityMul: number;
  starDensity: StarDensity;
  haloX: number;
  haloY: number;
  colors: ColorPalettePreset;
  debug?: {
    factor: number;
    fromMood: string;
    toMood: string;
    seed: number;
    angleVariation: number;
  };
  /** Sunflower sprite frame index (0..23, one per hour). Optional for v2 backward-compat. */
  frameIndex?: number;
  /** Night mood for sunflower & accents ('asleep' deep night | 'glowing' twilight night | null daytime). */
  nightMode?: NightMode | null;
  /** CSS color string for halo accents (brand mauve/violet) used at twilights. */
  haloAccentColor?: string;
  /** Whether reduced motion is active (snaps interpolation to nearest keyframe). */
  isReducedMotion?: boolean;
  /** Whether high contrast is active (caps reading-zone intensity). */
  isHighContrast?: boolean;
  /** Maximum intensity allowed in the reading zone (0..1). */
  readingZoneIntensityCap?: number;
}
/**
 * v3 preset shape with the v3-specific fields promoted to **required**.
 *
 * `getAmbientPresetV3` always emits these fields, so consumers (PR2 web,
 * PR3 mobile, PR4 extension) can rely on them without `?? defaultValue`
 * fallbacks scattered across call sites.
 *
 * `haloAccentColor` stays optional — it is only set at twilights & night.
 */
export interface AmbientPresetV3 extends AmbientPreset {
  frameIndex: number;
  nightMode: NightMode | null;
  haloAccentColor?: string;
  isReducedMotion: boolean;
  isHighContrast: boolean;
  readingZoneIntensityCap: number;
}
export interface PresetOptions {
  intensityMul?: number;
  disableDailyVariation?: boolean;
  skipCssStrings?: boolean;
  seedOverride?: number;
}
/**
 * Options accepted by `getAmbientPresetV3`.
 *
 * Distinct from the v2 `PresetOptions` because v3 ignores `disableDailyVariation`
 * and `seedOverride` (v3 has no daily seeded angle variation), and adds
 * `forceTime`/`forceNightMode` for testing & dev panels.
 */
export interface PresetOptionsV3 {
  intensityMul?: number;
  skipCssStrings?: boolean;
  /** Override the current time (testing / dev panel). When provided, replaces the `date` argument's clock. */
  forceTime?: Date;
  /** Force a specific night mode (testing / dev panel). When provided, overrides the computed nightMode. */
  forceNightMode?: NightMode | null;
}
