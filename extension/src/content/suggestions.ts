// ── Chat suggestions (context-aware question starters) ──

const SUGGESTIONS_BY_CATEGORY: Record<string, string[]> = {
  tech: ['Quelles sont les principales technologies mentionnées ?', 'Quels sont les risques évoqués ?', 'Comment cela s\'applique-t-il concrètement ?', 'Quelles alternatives sont proposées ?'],
  science: ['Quelles sont les preuves scientifiques citées ?', 'Y a-t-il des biais dans cette étude ?', 'Qui sont les chercheurs impliqués ?', 'Quelles sont les limites de cette recherche ?'],
  education: ['Quels sont les points clés à retenir ?', 'Comment appliquer ces concepts ?', 'Y a-t-il des exercices pratiques suggérés ?', 'Quelles ressources complémentaires sont recommandées ?'],
  news: ['Quels sont les faits vérifiables ?', 'Quelles sources sont citées ?', 'Y a-t-il des éléments de contexte importants ?', 'Quels sont les différents points de vue ?'],
  default: ['Quel est le message principal de cette vidéo ?', 'Quels sont les points les plus importants ?', 'Y a-t-il des éléments à vérifier ?', 'Que recommande l\'auteur ?'],
};

// Bug #7: guard against concurrent suggestion loads
let _suggestionsLoading = false;

export function getSuggestions(category: string, count: number): string[] {
  const pool = SUGGESTIONS_BY_CATEGORY[category] ?? SUGGESTIONS_BY_CATEGORY['default'];
  return pool.slice(0, count);
}

export function renderSuggestions(suggestions: string[], _onSelect: () => void, id: string): string {
  if (suggestions.length === 0) return '';
  const items = suggestions
    .map((s, i) => `<button class="ds-chat-suggestion" data-index="${i}" type="button">${s}</button>`)
    .join('');
  return `<div class="ds-chat-suggestions" id="${id}">${items}</div>`;
}

export function bindSuggestionClicks(
  containerId: string,
  suggestions: string[],
  callback: (q: string) => void,
): void {
  if (_suggestionsLoading) return;
  const container = document.getElementById(containerId);
  if (!container) return;

  _suggestionsLoading = true;
  container.querySelectorAll('.ds-chat-suggestion').forEach((btn) => {
    const idx = parseInt((btn as HTMLElement).dataset.index ?? '0', 10);
    btn.addEventListener('click', () => {
      _suggestionsLoading = false;
      if (suggestions[idx]) callback(suggestions[idx]);
    });
  });
  _suggestionsLoading = false;
}
