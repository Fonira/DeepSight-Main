// ── État: ready (authentifié, en attente d'analyse) ──

import { WEBAPP_URL } from "../../utils/config";
import { setWidgetBody } from "../widget";
import { escapeHtml } from "../../utils/sanitize";
import { $id } from "../shadow";
import { detectTournesolExtension } from "../tournesol";
import type { TournesolData } from "../../types";

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
  if (!tournesol?.found || tournesol.tournesol_score === null) return "";
  const score = Math.round(tournesol.tournesol_score);
  const color =
    score >= 50
      ? "var(--ds-success)"
      : score >= 0
        ? "var(--ds-warning)"
        : "var(--ds-error)";
  const topMargin = detectTournesolExtension() ? "32px" : "4px";
  return `<div class="ds-tournesol-badge" style="font-size:10px;color:${color};margin-top:${topMargin}">🌻 Tournesol: ${score > 0 ? "+" : ""}${score}</div>`;
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

  $id("ds-analyze-btn")?.addEventListener("click", () => {
    const mode = $id<HTMLSelectElement>("ds-mode")!.value;
    const lang = $id<HTMLSelectElement>("ds-lang")!.value;
    onAnalyze(mode, lang);
  });

  $id("ds-quickchat-btn")?.addEventListener("click", async () => {
    const btn = $id<HTMLButtonElement>("ds-quickchat-btn");
    const lang = $id<HTMLSelectElement>("ds-lang")?.value || "fr";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `${spinnerSmall()} Préparation...`;
    }
    onQuickChat(lang);
  });

  $id("ds-logout")?.addEventListener("click", onLogout);
}
