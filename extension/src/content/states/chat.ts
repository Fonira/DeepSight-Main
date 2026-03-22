// ── État: chat inline ──

import { WEBAPP_URL } from '../../utils/config';
import { setWidgetBody, getWidgetBody } from '../widget';
import { escapeHtml, markdownToSafeHtml } from '../../utils/sanitize';
import { getSuggestions, bindSuggestionClicks } from '../suggestions';
import { ttsButtonHtml, ttsLockedButtonHtml, bindTTSButtons, isTTSPremium } from '../tts';
import type { ChatMessage } from '../../types';

let _chatHasTTS = false; // Cached TTS premium state for this chat session

interface ChatOptions {
  summaryId: number;
  videoTitle: string;
  category?: string;
  messages?: ChatMessage[];
  onBack?: () => void;
}

function spinnerSmall(): string {
  return `<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg>`;
}

function renderMessage(msg: ChatMessage): string {
  const cls = msg.role === 'user' ? 'ds-chat-msg-user' : 'ds-chat-msg-assistant';
  const content = msg.role === 'assistant'
    ? markdownToSafeHtml(escapeHtml(msg.content))
    : escapeHtml(msg.content);

  const webBadge = msg.web_search_used
    ? `<span style="font-size:10px;color:var(--ds-info);display:block;margin-top:3px">🌐 Recherche web utilisée</span>`
    : '';

  // TTS button for assistant messages
  const ttsHtml = msg.role === 'assistant' && msg.content.length > 20
    ? `<div style="margin-top:4px">${_chatHasTTS ? ttsButtonHtml(msg.content) : ttsLockedButtonHtml()}</div>`
    : '';

  return `<div class="ds-chat-msg ${cls}">${content}${webBadge}${ttsHtml}</div>`;
}

export async function renderChatState(opts: ChatOptions): Promise<void> {
  const { summaryId, videoTitle, category = 'default', messages = [], onBack } = opts;
  const suggestions = getSuggestions(category, 4);

  // Check TTS premium once per chat render
  _chatHasTTS = await isTTSPremium();

  const messagesHtml = messages.map(renderMessage).join('');
  const backBtn = onBack
    ? `<button class="ds-link-btn" id="ds-chat-back" type="button" style="font-size:11px;margin-bottom:4px">← Retour aux résultats</button>`
    : '';

  const html = `
    <div class="ds-chat-container ds-animate-fadeIn">
      ${backBtn}
      <div style="font-size:11px;color:var(--ds-text-muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(videoTitle)}">
        💬 Chat — ${escapeHtml(videoTitle)}
      </div>

      <div class="ds-chat-messages" id="ds-chat-messages">
        ${messagesHtml || `<div style="text-align:center;color:var(--ds-text-muted);font-size:11px;padding:16px 0">Posez une question sur cette vidéo</div>`}
      </div>

      ${messages.length === 0 ? `
        <div class="ds-chat-suggestions" id="ds-chat-suggestions">
          ${suggestions.map((s, i) => `<button class="ds-chat-suggestion" data-index="${i}" type="button">${escapeHtml(s)}</button>`).join('')}
        </div>
      ` : ''}

      <div class="ds-chat-input-row">
        <input
          type="text"
          id="ds-chat-input"
          class="ds-chat-input"
          placeholder="Posez une question..."
          autocomplete="off"
          maxlength="500"
        />
        <button class="ds-chat-send-btn" id="ds-chat-send" type="button" title="Envoyer">➤</button>
      </div>

      <div class="ds-card-footer" style="margin-top:6px">
        <a href="${WEBAPP_URL}/summary/${summaryId}" target="_blank" rel="noreferrer" style="font-size:11px">
          📖 Voir l'analyse complète
        </a>
        <span style="font-size:11px;color:var(--ds-text-muted)">Alt+C pour ouvrir</span>
      </div>
    </div>
  `;

  setWidgetBody(html);
  bindChatHandlers(summaryId, suggestions, onBack);
  bindTTSButtons();
  scrollChatToBottom();
}

function bindChatHandlers(summaryId: number, suggestions: string[], onBack?: () => void): void {
  onBack && document.getElementById('ds-chat-back')?.addEventListener('click', onBack);

  bindSuggestionClicks('ds-chat-suggestions', suggestions, (q) => {
    const input = document.getElementById('ds-chat-input') as HTMLInputElement | null;
    if (input) { input.value = q; sendMessage(summaryId); }
  });

  const input = document.getElementById('ds-chat-input') as HTMLInputElement | null;
  const sendBtn = document.getElementById('ds-chat-send');

  sendBtn?.addEventListener('click', () => sendMessage(summaryId));
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(summaryId);
    }
  });
}

function appendMessage(msg: ChatMessage): void {
  const container = document.getElementById('ds-chat-messages');
  if (!container) return;

  // Supprimer le message vide si présent
  const empty = container.querySelector('[style*="text-align:center"]');
  empty?.remove();

  const el = document.createElement('div');
  el.innerHTML = renderMessage(msg);
  const node = el.firstElementChild;
  if (node) container.appendChild(node);
  scrollChatToBottom();
}

function scrollChatToBottom(): void {
  requestAnimationFrame(() => {
    const container = document.getElementById('ds-chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  });
}

function setInputDisabled(disabled: boolean): void {
  const input = document.getElementById('ds-chat-input') as HTMLInputElement | null;
  const btn = document.getElementById('ds-chat-send') as HTMLButtonElement | null;
  if (input) input.disabled = disabled;
  if (btn) { btn.disabled = disabled; btn.innerHTML = disabled ? spinnerSmall() : '➤'; }
}

async function sendMessage(summaryId: number): Promise<void> {
  const input = document.getElementById('ds-chat-input') as HTMLInputElement | null;
  if (!input) return;

  const question = input.value.trim();
  if (!question) return;

  input.value = '';
  setInputDisabled(true);

  // Masquer les suggestions après premier message
  document.getElementById('ds-chat-suggestions')?.remove();

  appendMessage({ role: 'user', content: question });

  // Loading bubble
  const container = document.getElementById('ds-chat-messages');
  const loadingId = `ds-loading-${Date.now()}`;
  if (container) {
    const loadingEl = document.createElement('div');
    loadingEl.id = loadingId;
    loadingEl.className = 'ds-chat-msg ds-chat-msg-assistant';
    loadingEl.innerHTML = `${spinnerSmall()} En train de répondre...`;
    container.appendChild(loadingEl);
    scrollChatToBottom();
  }

  try {
    const resp = await chrome.runtime.sendMessage({
      action: 'ASK_QUESTION',
      data: { summaryId, question, options: {} },
    });

    document.getElementById(loadingId)?.remove();

    if (!resp?.success) throw new Error(resp?.error || 'Erreur de chat');

    const result = resp.result as { response: string; web_search_used?: boolean };
    appendMessage({
      role: 'assistant',
      content: result.response,
      web_search_used: result.web_search_used,
    });
    bindTTSButtons(); // Bind TTS on new assistant message
  } catch (e) {
    document.getElementById(loadingId)?.remove();
    appendMessage({ role: 'assistant', content: `❌ ${(e as Error).message}` });
  } finally {
    setInputDisabled(false);
    document.getElementById('ds-chat-input')?.focus();
  }
}
