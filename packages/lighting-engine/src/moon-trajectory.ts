/**
 * @deepsight/lighting-engine — Moon & Sun Trajectory
 *
 * Calcule la position (xPercent, yPercent) de la lune et du soleil au cours
 * de la journée. Trajectoire en arc cosinusoïdal pour évoquer le déplacement
 * naturel d'un astre dans le ciel.
 *
 * Conventions :
 *   - xPercent : 0 = bord gauche, 100 = bord droit
 *   - yPercent : 0 = haut, 100 = bas (CSS-like)
 *   - L'astre est "haut" quand yPercent est petit
 */

/**
 * Position du soleil en fonction de l'heure.
 * - Lever 06:00 → coucher 19:00 (~13h de jour)
 * - Hors de cette plage : retourne yPercent > 100 (sous l'horizon)
 */
export function computeSunPosition(hourDecimal: number): {
  xPercent: number;
  yPercent: number;
  visible: boolean;
} {
  const sunrise = 6;
  const sunset = 19;
  if (hourDecimal < sunrise || hourDecimal > sunset) {
    return { xPercent: 50, yPercent: 110, visible: false };
  }

  // Progression 0..1 sur la durée du jour
  const t = (hourDecimal - sunrise) / (sunset - sunrise);

  // X linéaire de gauche à droite : lever à droite (75%) → coucher à gauche (25%)
  // Pour évoquer la position naturelle dans l'hémisphère nord
  const xPercent = 75 - t * 50;

  // Y en cosinus inversé : haut au midi, bas aux extrêmes
  // cos(0) = 1, cos(π) = -1 → on remap pour avoir yPercent 5 (zenith) à 85 (horizon)
  const yPercent = 5 + (1 - Math.sin(t * Math.PI)) * 80;

  return { xPercent, yPercent, visible: true };
}

/**
 * Position de la lune en fonction de l'heure.
 * - Lever 19:00 → coucher 07:00 (couvre 12h de nuit, wrap autour minuit)
 * - Hors de cette plage : retourne yPercent > 100
 */
export function computeMoonPosition(hourDecimal: number): {
  xPercent: number;
  yPercent: number;
  visible: boolean;
} {
  const moonrise = 19;
  const moonset = 7; // = 31 si on dépasse minuit

  // Heure normalisée pour gérer le wrap autour de minuit
  let hh = hourDecimal;
  if (hh < moonset) hh += 24;

  if (hh < moonrise || hh > moonrise + (24 - moonrise + moonset)) {
    return { xPercent: 50, yPercent: 110, visible: false };
  }

  const dayLength = 24 - moonrise + moonset; // 12h
  const t = (hh - moonrise) / dayLength; // 0..1

  // X : lever à gauche (25%) → coucher à droite (75%) — opposé au soleil
  const xPercent = 25 + t * 50;

  // Y en arc cosinusoïdal — haut autour de minuit-1h
  const yPercent = 8 + (1 - Math.sin(t * Math.PI)) * 75;

  return { xPercent, yPercent, visible: true };
}

/**
 * Pour le mode "sun-beam ↔ moon-beam" du PRD :
 * - Pendant twilight (5-7h et 17-19h), les deux astres peuvent être co-visibles
 * - On retourne les opacités complémentaires pour le cross-fade
 */
export function computeBeamBlend(hourDecimal: number): {
  sunOpacity: number;
  moonOpacity: number;
  twilightFactor: number; // 0 = pure jour ou nuit, 1 = pleine transition
} {
  // Twilight matin : 5h-7h
  if (hourDecimal >= 5 && hourDecimal < 7) {
    const t = (hourDecimal - 5) / 2; // 0..1
    return {
      moonOpacity: Math.cos((t * Math.PI) / 2), // 1 → 0
      sunOpacity: Math.sin((t * Math.PI) / 2), // 0 → 1
      twilightFactor: Math.sin(t * Math.PI), // 0 → 1 → 0
    };
  }
  // Twilight soir : 17h-19h
  if (hourDecimal >= 17 && hourDecimal < 19) {
    const t = (hourDecimal - 17) / 2;
    return {
      sunOpacity: Math.cos((t * Math.PI) / 2), // 1 → 0
      moonOpacity: Math.sin((t * Math.PI) / 2), // 0 → 1
      twilightFactor: Math.sin(t * Math.PI),
    };
  }
  // Pure jour : 7h-17h
  if (hourDecimal >= 7 && hourDecimal < 17) {
    return { sunOpacity: 1, moonOpacity: 0, twilightFactor: 0 };
  }
  // Pure nuit : 19h-5h
  return { sunOpacity: 0, moonOpacity: 1, twilightFactor: 0 };
}
