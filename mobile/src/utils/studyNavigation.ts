/**
 * Navigation « Chat IA » depuis l'onglet Étude.
 *
 * Le chat d'une vidéo vit dans le Hub (mode chat). Avant, « Chat IA » ouvrait le détail
 * d'analyse avec initialTab "1", soit l'onglet Sources (onglets : Résumé, Sources,
 * Visuel, Chat).
 */
export function hubChatRoute(summaryId: string | number) {
  return {
    pathname: "/(tabs)/hub" as const,
    params: { summaryId: String(summaryId), initialMode: "chat" as const },
  };
}
