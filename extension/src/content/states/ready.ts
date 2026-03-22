// ── État: ready (authentifié, en attente d'analyse) ──

import { WEBAPP_URL } from '../../utils/config';
import { setWidgetBody } from '../widget';
import { escapeHtml } from '../../utils/sanitize';
import type { TournesolData } from '../../types';

interface ReadyOptions {
  user: { username: string; plan: string; credits: number };
  tournesol: TournesolData | null;
  videoTitle: string;
  onAnalyze: (mode: string, lang: string) => void;
  onQuickChat: (lang: string) => void;
  onLogout: () => void;
}

function spinnerSmall(): string {
  return `<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg>`;
}

function tournesolBadgeHtml(tournesol: TournesolData | null): string {
  if (!tournesol?.found || tournesol.tournesol_score === null) return '';
  const score = Math.round(tournesol.tournesol_score);
  const color = score >= 50 ? 'var(--ds-success)' : score >= 0 ? 'var(--ds-warning)' : 'var(--ds-error)';
  return `<div class="ds-tournesol-badge" style="font-size:10px;color:${color};margin-top:4px">🌻 Tournesol: ${score > 0 ? '+' : ''}${score}</div>`;
}

export function renderReadyState(opts: ReadyOptions): void {
  const { user, tournesol, onAnalyze, onQuickChat, onLogout } = opts;

  const html = `
    <div class="ds-ready-container">
      <div class="ds-user-bar">
        <span class="ds-user-name">${escapeHtml(user.username)}</span>
        <span class="ds-user-plan ds-plan-${escapeHtml(user.plan)}">${escapeHtml(user.plan)}</span>
        <span class="ds-user-credits">${user.credits} crédits</span>
      </div>
      ${tournesolBadgeHtml(tournesol)}

      <button class="ds-btn ds-btn-analyze" id="ds-analyze-btn" type="button">
        🚀 Analyser cette vidéo
      </button>

      <button class="ds-btn ds-btn-quickchat" id="ds-quickchat-btn" type="button">
        💬 Quick Chat IA
      </button>

      <div class="ds-options-row">
        <select id="ds-mode" class="ds-select" title="Mode d'analyse">
          <option value="standard">📋 Standard</option>
          <option value="accessible">📖 Accessible</option>
          <option value="expert">🎓 Expert</option>
        </select>
        <select id="ds-lang" class="ds-select" title="Langue">
          <option value="fr">🇫🇷 FR</option>
          <option value="en">🇬🇧 EN</option>
          <option value="es">🇪🇸 ES</option>
          <option value="de">🇩🇪 DE</option>
        </select>
      </div>

      <div class="ds-card-footer">
        <a href="${WEBAPP_URL}" target="_blank" rel="noreferrer">🌐 deepsightsynthesis.com</a>
        <button id="ds-logout" class="ds-link-btn" type="button">Déconnexion</button>
      </div>
    </div>
  `;

  setWidgetBody(html);

  document.getElementById('ds-analyze-btn')?.addEventListener('click', () => {
    const mode = (document.getElementById('ds-mode') as HTMLSelectElement).value;
    const lang = (document.getElementById('ds-lang') as HTMLSelectElement).value;
    onAnalyze(mode, lang);
  });

  document.getElementById('ds-quickchat-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('ds-quickchat-btn') as HTMLButtonElement | null;
    const lang = (document.getElementById('ds-lang') as HTMLSelectElement)?.value || 'fr';
    if (btn) { btn.disabled = true; btn.innerHTML = `${spinnerSmall()} Préparation...`; }
    onQuickChat(lang);
  });

  document.getElementById('ds-logout')?.addEventListener('click', onLogout);
}
