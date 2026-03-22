// ── Content Script — Point d'entrée modulaire ──
// Remplace l'ancien content.ts monolithique (852 lignes)

import { extractVideoId, detectCurrentPagePlatform } from '../utils/video';
import { addRecentAnalysis } from '../utils/storage';
import { escapeHtml } from '../utils/sanitize';
import { WEBAPP_URL } from '../utils/config';

import { watchNavigation, isVideoPage, getCurrentVideoId } from './navigation';
import { detectTheme, watchTheme } from './theme';
import {
  createWidgetShell,
  injectWidget,
  removeWidget,
  getExistingWidget,
  buildWidgetHeader,
  bindMinimizeButton,
  setWidgetBody,
  getWidgetBody,
} from './widget';
import { fetchTournesolScore } from './tournesol';

import { renderLoginState } from './states/login';
import { renderReadyState } from './states/ready';
import { renderAnalyzingState, updateAnalyzingProgress } from './states/analyzing';
import { renderResultsState } from './states/results';
import { renderChatState } from './states/chat';

import type { Summary, User, PlanInfo, TournesolData } from '../types';

// ── State Machine ──

type AppState = 'login' | 'ready' | 'analyzing' | 'results' | 'chat';

interface AppContext {
  state: AppState;
  videoId: string | null;
  user: User | null;
  planInfo: PlanInfo | null;
  summary: Summary | null;
  tournesol: TournesolData | null;
  injected: boolean;
  injectionAttempts: number;
}

const ctx: AppContext = {
  state: 'login',
  videoId: null,
  user: null,
  planInfo: null,
  summary: null,
  tournesol: null,
  injected: false,
  injectionAttempts: 0,
};

function assetUrl(p: string): string {
  return chrome.runtime.getURL(`assets/${p}`);
}

function logoImgHtml(size = 22): string {
  return `<img src="${assetUrl('deepsight-logo-cosmic.png')}" alt="DeepSight" width="${size}" height="${size}" style="object-fit:contain;border-radius:50%;" />`;
}

// ── Widget injection avec retry ──

function tryInjectWidget(): void {
  if (ctx.injected && getExistingWidget()) return;
  if (ctx.injectionAttempts > 20) return;

  ctx.injectionAttempts++;

  const platform = detectCurrentPagePlatform();
  const isTikTok = platform === 'tiktok';
  const theme = detectTheme();

  const widget = createWidgetShell(theme, isTikTok);
  widget.innerHTML = buildWidgetHeader(logoImgHtml(22));
  const body = document.createElement('div');
  body.className = 'ds-card-body';
  body.innerHTML = `<div class="ds-loading"><div style="color:var(--ds-gold-mid)">⏳</div><p class="ds-loading-text">Chargement...</p></div>`;
  widget.appendChild(body);

  const success = injectWidget(widget, isTikTok);
  if (success) {
    ctx.injected = true;
    ctx.injectionAttempts = 0;
    bindMinimizeButton();
    // Watch theme changes
    watchTheme((t) => {
      const w = getExistingWidget();
      if (w) { w.classList.remove('dark', 'light'); w.classList.add(t); }
    });
    initCard();
  } else {
    setTimeout(tryInjectWidget, 500);
  }
}

// ── Initialisation principale ──

async function initCard(): Promise<void> {
  try {
    const authResp = await chrome.runtime.sendMessage({ action: 'CHECK_AUTH' });

    if (!authResp?.authenticated) {
      ctx.state = 'login';
      ctx.user = null;
      renderLoginState(() => initCard());
      return;
    }

    ctx.user = authResp.user ?? null;

    // Fetch plan info (non-bloquant)
    chrome.runtime.sendMessage({ action: 'GET_PLAN' }).then((resp) => {
      if (resp?.success) ctx.planInfo = resp.plan ?? null;
    }).catch(() => {});

    // Fetch Tournesol score (non-bloquant)
    if (ctx.videoId) {
      fetchTournesolScore(ctx.videoId).then((data) => {
        ctx.tournesol = data;
        // Mettre à jour le widget si en état ready
        if (ctx.state === 'ready' && ctx.user) {
          renderReadyState({
            user: { username: ctx.user.username, plan: ctx.user.plan, credits: ctx.user.credits },
            tournesol: ctx.tournesol,
            videoTitle: getVideoTitle(),
            onAnalyze: (mode, lang) => startAnalysis(mode, lang),
            onQuickChat: (lang) => handleQuickChat(lang),
            onLogout: handleLogout,
          });
        }
      }).catch(() => {});
    }

    ctx.state = 'ready';
    renderReadyState({
      user: { username: ctx.user!.username, plan: ctx.user!.plan, credits: ctx.user!.credits },
      tournesol: ctx.tournesol,
      videoTitle: getVideoTitle(),
      onAnalyze: (mode, lang) => startAnalysis(mode, lang),
      onQuickChat: (lang) => handleQuickChat(lang),
      onLogout: handleLogout,
    });
  } catch (err) {
    showError(`Erreur d'initialisation: ${(err as Error).message}`);
  }
}

function getVideoTitle(): string {
  // YouTube: titre dans le DOM
  const el =
    document.querySelector('ytd-watch-metadata h1 yt-formatted-string') ??
    document.querySelector('h1.title') ??
    document.querySelector('meta[name="title"]');
  if (el instanceof HTMLMetaElement) return el.content;
  return el?.textContent?.trim() ?? '';
}

// ── Analyse ──

async function startAnalysis(mode: string, lang: string): Promise<void> {
  if (!ctx.videoId) return;

  ctx.state = 'analyzing';
  renderAnalyzingState('Démarrage de l\'analyse...', 0);

  const url = window.location.href;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ANALYZE_VIDEO',
      data: { url, options: { mode, lang, category: 'auto' } },
    });

    if (!response?.success) throw new Error(response?.error || 'Analyse échouée');

    const result = response.result as {
      status: string;
      result?: { summary_id: number; video_title?: string };
      error?: string;
    };

    if (result.status === 'completed' && result.result?.summary_id) {
      await displaySummary(result.result.summary_id);
    } else if (result.status === 'failed') {
      throw new Error(result.error ?? 'Analyse échouée');
    }
  } catch (e) {
    ctx.state = 'ready';
    showError((e as Error).message);
    // Retour à l'état ready après 3s
    setTimeout(() => {
      if (ctx.user) {
        renderReadyState({
          user: { username: ctx.user!.username, plan: ctx.user!.plan, credits: ctx.user!.credits },
          tournesol: ctx.tournesol,
          videoTitle: getVideoTitle(),
          onAnalyze: startAnalysis,
          onQuickChat: handleQuickChat,
          onLogout: handleLogout,
        });
      }
    }, 3000);
  }
}

async function displaySummary(summaryId: number): Promise<void> {
  const resp = await chrome.runtime.sendMessage({ action: 'GET_SUMMARY', data: { summaryId } });
  if (!resp?.success) throw new Error(resp?.error || 'Récupération analyse échouée');

  ctx.summary = resp.summary as Summary;
  ctx.state = 'results';

  // Enregistrer dans historique local
  if (ctx.videoId) {
    await addRecentAnalysis({
      videoId: ctx.videoId,
      summaryId: ctx.summary!.id,
      title: ctx.summary!.video_title,
    });
  }

  await renderResultsState({
    summary: ctx.summary!,
    userPlan: ctx.user?.plan ?? 'free',
    onChat: openChat,
    onCopyLink: handleCopy,
    onShare: handleShare,
  });
}

// ── Quick Chat ──

async function handleQuickChat(lang: string): Promise<void> {
  try {
    const resp = await chrome.runtime.sendMessage({
      action: 'QUICK_CHAT',
      data: { url: window.location.href, lang },
    });

    if (!resp?.success) throw new Error(resp?.error || 'Quick Chat échoué');

    const result = resp.result as { summary_id: number; video_title: string };
    openChat(result.summary_id, result.video_title);
  } catch (e) {
    showError((e as Error).message);
    // Re-enable button
    const btn = document.getElementById('ds-quickchat-btn') as HTMLButtonElement | null;
    if (btn) { btn.disabled = false; btn.innerHTML = '💬 Quick Chat IA'; }
  }
}

// ── Chat ──

async function openChat(summaryId: number, title: string): Promise<void> {
  ctx.state = 'chat';

  // Charger l'historique
  let messages = [];
  try {
    const histResp = await chrome.runtime.sendMessage({ action: 'GET_CHAT_HISTORY', data: { summaryId } });
    if (histResp?.success && Array.isArray(histResp.result)) {
      messages = histResp.result;
    }
  } catch { /* historique non critique */ }

  await renderChatState({
    summaryId,
    videoTitle: title,
    category: ctx.summary?.category ?? 'default',
    messages,
    onBack: ctx.summary
      ? () => {
          ctx.state = 'results';
          renderResultsState({
            summary: ctx.summary!,
            userPlan: ctx.user?.plan ?? 'free',
            onChat: openChat,
            onCopyLink: handleCopy,
            onShare: handleShare,
          });
        }
      : undefined,
  });
}

// ── Copy ──

async function handleCopy(): Promise<void> {
  if (!ctx.summary) return;
  const btn = document.getElementById('ds-copy-btn');
  if (!btn) return;

  let shareUrl = `${WEBAPP_URL}/summary/${ctx.summary.id}`;
  try {
    const res = await chrome.runtime.sendMessage({
      action: 'SHARE_ANALYSIS',
      data: { videoId: ctx.videoId },
    });
    if (res?.success && res.share_url) shareUrl = res.share_url;
  } catch { /* use fallback */ }

  const text = [
    `🎯 DeepSight — Analyse IA`,
    ``,
    `📹 ${ctx.summary.video_title}`,
    `🏷️ Catégorie: ${ctx.summary.category}`,
    `📊 Fiabilité: ${ctx.summary.reliability_score}%`,
    ``,
    `🔗 ${shareUrl}`,
    `—`,
    `deepsightsynthesis.com`,
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '✅ Copié!';
    setTimeout(() => { btn.textContent = '📋 Copier'; }, 2000);
  } catch {
    btn.textContent = '❌ Échec';
    setTimeout(() => { btn.textContent = '📋 Copier'; }, 2000);
  }
}

// ── Share ──

async function handleShare(): Promise<void> {
  if (!ctx.summary) return;
  const btn = document.getElementById('ds-share-btn');
  if (!btn) return;

  try {
    const res = await chrome.runtime.sendMessage({
      action: 'SHARE_ANALYSIS',
      data: { videoId: ctx.videoId },
    });
    const url = res?.success ? res.share_url : `${WEBAPP_URL}/summary/${ctx.summary.id}`;
    await navigator.clipboard.writeText(url as string);
    btn.textContent = '✅ Lien copié!';
    setTimeout(() => { btn.textContent = '🔗 Partager'; }, 2000);
  } catch {
    btn.textContent = '❌ Échec';
    setTimeout(() => { btn.textContent = '🔗 Partager'; }, 2000);
  }
}

// ── Logout ──

async function handleLogout(): Promise<void> {
  await chrome.runtime.sendMessage({ action: 'LOGOUT' });
  ctx.user = null;
  ctx.planInfo = null;
  ctx.summary = null;
  ctx.tournesol = null;
  ctx.state = 'login';
  renderLoginState(() => initCard());
}

// ── Error display ──

function showError(message: string): void {
  const body = getWidgetBody();
  if (!body) return;
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'padding:8px 12px;background:var(--ds-error-bg);border-radius:8px;font-size:11px;color:var(--ds-error);margin-top:8px';
  errorDiv.textContent = `❌ ${message}`;
  body.appendChild(errorDiv);
}

// ── Navigation handler ──

async function onNavigate(videoId: string | null): Promise<void> {
  // Reset state
  ctx.videoId = videoId;
  ctx.summary = null;
  ctx.tournesol = null;
  ctx.state = 'login';
  ctx.injected = false;
  ctx.injectionAttempts = 0;

  removeWidget();

  if (!videoId || !isVideoPage()) return;

  // Délai pour laisser le DOM YouTube se mettre en place
  setTimeout(tryInjectWidget, 800);
}

// ── Message listener (from background / popup) ──

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'ANALYSIS_PROGRESS') {
    const { progress, message: msg } = message.data as { taskId: string; progress: number; message: string };
    if (ctx.state === 'analyzing') {
      updateAnalyzingProgress(msg, progress);
    }
    sendResponse({ success: true });
    return undefined;
  }

  if (message.action === 'TOGGLE_WIDGET') {
    const w = getExistingWidget();
    if (w) removeWidget();
    else tryInjectWidget();
    sendResponse({ success: true });
    return undefined;
  }

  if (message.action === 'START_ANALYSIS_FROM_COMMAND') {
    if (ctx.state === 'ready') {
      startAnalysis('standard', 'fr');
    }
    sendResponse({ success: true });
    return undefined;
  }

  if (message.action === 'OPEN_CHAT_FROM_COMMAND') {
    if (ctx.state === 'results' && ctx.summary) {
      openChat(ctx.summary.id, ctx.summary.video_title);
    }
    sendResponse({ success: true });
    return undefined;
  }

  return undefined;
});

// ── Bootstrap ──

function bootstrap(): void {
  if (!isVideoPage()) return;

  ctx.videoId = getCurrentVideoId();
  if (!ctx.videoId) return;

  // Démarrer l'injection avec délai
  setTimeout(tryInjectWidget, 1000);

  // Écouter les navigations SPA
  watchNavigation(onNavigate);
}

// Attendre que le DOM soit prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
