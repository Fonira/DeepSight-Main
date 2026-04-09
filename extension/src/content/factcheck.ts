// ── Fact-check helpers ──

export interface FactItem {
  text: string;
  icon: string;
}

export function parseFactsToVerify(facts: string[]): FactItem[] {
  return facts
    .filter((f) => f.trim().length > 0)
    .map((f) => ({ text: f.trim(), icon: '🔍' }));
}

export function renderFactCheckList(items: FactItem[], maxVisible = 3): string {
  if (items.length === 0) return '';
  const visible = items.slice(0, maxVisible);
  const rows = visible
    .map(
      (item) =>
        `<div class="ds-fact-item"><span class="ds-fact-icon">${item.icon}</span><span class="ds-fact-text">${item.text}</span></div>`,
    )
    .join('');
  return `<div class="ds-factcheck-list">${rows}</div>`;
}
