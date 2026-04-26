// ── Content Script — Point d'entrée modulaire ──
// Remplace l'ancien content.ts monolithique (852 lignes)

import Browser from "../utils/browser-polyfill";
import { extractVideoId, detectCurrentPagePlatform } from "../utils/video";
import { addRecentAnalysis } from "../utils/storage";
import { escapeHtml } from "../utils/sanitize";
import { WEBAPP_URL } from "../utils/config";
import { ttsStop } from "./tts";
import { detectExtensions, refreshDetection } from "./coexistence";

import { watchNavigation, isVideoPage, getCurrentVideoId } from "./navigation";
import { detectTheme, watchTheme, stopWatchingTheme } from "./theme";
import {
  createWidgetShell,
  injectWidget,
  removeWidget,
  getExistingWidget,
  buildWidgetHeader,
  bindMinimizeButton,
  bindVoiceButton,
  setWidgetBody,
  setWidgetInnerHTML,
  getWidgetBody,
  isWidgetDetached,
  isAnchorReady,
  buildSkeletonBody,
} from "./widget";
import { $id } from "./shadow";
import { fetchTournesolScore } from "./tournesol";
import { startWidgetObserver, stopWidgetObserver } from "./observer";
import { watchLayoutMode, stopWatchingLayout } from "./theater";
import type { LayoutMode } from "./theater";

import { renderLoginState } from "./states/login";
import { renderReadyState } from "./states/ready";
import {
  renderAnalyzingState,
  updateAnalyzingProgress,
} from "./states/analyzing";
import { renderResultsState } from "./states/results";
import { renderChatState } from "./states/chat";

import { logBootStep, persistCrash } from "../utils/crash-logger";

import type { Summary, User, PlanInfo, TournesolData } from "../types";

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then(
      (v) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(v);
        }
      },
      () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      },
    );
  });
}

// ── State Machine ──

type AppState = "login" | "ready" | "analyzing" | "results" | "chat";

interface AppContext {
  state: AppState;
  videoId: string | null;
  currentTaskId: string | null;
  user: User | null;
  planInfo: PlanInfo | null;
  summary: Summary | null;
  tournesol: TournesolData | null;
  injected: boolean;
  injectionAttempts: number;
}

const ctx: AppContext = {
  state: "login",
  videoId: null,
  currentTaskId: null,
  user: null,
  planInfo: null,
  summary: null,
  tournesol: null,
  injected: false,
  injectionAttempts: 0,
};

function assetUrl(p: string): string {
  return Browser.runtime.getURL(`assets/${p}`);
}

function logoImgHtml(size = 22): string {
  return `<img src="${assetUrl("deepsight-logo-cosmic.png")}" alt="DeepSight" width="${size}" height="${size}" style="object-fit:contain;border-radius:50%;" />`;
}

// ── Widget injection avec retry ──

function tryInjectWidget(): void {
  try {
    if (ctx.injected && getExistingWidget()) {
      logBootStep("inject:skip-already-injected");
      return;
    }
    if (ctx.injectionAttempts > 30) {
      logBootStep("inject:max-attempts-reached");
      return;
    }

    ctx.injectionAttempts++;
    logBootStep("inject:attempt", { n: ctx.injectionAttempts });

    const platform = detectCurrentPagePlatform();
    const isTikTok = platform === "tiktok";
    const theme = detectTheme();
    logBootStep("inject:platform-theme", { platform, theme });

    const host = createWidgetShell(theme, isTikTok);
    if (!host) {
      logBootStep("inject:createWidgetShell-returned-null");
      const delay = ctx.injectionAttempts <= 10 ? 300 : 1000;
      setTimeout(tryInjectWidget, delay);
      return;
    }
    const widgetCard = getExistingWidget();
    if (widgetCard) {
      widgetCard.innerHTML = buildWidgetHeader(logoImgHtml(22));
      const skeleton = buildSkeletonBody(() => {
        logBootStep("skeleton:retry-clicked");
        ctx.injected = false;
        ctx.injectionAttempts = 0;
        removeWidget();
        tryInjectWidget();
      });
      const bodyWrapper = document.createElement("div");
      bodyWrapper.innerHTML = skeleton.html;
      const bodyEl = bodyWrapper.firstElementChild;
      if (bodyEl) widgetCard.appendChild(bodyEl);
      skeleton.bind();
      logBootStep("inject:widget-populated-with-skeleton");
    } else {
      logBootStep("inject:widgetCard-null");
    }

    const success = injectWidget(host, isTikTok);
    logBootStep("inject:injectWidget-result", { success });

    if (success) {
      ctx.injected = true;
      ctx.injectionAttempts = 0;
      bindMinimizeButton();
      // Bouton "Appeler" — ouvre le side panel ElevenLabs avec le contexte
      // courant. Le bouton est rendu seulement si l'API sidePanel existe
      // (Chrome only V1).
      bindVoiceButton(() => ({
        summaryId: ctx.summary?.id ?? null,
        videoId: ctx.videoId ?? null,
        videoTitle: ctx.summary?.video_title ?? document.title ?? null,
        platform: detectCurrentPagePlatform() as "youtube" | "tiktok" | null,
      }));
      // FIX-WHITE-WIDGET: theme is forced to dark in widget.ts.
      // Keep observer running but ensure dark class is preserved.
      watchTheme(() => {
        const w = getExistingWidget();
        if (w && !w.classList.contains("dark")) {
          w.classList.remove("light");
          w.classList.add("dark");
        }
      });
      startWidgetObserver(() => {
        logBootStep("observer:widget-detached");
        ctx.injected = false;
        tryInjectWidget();
      });
      watchLayoutMode((mode: LayoutMode) => {
        const hostEl = document.getElementById("deepsight-host");
        if (!hostEl) return;
        if (mode === "fullscreen") {
          hostEl.style.display = "none";
        } else if (mode === "theater") {
          hostEl.style.cssText =
            "all:initial;position:fixed;bottom:20px;right:20px;width:380px;max-height:80vh;z-index:2147483646;";
          hostEl.style.display = "";
        } else {
          hostEl.style.cssText =
            "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;";
        }
      });
      logBootStep("inject:success-calling-initCard");
      initCard();
    } else {
      // Anchor-aware retry: wait up to 15s for YouTube sidebar to render,
      // then fall back to floating widget (already handled by injectWidget).
      const TOTAL_BUDGET_MS = 15_000;
      const elapsed = ctx.injectionAttempts * 500;
      if (elapsed >= TOTAL_BUDGET_MS) {
        logBootStep("inject:budget-exceeded-force-floating");
        ctx.injected = false;
        setTimeout(tryInjectWidget, 1000);
      } else {
        const delay = ctx.injectionAttempts <= 10 ? 300 : 1000;
        setTimeout(tryInjectWidget, delay);
      }
    }
  } catch (err) {
    logBootStep("inject:caught-error", {
      message: (err as Error).message,
    });
    void persistCrash(err, {
      step: "tryInjectWidget",
      attempt: ctx.injectionAttempts,
    });
    if (ctx.injectionAttempts < 3) {
      setTimeout(tryInjectWidget, 1000);
    }
  }
}

// ── Initialisation principale ──

async function initCard(): Promise<void> {
  try {
    const authResp = await withTimeout(
      Browser.runtime.sendMessage({ action: "CHECK_AUTH" }) as Promise<
        { authenticated?: boolean; user?: User | null } | undefined
      >,
      5000,
      { authenticated: false } as
        | { authenticated?: boolean; user?: User | null }
        | undefined,
    );
    logBootStep("initCard:auth-checked", {
      authenticated: !!authResp?.authenticated,
    });

    if (!authResp?.authenticated) {
      ctx.state = "login";
      ctx.user = null;
      renderLoginState(() => initCard());
      return;
    }

    ctx.user = authResp.user ?? null;

    // Fetch plan info (non-bloquant)
    Browser.runtime
      .sendMessage({ action: "GET_PLAN" })
      .then((resp) => {
        const r = resp as
          | { success?: boolean; plan?: PlanInfo | null }
          | undefined;
        if (r?.success) ctx.planInfo = r.plan ?? null;
      })
      .catch(() => {});

    // Fetch Tournesol score (non-bloquant)
    if (ctx.videoId) {
      fetchTournesolScore(ctx.videoId)
        .then((data) => {
          ctx.tournesol = data;
          // Mettre à jour le widget si en état ready
          if (ctx.state === "ready" && ctx.user) {
            renderReadyState({
              user: {
                username: ctx.user.username,
                plan: ctx.user.plan,
                credits: ctx.user.credits,
              },
              tournesol: ctx.tournesol,
              videoTitle: getVideoTitle(),
              onAnalyze: (mode, lang) => startAnalysis(mode, lang),
              onQuickChat: (lang) => handleQuickChat(lang),
              onLogout: handleLogout,
            });
          }
        })
        .catch(() => {});
    }

    ctx.state = "ready";
    renderReadyState({
      user: {
        username: ctx.user!.username,
        plan: ctx.user!.plan,
        credits: ctx.user!.credits,
      },
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
  // Priority 1: og:title meta (never in shadow DOM, never touched by extensions)
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle instanceof HTMLMetaElement && ogTitle.content)
    return ogTitle.content;

  // Priority 2: name=title meta
  const metaTitle = document.querySelector('meta[name="title"]');
  if (metaTitle instanceof HTMLMetaElement && metaTitle.content)
    return metaTitle.content;

  // Priority 3: YouTube DOM selectors (may break with shadow DOM A/B tests)
  const domTitle =
    document.querySelector("ytd-watch-metadata h1 yt-formatted-string") ??
    document.querySelector("h1.title yt-formatted-string") ??
    document.querySelector("h1.title");
  if (domTitle?.textContent?.trim()) return domTitle.textContent.trim();

  // Priority 4: document.title cleanup
  const pageTitle = document.title.replace(/\s*[-–—]\s*YouTube\s*$/, "").trim();
  if (pageTitle) return pageTitle;

  return "";
}

// ── Analyse ──

function handleCancelCurrentAnalysis(): void {
  if (ctx.currentTaskId) {
    Browser.runtime
      .sendMessage({
        action: "CANCEL_ANALYSIS",
        data: { taskId: ctx.currentTaskId },
      })
      .catch(() => {});
  }
  ctx.state = "ready";
  ctx.currentTaskId = null;
  if (ctx.user) {
    renderReadyState({
      user: {
        username: ctx.user.username,
        plan: ctx.user.plan,
        credits: ctx.user.credits,
      },
      tournesol: ctx.tournesol,
      videoTitle: getVideoTitle(),
      onAnalyze: startAnalysis,
      onQuickChat: handleQuickChat,
      onLogout: handleLogout,
    });
  }
}

async function startAnalysis(mode: string, lang: string): Promise<void> {
  if (!ctx.videoId) return;

  ctx.state = "analyzing";
  ctx.currentTaskId = null;
  renderAnalyzingState(
    "Démarrage de l'analyse...",
    0,
    handleCancelCurrentAnalysis,
  );

  const url = window.location.href;

  try {
    const response = (await Browser.runtime.sendMessage({
      action: "ANALYZE_VIDEO",
      data: { url, options: { mode, lang, category: "auto" } },
    })) as
      | {
          success?: boolean;
          error?: string;
          result?: {
            status: string;
            result?: { summary_id: number; video_title?: string };
            error?: string;
          };
        }
      | undefined;

    if (!response?.success)
      throw new Error(response?.error || "Analyse échouée");

    const result = response.result as {
      status: string;
      result?: { summary_id: number; video_title?: string };
      error?: string;
    };

    if (result.status === "completed" && result.result?.summary_id) {
      await displaySummary(result.result.summary_id);
    } else if (result.status === "failed") {
      throw new Error(result.error ?? "Analyse échouée");
    }
  } catch (e) {
    ctx.state = "ready";
    showError((e as Error).message);
    // Retour à l'état ready après 3s
    setTimeout(() => {
      if (ctx.user) {
        renderReadyState({
          user: {
            username: ctx.user!.username,
            plan: ctx.user!.plan,
            credits: ctx.user!.credits,
          },
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
  const resp = (await Browser.runtime.sendMessage({
    action: "GET_SUMMARY",
    data: { summaryId },
  })) as { success?: boolean; error?: string; summary?: Summary } | undefined;
  if (!resp?.success)
    throw new Error(resp?.error || "Récupération analyse échouée");

  ctx.summary = resp.summary as Summary;
  ctx.state = "results";

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
    userPlan: ctx.user?.plan ?? "free",
    onChat: openChat,
    onCopyLink: handleCopy,
    onShare: handleShare,
  });
}

// ── Quick Chat ──

async function handleQuickChat(lang: string): Promise<void> {
  try {
    const resp = (await Browser.runtime.sendMessage({
      action: "QUICK_CHAT",
      data: { url: window.location.href, lang },
    })) as
      | {
          success?: boolean;
          error?: string;
          result?: { summary_id: number; video_title: string };
        }
      | undefined;

    if (!resp?.success) throw new Error(resp?.error || "Quick Chat échoué");

    const result = resp.result as { summary_id: number; video_title: string };
    openChat(result.summary_id, result.video_title);
  } catch (e) {
    showError((e as Error).message);
    // Re-enable button
    const btn = $id<HTMLButtonElement>("ds-quickchat-btn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "💬 Quick Chat IA";
    }
  }
}

// ── Chat ──

async function openChat(summaryId: number, title: string): Promise<void> {
  ctx.state = "chat";

  // Charger l'historique
  let messages = [];
  try {
    const histResp = (await Browser.runtime.sendMessage({
      action: "GET_CHAT_HISTORY",
      data: { summaryId },
    })) as { success?: boolean; result?: unknown } | undefined;
    if (histResp?.success && Array.isArray(histResp.result)) {
      messages = histResp.result;
    }
  } catch {
    /* historique non critique */
  }

  await renderChatState({
    summaryId,
    videoTitle: title,
    category: ctx.summary?.category ?? "default",
    messages,
    onBack: ctx.summary
      ? () => {
          ctx.state = "results";
          renderResultsState({
            summary: ctx.summary!,
            userPlan: ctx.user?.plan ?? "free",
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
  const btn = $id("ds-copy-btn");
  if (!btn) return;

  let shareUrl = `${WEBAPP_URL}/summary/${ctx.summary.id}`;
  try {
    const res = (await Browser.runtime.sendMessage({
      action: "SHARE_ANALYSIS",
      data: { videoId: ctx.videoId },
    })) as { success?: boolean; share_url?: string } | undefined;
    if (res?.success && res.share_url) shareUrl = res.share_url;
  } catch {
    /* use fallback */
  }

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
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "✅ Copié!";
    setTimeout(() => {
      btn.textContent = "📋 Copier";
    }, 2000);
  } catch {
    btn.textContent = "❌ Échec";
    setTimeout(() => {
      btn.textContent = "📋 Copier";
    }, 2000);
  }
}

// ── Share ──

async function handleShare(): Promise<void> {
  if (!ctx.summary) return;
  const btn = $id("ds-share-btn");
  if (!btn) return;

  try {
    const res = (await Browser.runtime.sendMessage({
      action: "SHARE_ANALYSIS",
      data: { videoId: ctx.videoId },
    })) as { success?: boolean; share_url?: string } | undefined;
    const url = res?.success
      ? res.share_url
      : `${WEBAPP_URL}/summary/${ctx.summary.id}`;
    await navigator.clipboard.writeText(url as string);
    btn.textContent = "✅ Lien copié!";
    setTimeout(() => {
      btn.textContent = "🔗 Partager";
    }, 2000);
  } catch {
    btn.textContent = "❌ Échec";
    setTimeout(() => {
      btn.textContent = "🔗 Partager";
    }, 2000);
  }
}

// ── Logout ──

async function handleLogout(): Promise<void> {
  await Browser.runtime.sendMessage({ action: "LOGOUT" });
  ctx.user = null;
  ctx.planInfo = null;
  ctx.summary = null;
  ctx.tournesol = null;
  ctx.state = "login";
  renderLoginState(() => initCard());
}

// ── Error display ──

function showError(message: string): void {
  const body = getWidgetBody();
  if (!body) return;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const errorDiv = document.createElement("div");
  errorDiv.style.cssText =
    "padding:8px 12px;background:var(--ds-error-bg);border-radius:8px;font-size:11px;color:var(--ds-error);margin-top:8px;display:flex;flex-direction:column;gap:6px";
  errorDiv.textContent = isOffline
    ? "📡 Hors ligne — vérifiez votre connexion"
    : `❌ ${message}`;
  if (isOffline) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Réessayer";
    retry.style.cssText =
      "padding:4px 8px;border-radius:4px;background:var(--ds-gold-mid);color:#0a0a0f;border:none;font-size:10px;cursor:pointer;align-self:flex-start";
    retry.addEventListener("click", () => {
      void initCard();
    });
    errorDiv.appendChild(retry);
  }
  body.appendChild(errorDiv);
}

// ── Navigation handler ──

async function onNavigate(videoId: string | null): Promise<void> {
  // Stop TTS audio on navigation
  ttsStop();

  // Cleanup observers
  stopWidgetObserver();
  stopWatchingLayout();
  stopWatchingTheme();

  // Re-detect third-party extensions on SPA navigation
  refreshDetection();

  // Reset state
  ctx.videoId = videoId;
  ctx.summary = null;
  ctx.tournesol = null;
  ctx.state = "login";
  ctx.injected = false;
  ctx.injectionAttempts = 0;

  removeWidget();

  if (!videoId || !isVideoPage()) return;

  // Délai pour laisser le DOM YouTube se mettre en place
  setTimeout(tryInjectWidget, 800);
}

// ── Message listener (from background / popup) ──

Browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as { action: string; data?: unknown };
  if (msg.action === "ANALYSIS_PROGRESS") {
    const {
      taskId,
      progress,
      message: msgText,
    } = msg.data as { taskId: string; progress: number; message: string };
    if (ctx.state === "analyzing") {
      ctx.currentTaskId = taskId;
      updateAnalyzingProgress(msgText, progress);
    }
    return Promise.resolve({ success: true });
  }

  if (msg.action === "TOGGLE_WIDGET") {
    const w = getExistingWidget();
    if (w) removeWidget();
    else tryInjectWidget();
    return Promise.resolve({ success: true });
  }

  if (msg.action === "START_ANALYSIS_FROM_COMMAND") {
    if (ctx.state === "ready") {
      startAnalysis("standard", "fr");
    }
    return Promise.resolve({ success: true });
  }

  if (msg.action === "OPEN_CHAT_FROM_COMMAND") {
    if (ctx.state === "results" && ctx.summary) {
      openChat(ctx.summary.id, ctx.summary.video_title);
    }
    return Promise.resolve({ success: true });
  }

  return undefined;
});

// ── Bootstrap ──

function bootstrap(): void {
  try {
    logBootStep("bootstrap:start", {
      url: location.href,
      readyState: document.readyState,
    });
    if (!isVideoPage()) {
      logBootStep("bootstrap:not-video-page");
      return;
    }

    ctx.videoId = getCurrentVideoId();
    if (!ctx.videoId) {
      logBootStep("bootstrap:no-video-id");
      return;
    }

    logBootStep("bootstrap:video-id", { videoId: ctx.videoId });
    detectExtensions();
    logBootStep("bootstrap:anchor-ready", { ready: isAnchorReady() });
    setTimeout(tryInjectWidget, 1000);
    watchNavigation(onNavigate);
    logBootStep("bootstrap:ready");
  } catch (err) {
    logBootStep("bootstrap:caught-error", {
      message: (err as Error).message,
    });
    void persistCrash(err, { step: "bootstrap" });
  }
}

// Global safety net: persist any uncaught error during the boot window
window.addEventListener("error", (ev) => {
  if (ev.error) void persistCrash(ev.error, { source: "window.onerror" });
});
window.addEventListener("unhandledrejection", (ev) => {
  void persistCrash(ev.reason, { source: "unhandledrejection" });
});

// Auto-retry on network recovery
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    logBootStep("network:online-retry");
    if (ctx.state === "login" || ctx.state === "ready") {
      void initCard();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
