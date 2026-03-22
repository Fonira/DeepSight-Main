// ── État: analyse en cours ──

import { setWidgetBody, getWidgetBody } from '../widget';
import { escapeHtml } from '../../utils/sanitize';

function spinnerHtml(): string {
  return `
    <div class="ds-gouvernail-spinner" style="width:48px;height:48px;">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <circle cx="24" cy="24" r="20" opacity="0.3"/>
        <circle cx="24" cy="24" r="3"/>
        <line x1="24" y1="4" x2="24" y2="11"/>
        <line x1="38.1" y1="9.9" x2="33.2" y2="14.8"/>
        <line x1="44" y1="24" x2="37" y2="24"/>
        <line x1="38.1" y1="38.1" x2="33.2" y2="33.2"/>
        <line x1="24" y1="44" x2="24" y2="37"/>
        <line x1="9.9" y1="38.1" x2="14.8" y2="33.2"/>
        <line x1="4" y1="24" x2="11" y2="24"/>
        <line x1="9.9" y1="9.9" x2="14.8" y2="14.8"/>
      </svg>
    </div>`;
}

export function renderAnalyzingState(message: string, progress: number): void {
  const html = `
    <div class="ds-analyzing-container">
      <div class="ds-loading" style="text-align:center;padding:16px 0">
        ${spinnerHtml()}
        <p class="ds-loading-text" id="ds-progress-text">${escapeHtml(message)}</p>
      </div>
      <div class="ds-progress" style="margin:8px 0">
        <div class="ds-progress-bar" id="ds-progress-bar" style="width:${progress}%"></div>
      </div>
    </div>
  `;
  setWidgetBody(html);
}

export function updateAnalyzingProgress(message: string, progress: number): void {
  const body = getWidgetBody();
  if (!body) return;
  const bar = body.querySelector<HTMLElement>('#ds-progress-bar');
  const text = body.querySelector<HTMLElement>('#ds-progress-text');
  if (bar) bar.style.width = `${progress}%`;
  if (text) text.textContent = message;
}
