import { WEBAPP_URL } from './utils/config';
import { extractVideoId } from './utils/youtube';
import { escapeHtml, markdownToSafeHtml, markdownToFullHtml, parseAnalysisToSummary } from './utils/sanitize';
import type { KeyPoint } from './utils/sanitize';

// ── State ──

let currentVideoId: string | null = null;
let injected = false;
let card: HTMLDivElement | null = null;
let injectionAttempts = 0;

// ── Constants ──

const SIDEBAR_SELECTORS = [
  '#secondary-inner',
  '#secondary',
  'ytd-watch-next-secondary-results-renderer',
];

const CATEGORY_ICON_MAP: Record<string, string> = {
  tech: '\u{1F4BB}', science: '\u{1F52C}', education: '\u{1F4DA}',
  news: '\u{1F4F0}', entertainment: '\u{1F3AC}', gaming: '\u{1F3AE}',
  music: '\u{1F3B5}', sports: '\u26BD', business: '\u{1F4BC}',
  lifestyle: '\u{1F31F}', other: '\u{1F4CB}',
};

// ── Theme Detection ──

function isDarkTheme(): boolean {
  const html = document.documentElement;
  return (
    html.getAttribute('dark') === 'true' ||
    html.hasAttribute('dark') ||
    document.body.classList.contains('dark') ||
    getComputedStyle(document.body).backgroundColor.includes('rgb(15,') ||
    getComputedStyle(html).getPropertyValue('--yt-spec-base-background').includes('#0f')
  );
}

// ── Timestamp Utilities ──

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

function seekVideo(seconds: number): void {
  const video = document.querySelector('video') as HTMLVideoElement | null;
  if (video) {
    video.currentTime = seconds;
    video.play();
  }
}

// ── Asset URLs ──

function assetUrl(path: string): string {
  return chrome.runtime.getURL(`assets/${path}`);
}

function logoImgHtml(size = 24): string {
  return `<img src="${assetUrl('deepsight-logo-cosmic.png')}" alt="DeepSight" width="${size}" height="${size}" style="object-fit:contain;border-radius:50%;" />`;
}

function spinnerHtml(size = 48): string {
  return `
    <div class="ds-deepsight-spinner" style="width:${size}px;height:${size}px;">
      <img src="${assetUrl('spinner-cosmic.jpg')}" alt="" class="ds-spinner-cosmic" />
      <img src="${assetUrl('spinner-wheel.jpg')}" alt="" class="ds-spinner-wheel" />
    </div>`;
}

function spinnerSmallHtml(): string {
  return `
    <div class="ds-deepsight-spinner ds-deepsight-spinner-sm">
      <img src="${assetUrl('spinner-wheel.jpg')}" alt="" class="ds-spinner-wheel" />
    </div>`;
}

// ── Create Card Shell ──

function createCard(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'deepsight-card';
  el.className = `deepsight-card ${isDarkTheme() ? 'dark' : 'light'}`;
  el.innerHTML = `
    <div class="ds-card-header">
      <div class="ds-card-logo">
        ${logoImgHtml(22)}
        <span>Deep Sight</span>
      </div>
      <span class="ds-card-badge">AI Analysis</span>
    </div>
    <div class="ds-card-body" id="deepsight-card-body">
      <div class="ds-loading">
        ${spinnerHtml(48)}
        <p class="ds-loading-text">Loading...</p>
      </div>
    </div>
  `;
  return el;
}

// ── Render: Login ──

function renderLogin(container: HTMLElement): void {
  container.innerHTML = `
    <p class="ds-subtitle">Analyze this video with AI-powered insights</p>

    <button class="ds-btn ds-btn-google" id="ds-google-login">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    </button>

    <div class="ds-divider"><span>or</span></div>

    <form id="ds-login-form" class="ds-login-form">
      <input type="email" id="ds-email" placeholder="Email" required />
      <input type="password" id="ds-password" placeholder="Password" required />
      <div id="ds-login-error" class="ds-error-msg hidden"></div>
      <button type="submit" class="ds-btn ds-btn-primary" id="ds-login-btn">Sign In</button>
    </form>

    <div class="ds-card-footer">
      <a href="${WEBAPP_URL}/register" target="_blank" rel="noreferrer">Create account</a>
      <span>\u00B7</span>
      <a href="${WEBAPP_URL}" target="_blank" rel="noreferrer">deepsightsynthesis.com</a>
    </div>
  `;

  document.getElementById('ds-google-login')?.addEventListener('click', async () => {
    const btn = document.getElementById('ds-google-login') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = `${spinnerSmallHtml()} Connecting...`;
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GOOGLE_LOGIN' });
      if (response.success && response.user) {
        await initCard();
      } else {
        throw new Error(response.error || 'Google login failed');
      }
    } catch (e) {
      const errorEl = document.getElementById('ds-login-error');
      if (errorEl) { errorEl.textContent = (e as Error).message; errorEl.classList.remove('hidden'); }
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google`;
    }
  });

  document.getElementById('ds-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('ds-email') as HTMLInputElement).value;
    const password = (document.getElementById('ds-password') as HTMLInputElement).value;
    const btn = document.getElementById('ds-login-btn') as HTMLButtonElement;
    const errorEl = document.getElementById('ds-login-error')!;

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.classList.add('hidden');

    try {
      const response = await chrome.runtime.sendMessage({ action: 'LOGIN', data: { email, password } });
      if (response.success && response.user) {
        await initCard();
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (err) {
      errorEl.textContent = (err as Error).message;
      errorEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

// ── Render: Authenticated ──

function renderAnalyzeReady(container: HTMLElement, user: { credits: number; plan: string; username: string }): void {
  container.innerHTML = `
    <div class="ds-user-bar">
      <span class="ds-user-name">${escapeHtml(user.username)}</span>
      <span class="ds-user-plan ds-plan-${escapeHtml(user.plan)}">${escapeHtml(user.plan)}</span>
      <span class="ds-user-credits">${user.credits} credits</span>
    </div>

    <button class="ds-btn ds-btn-analyze" id="ds-analyze-btn">
      \u{1F680} Analyze this video
    </button>

    <div class="ds-options-row">
      <select id="ds-mode" class="ds-select" title="Analysis mode">
        <option value="standard">\u{1F4CB} Standard</option>
        <option value="accessible">\u{1F4D6} Accessible</option>
        <option value="expert">\u{1F393} Expert</option>
      </select>
      <select id="ds-lang" class="ds-select" title="Language">
        <option value="fr">\u{1F1EB}\u{1F1F7} FR</option>
        <option value="en">\u{1F1EC}\u{1F1E7} EN</option>
        <option value="es">\u{1F1EA}\u{1F1F8} ES</option>
        <option value="de">\u{1F1E9}\u{1F1EA} DE</option>
      </select>
    </div>

    <div id="ds-result" class="hidden"></div>

    <div class="ds-card-footer">
      <a href="${WEBAPP_URL}" target="_blank" rel="noreferrer">\u{1F310} deepsightsynthesis.com</a>
      <button id="ds-logout" class="ds-link-btn">Sign out</button>
    </div>
  `;

  document.getElementById('ds-analyze-btn')?.addEventListener('click', () => {
    const mode = (document.getElementById('ds-mode') as HTMLSelectElement).value;
    const lang = (document.getElementById('ds-lang') as HTMLSelectElement).value;
    startAnalysis(window.location.href, { mode, lang });
  });

  document.getElementById('ds-logout')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'LOGOUT' });
    await initCard();
  });
}

// ── Progress ──

function renderProgress(message: string, progress: number): void {
  const result = document.getElementById('ds-result');
  if (!result) return;
  result.classList.remove('hidden');
  result.innerHTML = `
    <div class="ds-progress">
      <div class="ds-progress-bar" id="ds-progress-bar" style="width: ${progress}%"></div>
    </div>
    <p class="ds-progress-text" id="ds-progress-text">${escapeHtml(message)}</p>
  `;
}

// ── Analysis Flow ──

async function startAnalysis(url: string, options: { mode: string; lang: string }): Promise<void> {
  const analyzeBtn = document.getElementById('ds-analyze-btn') as HTMLButtonElement | null;
  if (!analyzeBtn) return;

  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = `${spinnerSmallHtml()} Analyzing...`;
  renderProgress('Starting analysis...', 0);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ANALYZE_VIDEO',
      data: { url, options },
    });

    if (!response.success) throw new Error(response.error);

    const result = response.result as {
      status: string;
      result?: { summary_id: number };
      error?: string;
    };

    if (result.status === 'completed' && result.result?.summary_id) {
      await displaySummary(result.result.summary_id);
    } else if (result.status === 'failed') {
      throw new Error(result.error || 'Analysis failed');
    }
  } catch (e) {
    const resultEl = document.getElementById('ds-result');
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="ds-error">
          <p>\u274C ${escapeHtml((e as Error).message)}</p>
          <button class="ds-btn ds-btn-secondary" id="ds-retry">Retry</button>
        </div>
      `;
      document.getElementById('ds-retry')?.addEventListener('click', () => startAnalysis(url, options));
    }
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '\u{1F680} Analyze this video';
  }
}

// ── Key Point Icon ──

function keyPointIcon(type: KeyPoint['type']): string {
  switch (type) {
    case 'solid': return '\u2705';
    case 'weak': return '\u26A0\uFE0F';
    case 'insight': return '\u{1F4A1}';
  }
}

// ── Timestamps ──

function processTimestamps(html: string): string {
  return html.replace(
    /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,
    (_match: string, ts: string) => {
      const seconds = parseTimestamp(ts);
      return `<a href="#" class="ds-timestamp" data-time="${seconds}">[${ts}]</a>`;
    },
  );
}

// ── Display Summary ──

async function displaySummary(summaryId: number): Promise<void> {
  const resultEl = document.getElementById('ds-result');
  const analyzeBtn = document.getElementById('ds-analyze-btn') as HTMLButtonElement | null;
  if (!resultEl) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_SUMMARY', data: { summaryId } });
    if (!response.success) throw new Error(response.error);

    const summary = response.summary as {
      category: string;
      reliability_score: number;
      summary_content: string;
      video_title: string;
    };

    const parsed = parseAnalysisToSummary(summary.summary_content);
    const detailedHtml = processTimestamps(markdownToFullHtml(escapeHtml(summary.summary_content)));
    const categoryIcon = CATEGORY_ICON_MAP[summary.category] || '\u{1F4CB}';
    const reliabilityIcon = summary.reliability_score >= 80 ? '\u2705' : summary.reliability_score >= 60 ? '\u26A0\uFE0F' : '\u2753';
    const scoreClass = summary.reliability_score >= 80 ? 'ds-score-high' : summary.reliability_score >= 60 ? 'ds-score-mid' : 'ds-score-low';

    const keyPointsHtml = parsed.keyPoints.length > 0
      ? parsed.keyPoints.map(kp =>
          `<div class="ds-kp ds-kp-${kp.type}">
            <span class="ds-kp-icon">${keyPointIcon(kp.type)}</span>
            <span class="ds-kp-text">${escapeHtml(kp.text)}</span>
          </div>`
        ).join('')
      : '';

    const tagsHtml = parsed.tags.length > 0
      ? `<div class="ds-tags">${parsed.tags.map(t => `<span class="ds-tag-pill">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    resultEl.innerHTML = `
      <div class="ds-summary ds-summary-fadein">
        <div class="ds-status-bar">
          <span class="ds-done">\u2705 Analysis Complete</span>
          <div class="ds-status-badges">
            <span class="ds-tag">${categoryIcon} ${escapeHtml(summary.category)}</span>
            <span class="ds-tag ${scoreClass}">${reliabilityIcon} ${summary.reliability_score}%</span>
          </div>
        </div>
        <div class="ds-verdict"><p class="ds-verdict-text">${escapeHtml(parsed.verdict)}</p></div>
        ${keyPointsHtml ? `<div class="ds-keypoints">${keyPointsHtml}</div>` : ''}
        ${tagsHtml}
        <button class="ds-toggle-detail" id="ds-toggle-detail">
          <span class="ds-toggle-text">See detailed analysis</span>
          <span class="ds-toggle-arrow">\u25BC</span>
        </button>
        <div class="ds-detail-panel hidden" id="ds-detail-panel">
          <div class="ds-detail-content" id="ds-summary-text">${detailedHtml}</div>
        </div>
        <div class="ds-share-actions">
          <button class="ds-btn ds-btn-outline" id="ds-copy-btn">
            \u{1F4CB} Copy
          </button>
          <button class="ds-btn ds-btn-outline" id="ds-share-btn">
            \u{1F517} Share
          </button>
        </div>
        <div class="ds-summary-actions">
          <a href="${WEBAPP_URL}/summary/${summaryId}" target="_blank" rel="noreferrer" class="ds-btn ds-btn-primary">
            \u{1F4D6} Full analysis on DeepSight
          </a>
          <button class="ds-btn ds-btn-secondary" id="ds-chat-btn">
            \u{1F4AC} Chat with video
          </button>
        </div>
      </div>
    `;

    const toggleBtn = document.getElementById('ds-toggle-detail');
    const detailPanel = document.getElementById('ds-detail-panel');
    toggleBtn?.addEventListener('click', () => {
      const isHidden = detailPanel?.classList.contains('hidden');
      detailPanel?.classList.toggle('hidden');
      const arrow = toggleBtn.querySelector('.ds-toggle-arrow');
      const text = toggleBtn.querySelector('.ds-toggle-text');
      if (arrow) arrow.textContent = isHidden ? '\u25B2' : '\u25BC';
      if (text) text.textContent = isHidden ? 'Hide detailed analysis' : 'See detailed analysis';
      toggleBtn.classList.toggle('ds-toggle-active', isHidden || false);
    });

    resultEl.querySelectorAll('.ds-timestamp').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        seekVideo(parseInt((el as HTMLElement).dataset.time || '0'));
      });
    });

    document.getElementById('ds-chat-btn')?.addEventListener('click', () => openChat(summaryId, summary.video_title));

    // Copy formatted text
    document.getElementById('ds-copy-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('ds-copy-btn');
      if (!btn) return;
      const keyPointsText = parsed.keyPoints.map((kp: KeyPoint) => `- ${kp.text}`).join('\n');
      const videoId = currentVideoId || '';
      let shareUrl = `${WEBAPP_URL}/summary/${summaryId}`;

      try {
        const res = await chrome.runtime.sendMessage({ action: 'SHARE_ANALYSIS', data: { videoId } });
        if (res.success && res.share_url) shareUrl = res.share_url;
      } catch { /* use fallback URL */ }

      const text = [
        `\u{1F3AF} DeepSight \u2014 AI Analysis`,
        ``,
        `\u{1F4F9} ${summary.video_title}`,
        `\u{1F3F7}\uFE0F Category: ${summary.category}`,
        `\u{1F4CA} Reliability: ${summary.reliability_score}%`,
        ``,
        `\u{1F4A1} ${parsed.verdict}`,
        ``,
        keyPointsText ? `Key points:\n${keyPointsText}` : '',
        ``,
        `\u{1F517} ${shareUrl}`,
        `\u2014`,
        `deepsightsynthesis.com`,
      ].filter(Boolean).join('\n');

      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '\u2705 Copied!';
        setTimeout(() => { btn.textContent = '\u{1F4CB} Copy'; }, 2000);
      } catch {
        btn.textContent = '\u274C Failed';
        setTimeout(() => { btn.textContent = '\u{1F4CB} Copy'; }, 2000);
      }
    });

    // Share link
    document.getElementById('ds-share-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('ds-share-btn');
      if (!btn) return;
      const videoId = currentVideoId || '';

      btn.textContent = '\u23F3 Loading...';
      try {
        const res = await chrome.runtime.sendMessage({ action: 'SHARE_ANALYSIS', data: { videoId } });
        if (!res.success) throw new Error(res.error);
        await navigator.clipboard.writeText(res.share_url);
        btn.textContent = '\u2705 Link copied!';
        setTimeout(() => { btn.textContent = '\u{1F517} Share'; }, 2000);
      } catch {
        btn.textContent = '\u274C Failed';
        setTimeout(() => { btn.textContent = '\u{1F517} Share'; }, 2000);
      }
    });

    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '\u{1F504} Re-analyze';
    }
  } catch (e) {
    resultEl.innerHTML = `<div class="ds-error"><p>\u274C Failed to load summary: ${escapeHtml((e as Error).message)}</p></div>`;
    if (analyzeBtn) { analyzeBtn.disabled = false; analyzeBtn.innerHTML = '\u{1F680} Analyze this video'; }
  }
}

// ── Chat ──

function openChat(summaryId: number, videoTitle: string): void {
  const resultEl = document.getElementById('ds-result');
  if (!resultEl) return;

  const truncated = videoTitle.length > 35 ? videoTitle.substring(0, 35) + '...' : videoTitle;

  resultEl.innerHTML = `
    <div class="ds-chat">
      <div class="ds-chat-head">
        <button class="ds-back" id="ds-chat-back">\u2190 Back</button>
        <span>Chat: \u201C${escapeHtml(truncated)}\u201D</span>
      </div>
      <div class="ds-chat-messages" id="ds-messages">
        <div class="ds-msg ds-msg-bot">\u{1F44B} Ask me anything about this video.</div>
      </div>
      <form class="ds-chat-form" id="ds-chat-form">
        <input type="text" id="ds-chat-input" placeholder="Ask a question..." autocomplete="off" />
        <button type="submit" class="ds-btn ds-btn-primary ds-btn-send">\u2192</button>
      </form>
    </div>
  `;

  document.getElementById('ds-chat-back')?.addEventListener('click', () => displaySummary(summaryId));

  document.getElementById('ds-chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('ds-chat-input') as HTMLInputElement;
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    await sendChatMessage(summaryId, q);
  });
}

async function sendChatMessage(summaryId: number, question: string): Promise<void> {
  const messages = document.getElementById('ds-messages');
  if (!messages) return;

  messages.innerHTML += `<div class="ds-msg ds-msg-user">${escapeHtml(question)}</div>`;
  messages.innerHTML += `<div class="ds-msg ds-msg-bot ds-loading" id="ds-chat-loading">${spinnerSmallHtml()}</div>`;
  messages.scrollTop = messages.scrollHeight;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ASK_QUESTION',
      data: { summaryId, question },
    });

    document.getElementById('ds-chat-loading')?.remove();
    if (!response.success) throw new Error(response.error);

    const result = response.result as { response: string; web_search_used: boolean };
    const safeHtml = markdownToSafeHtml(escapeHtml(result.response));

    messages.innerHTML += `
      <div class="ds-msg ds-msg-bot">
        ${safeHtml}
        ${result.web_search_used ? '<span class="ds-web-badge">\u{1F310} Web</span>' : ''}
      </div>
    `;
    messages.scrollTop = messages.scrollHeight;
  } catch (e) {
    document.getElementById('ds-chat-loading')?.remove();
    messages.innerHTML += `<div class="ds-msg ds-msg-error">\u274C ${escapeHtml((e as Error).message)}</div>`;
  }
}

// ── Card Init ──

async function initCard(): Promise<void> {
  const body = document.getElementById('deepsight-card-body');
  if (!body) return;

  body.innerHTML = `<div class="ds-loading">${spinnerHtml(48)}<p class="ds-loading-text">Loading...</p></div>`;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'CHECK_AUTH' });
    if (response.authenticated && response.user) {
      renderAnalyzeReady(body, response.user);
    } else {
      renderLogin(body);
    }
  } catch {
    renderLogin(body);
  }
}

// ── Injection Logic ──

function findSidebar(): HTMLElement | null {
  for (const selector of SIDEBAR_SELECTORS) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) return el;
  }
  return null;
}

function injectCard(): void {
  if (injected) return;
  if (document.getElementById('deepsight-card')) { injected = true; return; }

  const videoId = extractVideoId(window.location.href);
  if (!videoId) return;

  injectionAttempts++;
  const sidebar = findSidebar();

  if (sidebar) {
    card = createCard();
    if (sidebar.firstChild) {
      sidebar.insertBefore(card, sidebar.firstChild);
    } else {
      sidebar.appendChild(card);
    }
    injected = true;
    currentVideoId = videoId;
    initCard();
  } else if (injectionAttempts < 50) {
    const delay = Math.min(1000 * Math.pow(1.2, injectionAttempts), 5000);
    setTimeout(injectCard, delay);
  }
}

// ── Navigation ──

function onNavigate(): void {
  const videoId = extractVideoId(window.location.href);
  if (videoId !== currentVideoId) {
    injected = false;
    injectionAttempts = 0;
    card?.remove();
    card = null;
    if (videoId) setTimeout(injectCard, 1000);
  }
}

// ── Progress from Background ──

chrome.runtime.onMessage.addListener((message: { action: string; data?: { progress: number; message: string } }) => {
  if (message.action === 'ANALYSIS_PROGRESS' && message.data) {
    const bar = document.getElementById('ds-progress-bar') as HTMLElement | null;
    const text = document.getElementById('ds-progress-text');
    if (bar && text) {
      bar.style.width = `${message.data.progress}%`;
      text.textContent = message.data.message;
    }
  }
  return undefined;
});

// ── Init ──

function init(): void {
  injectCard();

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    setTimeout(onNavigate, 500);
  };

  window.addEventListener('popstate', () => setTimeout(onNavigate, 500));
  document.addEventListener('yt-navigate-finish', () => setTimeout(onNavigate, 500));
  document.addEventListener('yt-page-data-updated', () => {
    if (!injected) setTimeout(injectCard, 500);
  });

  new MutationObserver(() => {
    const dark = isDarkTheme();
    card?.classList.toggle('dark', dark);
    card?.classList.toggle('light', !dark);
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['dark', 'class'],
  });

  let injectionTimeout: ReturnType<typeof setTimeout>;
  new MutationObserver((mutations) => {
    if (injected) return;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0 && extractVideoId(window.location.href)) {
        clearTimeout(injectionTimeout);
        injectionTimeout = setTimeout(injectCard, 500);
        break;
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
