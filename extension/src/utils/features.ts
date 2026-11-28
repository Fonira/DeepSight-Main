import type { User } from "../types";

// Injecté par webpack (DefinePlugin) : `--env voice=off` le passe à false.
declare const __DS_VOICE__: boolean;

/**
 * Interrupteurs de features de l'extension.
 *
 * `voice` — le code des appels vocaux ElevenLabs est-il dans ce build ?
 * Vrai pour `npm run build` (dist/, l'extension chargée en local), faux pour
 * le zip du Chrome Web Store (`npm run package:cws`) tant que la fiche ne
 * déclare pas la voix. Même compilée, la voix ne s'affiche que si l'API la
 * déclare disponible : voir `isVoiceEnabled`.
 *
 * Objet mutable plutôt qu'une constante littérale : les tests basculent la
 * voix le temps d'un `describe`. Le code lit donc `FEATURES.voice` au moment
 * du rendu ou de l'appel, jamais à l'import.
 */
export interface FeatureSwitches {
  voice: boolean;
}

export const FEATURES: FeatureSwitches = {
  voice: typeof __DS_VOICE__ !== "undefined" ? __DS_VOICE__ : true,
};

/**
 * Voix utilisable : compilée dans ce build ET branchée côté API.
 *
 * `voice_available` est un champ calculé du user (login, refresh,
 * /auth/me) : clé ElevenLabs configurée, kill switch coupé. Une API plus
 * ancienne, sans ce champ, masque la voix. Bouton « Appeler la vidéo » sur
 * YouTube, bouton d'appel et micro du side panel suivent tous ce test.
 */
export function isVoiceEnabled(
  user: Pick<User, "voice_available"> | null | undefined,
): boolean {
  return FEATURES.voice && user?.voice_available === true;
}
