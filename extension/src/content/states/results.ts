// ── État: résultats d'analyse ──

import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { setWidgetBody } from "../widget";
import {
  escapeHtml,
  markdownToFullHtml,
  parseAnalysisToSummary,
} from "../../utils/sanitize";
import type { KeyPoint } from "../../utils/sanitize";
import { parseFactsToVerify, renderFactCheckList } from "../factcheck";
import {
  getSuggestions,
  renderSuggestions,
  bindSuggestionClicks,
} from "../suggestions";
import {
  ttsButtonHtml,
  ttsLockedButtonHtml,
  ttsToolbarHtml,
  bindTTSButtons,
  bindTTSToolbar,
  isTTSPremium,
} from "../tts";
import { $id, $qsa } from "../shadow";

interface ResultsOptions {
  summary: {
    id: number;
    video_title: string;
    video_channel?: string;
    category: string;
    reliability_score: number;
    summary_content: string;
    facts_to_verify?: string[];
  };
  userPlan: string;
  onChat: (summaryId: number, title: string) => void;
  onCopyLink: () => void;
  onShare: () => void;
}

const PLAN_RANK: Record<string, number> = {
  free: 0,
  decouverte: 0,
  plus: 1,
  pro: 2,
  expert: 2,
  etudiant: 1,
  student: 1,
  starter: 1,
};
const CATEGORY_ICON: Record<string, string> = {
  tech: "💻",
  science: "🔬",
  education: "📚",
  news: "📰",
  entertainment: "🎬",
  gaming: "🎮",
  music: "🎵",
  sports: "⚽",
  business: "💼",
  lifestyle: "🌟",
  other: "📋",
};

function scoreClass(score: number): string {
  return score >= 80
    ? "ds-score-high"
    : score >= 60
      ? "ds-score-mid"
      : "ds-score-low";
}

function scoreIcon(score: number): string {
  return score >= 80 ? "✅" : score >= 60 ? "⚠️" : "❓";
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

function processTimestamps(html: string): string {
  return html.replace(
    /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,
    (_m, ts) =>
      `<a href="#" class="ds-timestamp" data-time="${parseTimestamp(ts)}">[${ts}]</a>`,
  );
}

function keyPointIcon(type: KeyPoint["type"]): string {
  return type === "solid" ? "✅" : type === "weak" ? "⚠️" : "💡";
}

function buildPremiumTeasers(userPlan: string): string {
  const userRank = PLAN_RANK[userPlan] ?? 0;
  const teasers = [
    { icon: "🃏", label: "Flashcards IA", minPlan: "pro", price: "5,99€" },
    { icon: "🧠", label: "Carte mentale", minPlan: "pro", price: "5,99€" },
    { icon: "🌐", label: "Recherche web IA", minPlan: "pro", price: "5,99€" },
    { icon: "📦", label: "Export PDF/DOCX", minPlan: "pro", price: "5,99€" },
  ].filter((t) => (PLAN_RANK[t.minPlan] ?? 0) > userRank);

  if (teasers.length === 0) {
    return `<div class="ds-teaser-pro-cta"><span>📱 Révisez sur mobile —</span><a href="${WEBAPP_URL}/mobile" target="_blank" rel="noreferrer" class="ds-teaser-link">Télécharger l'app</a></div>`;
  }

  const items = teasers
    .slice(0, 3)
    .map(
      (t) => `
    <a href="${WEBAPP_URL}/upgrade" target="_blank" rel="noreferrer" class="ds-teaser-item" title="Dès ${t.price}/mois">
      <span class="ds-teaser-icon">${t.icon}</span>
      <span class="ds-teaser-label">${t.label}</span>
      <span class="ds-teaser-lock">🔒</span>
      <span class="ds-teaser-price">${t.price}/m</span>
    </a>
  `,
    )
    .join("");

  return `
    <div class="ds-teasers-section">
      <div class="ds-teasers-title">✨ Débloquez plus</div>
      <div class="ds-teasers-grid">${items}</div>
      <a href="${WEBAPP_URL}/upgrade" target="_blank" rel="noreferrer" class="ds-teasers-all">Voir tous les plans →</a>
    </div>
  `;
}

function buildEcosystemBridge(summaryId: number): string {
  return `
    <div class="ds-ecosystem-bridge">
      <a href="${WEBAPP_URL}/summary/${summaryId}" target="_blank" rel="noreferrer" class="ds-bridge-link" title="Voir l'analyse complète sur le web">
        🌐 Web
      </a>
      <a href="https://apps.apple.com/app/deepsight/id6744066498" target="_blank" rel="noreferrer" class="ds-bridge-link" title="App iOS">
        🍎 iOS
      </a>
      <a href="https://play.google.com/store/apps/details?id=com.deepsight.app" target="_blank" rel="noreferrer" class="ds-bridge-link" title="App Android">
        🤖 Android
      </a>
      <a href="${WEBAPP_URL}/upgrade" target="_blank" rel="noreferrer" class="ds-bridge-link ds-bridge-upgrade">
        ⚡ Upgrade
      </a>
    </div>
  `;
}

export async function renderResultsState(opts: ResultsOptions): Promise<void> {
  const { summary, userPlan, onChat: _onChat } = opts;
  const parsed = parseAnalysisToSummary(summary.summary_content);
  const detailedHtml = processTimestamps(
    markdownToFullHtml(escapeHtml(summary.summary_content)),
  );
  const catIcon = CATEGORY_ICON[summary.category] ?? "📋";
  const sc = scoreClass(summary.reliability_score);
  const si = scoreIcon(summary.reliability_score);

  // TTS: check premium + build button
  const hasTTS = await isTTSPremium();
  const ttsBtn = hasTTS
    ? ttsButtonHtml(
        parsed.verdict || summary.summary_content.slice(0, 2000),
        "md",
      )
    : ttsLockedButtonHtml();
  const ttsToolbar = hasTTS ? ttsToolbarHtml() : "";

  const keyPointsHtml = parsed.keyPoints
    .map(
      (kp) =>
        `<div class="ds-kp ds-kp-${kp.type}">
      <span class="ds-kp-icon">${keyPointIcon(kp.type)}</span>
      <span class="ds-kp-text">${escapeHtml(kp.text)}</span>
    </div>`,
    )
    .join("");

  const tagsHtml =
    parsed.tags.length > 0
      ? `<div class="ds-tags">${parsed.tags.map((t) => `<span class="ds-tag-pill">${escapeHtml(t)}</span>`).join("")}</div>`
      : "";

  const factItems = parseFactsToVerify(summary.facts_to_verify ?? []);
  const factCheckHtml =
    factItems.length > 0
      ? `<div style="margin-top:8px">${renderFactCheckList(factItems, 2)}</div>`
      : "";

  const suggestions = getSuggestions(summary.category, 4);
  const suggestionsHtml = renderSuggestions(
    suggestions,
    () => {},
    "ds-results-suggestions",
  );

  const premiumHtml = buildPremiumTeasers(userPlan);
  const bridgeHtml = buildEcosystemBridge(summary.id);

  // ── Detailed section HTML (collapsed under <details>) ──
  const detailedSectionHtml = `
    ${keyPointsHtml ? `<div class="ds-keypoints ds-stagger">${keyPointsHtml}</div>` : ""}
    ${tagsHtml}
    ${factCheckHtml}

    <button class="ds-toggle-detail" id="ds-toggle-detail" type="button">
      <span class="ds-toggle-text">Voir l'analyse détaillée</span>
      <span class="ds-toggle-arrow">▼</span>
    </button>
    <div class="ds-detail-panel hidden" id="ds-detail-panel">
      <div class="ds-detail-content">${detailedHtml}</div>
    </div>

    <div class="ds-share-actions">
      <button class="ds-btn-outline" id="ds-copy-btn" type="button">📋 Copier</button>
    </div>

    ${suggestionsHtml}
    <div class="ds-premium-teasers">${premiumHtml}</div>
    ${bridgeHtml}

    <div class="ds-card-footer">
      <a href="${WEBAPP_URL}" target="_blank" rel="noreferrer">🌐 deepsightsynthesis.com</a>
    </div>
  `;

  // ── Compact results HTML ──
  const html = `
    <div class="ds-results-compact">
      <div class="ds-status-bar">
        <span class="ds-done">✅ Analyse prête</span>
        <div class="ds-status-badges">
          <span class="ds-tag">${catIcon} ${escapeHtml(summary.category)}</span>
          <span class="ds-tag ${sc}">${si} ${summary.reliability_score}%</span>
        </div>
      </div>

      <div class="ds-reliability-bar">
        <div class="ds-reliability-header">
          <span style="color:var(--ds-text-muted)">Fiabilité</span>
          <span class="${sc}" style="font-weight:600">${summary.reliability_score}/100</span>
        </div>
        <div class="ds-progress" style="height:6px">
          <div class="ds-progress-bar ds-fill-bar" data-score="${sc.replace("ds-score-", "")}"
               style="width:${summary.reliability_score}%;background:${summary.reliability_score >= 80 ? "var(--ds-success)" : summary.reliability_score >= 60 ? "var(--ds-warning)" : "var(--ds-error)"}">
          </div>
        </div>
      </div>

      <div class="ds-verdict-compact">
        <div class="ds-summary-tts-row">
          <p class="ds-verdict-text-compact" style="flex:1;margin:0">${escapeHtml(parsed.verdict)}</p>
          ${ttsBtn}
        </div>
      </div>
      ${ttsToolbar}

      <div class="ds-compact-actions">
        <button class="ds-btn-primary-xl" id="ds-open-fullscreen" type="button">
          🔍 Voir l'analyse complète
        </button>
        <button class="ds-btn-outline-xl" id="ds-share-btn" type="button">
          🔗 Partager cette analyse
        </button>
        <a href="${WEBAPP_URL}/summary/${summary.id}" target="_blank" rel="noreferrer" class="ds-link-tertiary">
          🌐 Ouvrir sur DeepSight Web ↗
        </a>
      </div>

      <details class="ds-details-wrapper">
        <summary class="ds-details-toggle">▸ Voir le détail ici</summary>
        <div class="ds-details-body">
          ${detailedSectionHtml}
        </div>
      </details>

      <button class="ds-btn-secondary-action" id="ds-chat-btn" type="button">
        💬 Chatter avec la vidéo
      </button>
    </div>
  `;

  setWidgetBody(html);
  bindResultsHandlers(summary, opts, suggestions);
  bindTTSButtons();
  if (hasTTS) bindTTSToolbar();
}

function bindResultsHandlers(
  summary: ResultsOptions["summary"],
  opts: ResultsOptions,
  suggestions: string[],
): void {
  // Open fullscreen viewer page
  $id("ds-open-fullscreen")?.addEventListener("click", () => {
    const viewerUrl = Browser.runtime.getURL(`viewer.html?id=${summary.id}`);
    Browser.tabs.create({ url: viewerUrl });
  });

  // Toggle détail (inside <details>)
  $id("ds-toggle-detail")?.addEventListener("click", () => {
    const panel = $id("ds-detail-panel");
    const btn = $id("ds-toggle-detail");
    if (!panel || !btn) return;
    const isHidden = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");
    const arrow = btn.querySelector(".ds-toggle-arrow");
    const text = btn.querySelector(".ds-toggle-text");
    if (arrow) arrow.textContent = isHidden ? "▲" : "▼";
    if (text)
      text.textContent = isHidden
        ? "Masquer l'analyse"
        : "Voir l'analyse détaillée";
  });

  // Timestamps — note: video element is in the main document, not shadow
  $qsa(".ds-timestamp").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const t = parseInt((el as HTMLElement).dataset.time ?? "0", 10);
      const video = document.querySelector("video") as HTMLVideoElement | null;
      if (video) {
        video.currentTime = t;
        video.play();
      }
    });
  });

  // Chat button
  $id("ds-chat-btn")?.addEventListener("click", () => {
    opts.onChat(summary.id, summary.video_title);
  });

  // Suggestions → open chat
  bindSuggestionClicks("ds-results-suggestions", suggestions, (q) => {
    opts.onChat(summary.id, summary.video_title);
    // Message auto envoyé dans renderChatState
    setTimeout(() => {
      const input = $id<HTMLInputElement>("ds-chat-input");
      if (input) {
        input.value = q;
        $id("ds-chat-send")?.click();
      }
    }, 100);
  });

  // Copy
  $id("ds-copy-btn")?.addEventListener("click", opts.onCopyLink);

  // Share
  $id("ds-share-btn")?.addEventListener("click", opts.onShare);
}
