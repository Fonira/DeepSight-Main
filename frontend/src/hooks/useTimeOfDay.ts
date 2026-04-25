/**
 * useTimeOfDay — Hook qui calcule la phase de la journée (6 phases)
 *
 * Retourne une description riche pour piloter l'AmbientLightLayer :
 *   - phase    : aube / matin / midi / crépuscule / soir / nuit
 *   - haloX/Y  : position du halo principal (% écran)
 *   - couleurs RGB des trois calques (or/cyan/violet) + accent
 *   - moonVisible / moonX / moonOpacity (uniquement la nuit + crépuscule tardif)
 *   - intensityBoost : multiplicateur d'opacité pour étoiles + ambient
 *   - prefersReducedMotion : pour figer les transitions si l'OS le demande
 *
 * Recalcule toutes les 5 minutes via setInterval.
 *
 * Utilisation :
 *   const { phase, haloX, haloY, ambientPreset } = useTimeOfDay();
 */

import { useEffect, useState } from "react";

export type TimePhase =
  | "dawn" // 5h–8h aurore (rose/or chaud)
  | "morning" // 8h–12h dorée (or vif)
  | "noon" // 12h–17h éclat (or éclatant + cyan léger)
  | "dusk" // 17h–20h golden hour (orange + violet)
  | "evening" // 20h–23h nocturne (indigo + cyan)
  | "night"; // 23h–5h étoilée + clair de lune (cyan/violet, halo lunaire)

/** Couleurs RGB sous forme "r,g,b" — prêtes à insérer dans rgba(...) */
export interface AmbientColors {
  /** Halo dominant principal (haut de l'écran) */
  primary: string;
  /** Couleur secondaire — bottom-left */
  secondary: string;
  /** Couleur tertiaire — bottom-right */
  tertiary: string;
  /** Couleur des god rays (rayons obliques) */
  rays: string;
  /** Accent dominant pour la star color or */
  accent: string;
}

export interface AmbientPreset {
  /** Position X du halo principal (% horizontal, 0 = gauche, 100 = droite) */
  haloX: number;
  /** Position Y du halo principal (% vertical, négatif = au-dessus du viewport) */
  haloY: number;
  /** Couleurs RGB des calques */
  colors: AmbientColors;
  /** Opacité du calque ambient principal (gold/halo dominant) */
  ambientPrimary: number;
  /** Opacité du calque cyan (bottom-left) */
  ambientCyan: number;
  /** Opacité du calque violet (bottom-right) */
  ambientViolet: number;
  /** Opacité des god rays (rayons obliques) */
  rayOpacity: number;
  /** Opacité du halo top (trait dégradé du haut) */
  rayTopHalo: number;
  /** Multiplicateur d'opacité pour les étoiles (1 = défaut) */
  starOpacityMul: number;
  /** Densité des étoiles : 9 (normal) ou 14 (nuit) */
  starDensity: "normal" | "dense";
  /** Lune visible ? */
  moonVisible: boolean;
  /** Position X de la lune (% écran) — 0 à 100 */
  moonX: number;
  /** Position Y de la lune (% écran depuis le top) */
  moonY: number;
  /** Opacité de la lune (0 = invisible, 1 = pleinement visible) */
  moonOpacity: number;
}

export interface TimeOfDayValue {
  phase: TimePhase;
  /** Heure courante 0–23 */
  hour: number;
  /** Jour de la semaine — 0 = dimanche, 6 = samedi */
  dayOfWeek: number;
  /** True si on est samedi ou dimanche */
  isWeekend: boolean;
  /** Préréglage complet pour AmbientLightLayer */
  ambientPreset: AmbientPreset;
  /** True si l'utilisateur préfère un mouvement réduit */
  prefersReducedMotion: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Calcul de la phase à partir de l'heure
// ─────────────────────────────────────────────────────────────────

function computePhase(hour: number): TimePhase {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "noon";
  if (hour >= 17 && hour < 20) return "dusk";
  if (hour >= 20 && hour < 23) return "evening";
  return "night"; // 23h–5h
}

/**
 * Calcule un préréglage AmbientPreset pour une phase donnée.
 * Les opacités ont été renforcées (~+30%) pour que les phases
 * soient bien distinctes visuellement, conformément au brief.
 */
function computePreset(phase: TimePhase, hour: number): AmbientPreset {
  switch (phase) {
    case "dawn":
      // Aurore — rose terracotta + or chaud, halo top-left (sud-est cosmique)
      return {
        haloX: 28,
        haloY: -10,
        colors: {
          primary: "196,139,124", // rose terracotta
          secondary: "200,144,58", // or
          tertiary: "139,92,246", // violet doux résiduel de la nuit
          rays: "212,160,84", // or chaud
          accent: "212,160,84",
        },
        ambientPrimary: 0.24,
        ambientCyan: 0.07,
        ambientViolet: 0.12,
        rayOpacity: 0.22,
        rayTopHalo: 0.16,
        starOpacityMul: 0.5,
        starDensity: "normal",
        moonVisible: hour < 6,
        moonX: 75,
        moonY: 18,
        moonOpacity: hour < 6 ? 0.4 : 0,
      };

    case "morning":
      // Matin — or vif, halo top-center légèrement à droite
      return {
        haloX: 58,
        haloY: -8,
        colors: {
          primary: "212,160,84", // or vif
          secondary: "6,182,212", // cyan
          tertiary: "200,144,58", // or
          rays: "212,160,84",
          accent: "212,160,84",
        },
        ambientPrimary: 0.26,
        ambientCyan: 0.1,
        ambientViolet: 0.08,
        rayOpacity: 0.24,
        rayTopHalo: 0.18,
        starOpacityMul: 0.15,
        starDensity: "normal",
        moonVisible: false,
        moonX: 0,
        moonY: 0,
        moonOpacity: 0,
      };

    case "noon":
      // Midi — éclat or maximal + cyan léger, halo top-center
      return {
        haloX: 50,
        haloY: -12,
        colors: {
          primary: "232,180,100", // or éclatant
          secondary: "6,182,212", // cyan
          tertiary: "139,92,246", // violet doux
          rays: "232,180,100",
          accent: "232,180,100",
        },
        ambientPrimary: 0.3,
        ambientCyan: 0.13,
        ambientViolet: 0.08,
        rayOpacity: 0.27,
        rayTopHalo: 0.22,
        starOpacityMul: 0.05,
        starDensity: "normal",
        moonVisible: false,
        moonX: 0,
        moonY: 0,
        moonOpacity: 0,
      };

    case "dusk":
      // Crépuscule — golden hour, orange + violet, halo top-right
      return {
        haloX: 78,
        haloY: -10,
        colors: {
          primary: "251,146,60", // orange chaud
          secondary: "139,92,246", // violet
          tertiary: "196,139,124", // rose terracotta
          rays: "251,146,60",
          accent: "251,146,60",
        },
        ambientPrimary: 0.28,
        ambientCyan: 0.08,
        ambientViolet: 0.2,
        rayOpacity: 0.25,
        rayTopHalo: 0.2,
        starOpacityMul: 0.55,
        starDensity: "normal",
        moonVisible: hour >= 19,
        moonX: 18,
        moonY: 14,
        moonOpacity: hour >= 19 ? 0.55 : 0,
      };

    case "evening":
      // Soir — nocturne refroidi, indigo + cyan, halo top-center faible
      return {
        haloX: 50,
        haloY: -8,
        colors: {
          primary: "99,102,241", // indigo
          secondary: "6,182,212", // cyan
          tertiary: "139,92,246", // violet
          rays: "99,102,241",
          accent: "196,181,253", // lavande
        },
        ambientPrimary: 0.18,
        ambientCyan: 0.16,
        ambientViolet: 0.18,
        rayOpacity: 0.14,
        rayTopHalo: 0.12,
        starOpacityMul: 1.0,
        starDensity: "normal",
        moonVisible: true,
        moonX: 22,
        moonY: 12,
        moonOpacity: 0.75,
      };

    case "night":
    default: {
      // Nuit — clair de lune froid, halo lunaire bleuté, étoiles +30%
      // La lune se déplace de droite à gauche au cours de la nuit
      // (pour mimer le mouvement céleste)
      const isLateNight = hour >= 0 && hour < 5;
      const moonX = isLateNight
        ? 25 - (hour / 5) * 10 // 25% → 15% au cours de la nuit profonde
        : 78 - ((hour - 23) / 6) * 30; // 78% → ~ vers minuit
      return {
        haloX: 50,
        haloY: -15,
        colors: {
          primary: "186,230,253", // bleu lune froid (sky-200)
          secondary: "6,182,212", // cyan renforcé
          tertiary: "139,92,246", // violet renforcé
          rays: "186,230,253",
          accent: "232,234,237", // blanc-argenté pour étoiles
        },
        ambientPrimary: 0.16,
        ambientCyan: 0.18,
        ambientViolet: 0.2,
        rayOpacity: 0.06,
        rayTopHalo: 0.08,
        starOpacityMul: 1.4,
        starDensity: "dense",
        moonVisible: true,
        moonX: Math.max(10, Math.min(85, moonX)),
        moonY: 10,
        moonOpacity: 1,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────

const RECOMPUTE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function readNow(): { hour: number; dayOfWeek: number } {
  const now = new Date();
  return { hour: now.getHours(), dayOfWeek: now.getDay() };
}

function readPrefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function useTimeOfDay(): TimeOfDayValue {
  const [snapshot, setSnapshot] = useState(() => readNow());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    readPrefersReducedMotion(),
  );

  useEffect(() => {
    // Recalcule toutes les 5 minutes
    const id = window.setInterval(() => {
      setSnapshot(readNow());
    }, RECOMPUTE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    const onChange = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    setPrefersReducedMotion(mql.matches);
    // Compat anciens navigateurs (Safari < 14)
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql?.removeEventListener("change", onChange);
    } else if (typeof mql.addListener === "function") {
      mql.addListener(onChange);
      return () => mql?.removeListener(onChange);
    }
    return undefined;
  }, []);

  const phase = computePhase(snapshot.hour);
  const ambientPreset = computePreset(phase, snapshot.hour);

  return {
    phase,
    hour: snapshot.hour,
    dayOfWeek: snapshot.dayOfWeek,
    isWeekend: snapshot.dayOfWeek === 0 || snapshot.dayOfWeek === 6,
    ambientPreset,
    prefersReducedMotion,
  };
}

export default useTimeOfDay;
