/**
 * @deepsight/lighting-engine — Types
 *
 * Toutes les interfaces partagées du moteur d'éclairage ambient.
 * Pas de dépendance externe : 100% TypeScript pur.
 */

/** RGB tuple, valeurs 0..255 */
export type RGB = readonly [number, number, number];

/** Type de rayon central */
export type BeamType = "sun" | "moon" | "twilight";

/** Densité d'étoiles 0..1 (0 = invisible, 1 = ciel étoilé profond) */
export type StarDensity = number;

/**
 * Une keyframe : un mood d'éclairage à une heure précise (toutes les 30 min).
 * 48 keyframes au total / 24h.
 */
export interface Keyframe {
  /** Format "HH:MM" — debug only */
  readonly time: string;
  /** Heure décimale 0..23.5 — clé d'identification */
  readonly hour: number;
  /** Nom poétique du mood (debug + marketing) */
  readonly mood: string;

  /** Rayon central (sun le jour, moon la nuit, twilight aux transitions) */
  readonly centralBeam: {
    readonly type: BeamType;
    readonly color: RGB;
    readonly opacity: number; // 0..1
    readonly angleDeg: number; // 0..360, base avant variation seedée
    readonly blurPx: number; // 0..40
  };

  /** Calques radiaux ambient (3 couleurs superposées) */
  readonly ambient: {
    readonly primary: RGB;
    readonly secondary: RGB;
    readonly tertiary: RGB;
    readonly primaryOpacity: number;
    readonly secondaryOpacity: number;
    readonly tertiaryOpacity: number;
  };

  /** Étoiles */
  readonly stars: {
    readonly density: StarDensity; // 0..1
    readonly opacity: number; // 0..1
  };

  /** Lune visible la nuit (sidebar / coin) */
  readonly moon: {
    readonly visible: boolean;
    readonly xPercent: number; // 0..100, position horizontale de référence
    readonly opacity: number; // 0..1
  };

  /** Soleil visible le jour (équivalent moon mais warm) */
  readonly sun: {
    readonly visible: boolean;
    readonly xPercent: number;
    readonly opacity: number;
  };

  /** Halo top du rayon central */
  readonly rayHalo: {
    readonly topOpacity: number;
  };
}

/**
 * Preset interpolé final, prêt à être consommé par AmbientLightLayer.
 * Toutes les valeurs sont issues d'une interpolation continue entre 2 keyframes
 * + variation seedée par jour.
 */
export interface AmbientPreset {
  /** Heure décimale au moment du calcul (0..23.999...) */
  readonly hour: number;
  /** Mood interpolé : "Lune haute → Heure du loup" */
  readonly mood: string;

  readonly centralBeam: {
    readonly type: BeamType;
    /** Couleur RGBA prête à injecter en CSS : "rgba(R, G, B, A)" */
    readonly cssColor: string;
    /** RGB raw pour platforms qui veulent recomposer */
    readonly rgb: RGB;
    readonly opacity: number;
    /** Angle final = angle base + variation seedée */
    readonly angleDeg: number;
    readonly blurPx: number;
  };

  readonly ambient: {
    readonly primary: RGB;
    readonly secondary: RGB;
    readonly tertiary: RGB;
    readonly primaryOpacity: number;
    readonly secondaryOpacity: number;
    readonly tertiaryOpacity: number;
    /** CSS gradient ready (web seulement, mobile recompose) */
    readonly cssGradient: string;
  };

  readonly stars: {
    readonly density: number;
    readonly opacity: number;
  };

  readonly moon: {
    readonly visible: boolean;
    readonly xPercent: number;
    readonly yPercent: number; // calculé via cosine trajectory
    readonly opacity: number;
  };

  readonly sun: {
    readonly visible: boolean;
    readonly xPercent: number;
    readonly yPercent: number;
    readonly opacity: number;
  };

  readonly rayHalo: {
    readonly topOpacity: number;
  };

  /** Métadonnées debug */
  readonly _debug: {
    readonly fromKeyframe: string;
    readonly toKeyframe: string;
    readonly factor: number; // 0..1 progression entre les 2 keyframes
    readonly seed: number; // seed du jour
    readonly angleVariation: number; // ± deg appliqué
    readonly computeTimeMs: number;
  };
}

/** Configuration optionnelle pour getAmbientPreset() */
export interface AmbientPresetOptions {
  /** Multiplicateur global d'intensité (default 1) */
  readonly intensityMul?: number;
  /** Override seed (testing) */
  readonly seedOverride?: number;
  /** Skip la variation jour-à-jour (testing) */
  readonly disableDailyVariation?: boolean;
  /** Skip le calcul des CSS strings (perf si on n'en a pas besoin) */
  readonly skipCssStrings?: boolean;
}
