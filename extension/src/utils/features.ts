/**
 * Interrupteurs de features de l'extension, figés au build.
 *
 * `voice` — appels vocaux ElevenLabs : bouton « Appeler la vidéo » injecté
 * sur YouTube, bouton d'appel du side panel, micro du chat et ouverture
 * directe d'un appel. Coupés pour la relance (budget minimum) tant que la
 * voix n'est pas rebranchée côté API. Pour les réactiver : passer `voice`
 * à `true`, `npm run build`, puis recharger l'extension.
 *
 * Objet mutable plutôt qu'une constante littérale : les tests activent la
 * voix le temps d'un `describe`. Le code lit donc `FEATURES.voice` au moment
 * du rendu ou de l'appel, jamais à l'import.
 */
export interface FeatureSwitches {
  voice: boolean;
}

export const FEATURES: FeatureSwitches = {
  voice: false,
};
