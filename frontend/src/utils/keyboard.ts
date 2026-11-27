/**
 * Raccourcis clavier globaux (window keydown) : ne jamais les déclencher
 * pendant que l'utilisateur tape dans un champ.
 *
 * Bug corrigé : sur /study, le paquet de flashcards captait Espace et Entrée
 * sur toute la page — dans la saisie du Tuteur les espaces disparaissaient
 * et Entrée retournait la carte au lieu d'envoyer le message.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
