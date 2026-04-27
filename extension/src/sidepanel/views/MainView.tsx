import React, { useState, useEffect, useRef, useCallback } from "react";
import type {
  User,
  Summary,
  RecentAnalysis,
  PlanInfo,
  QuickChatResponse,
  MessageResponse,
} from "../../types";
import {
  extractVideoId,
  getThumbnailUrl,
  detectPlatform,
} from "../../utils/video";
import {
  addRecentAnalysis,
  getRecentAnalyses,
  getFreeAnalysisCount,
  incrementFreeAnalysisCount,
} from "../../utils/storage";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { LogoutIcon, ExternalLinkIcon } from "../shared/Icons";
import { SynthesisView } from "../shared/SynthesisView";
import { ChatView } from "./ChatView";
import { PromoBanner } from "../components/PromoBanner";
import { SuggestionPills } from "../components/SuggestionPills";
import { DeepSightSpinner } from "../shared/DeepSightSpinner";
import { BeamCard } from "../shared/BeamCard";
import { useTranslation } from "../../i18n/useTranslation";

interface MainViewProps {
  user: User | null;
  planInfo: PlanInfo | null;
  isGuest: boolean;
  onLogout: () => void;
  onLoginRedirect: () => void;
  onError: (msg: string) => void;
}

interface VideoInfo {
  url: string;
  videoId: string;
  title: string;
}

type AnalysisPhase =
  | { phase: "idle" }
  | { phase: "analyzing"; progress: number; message: string }
  | { phase: "complete"; summaryId: number; summary: Summary }
  | { phase: "error"; message: string };

export const MainView: React.FC<MainViewProps> = ({
  user,
  planInfo,
  isGuest,
  onLogout,
  onLoginRedirect,
  onError,
}) => {
  const { t, language } = useTranslation();
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [mode, setMode] = useState<string>(user?.default_mode || "standard");
  const [lang, setLang] = useState<string>(user?.default_lang || "fr");
  const [analysis, setAnalysis] = useState<AnalysisPhase>({ phase: "idle" });
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [guestUsed, setGuestUsed] = useState(false);
  const [quickChatLoading, setQuickChatLoading] = useState(false);
  const [showYtBanner, setShowYtBanner] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isGuest) {
      getFreeAnalysisCount().then((count) => {
        if (count >= 3) setGuestUsed(true);
      });
    }
  }, [isGuest]);

  useEffect(() => {
    Browser.storage.local.get("showYouTubeRecommendation").then((result) => {
      if (result.showYouTubeRecommendation) setShowYtBanner(true);
    });
  }, []);

  const dismissYtBanner = () => {
    setShowYtBanner(false);
    Browser.storage.local.remove("showYouTubeRecommendation");
  };

  // Détecte la vidéo dans le tab actif. Dans un Chrome side panel, on utilise
  // `lastFocusedWindow:true` au lieu de `currentWindow:true` car le panel est
  // sa propre fenêtre — `currentWindow` cible donc le panel lui-même, pas le
  // navigateur. `lastFocusedWindow` cible la dernière fenêtre du browser
  // ayant eu le focus, ce qui matche bien le tab consulté par l'user.
  const detectActiveVideo = useCallback(async () => {
    const tabs = await Browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const url = tabs[0]?.url || "";
    const videoId = extractVideoId(url);
    if (videoId) {
      const platform = detectPlatform(url);
      const fallbackTitle =
        platform === "tiktok" ? "TikTok Video" : "YouTube Video";
      setVideo({ url, videoId, title: tabs[0]?.title || fallbackTitle });
    } else {
      // Important : reset à null si l'user navigue d'une vidéo vers un site
      // hors-vidéo (Google.com, etc.) — sinon la card vidéo resterait figée.
      setVideo(null);
    }
  }, []);

  useEffect(() => {
    void detectActiveVideo();
    if (!isGuest) loadRecentAnalyses();

    // Re-détecte quand l'user switch de tab (mode compagnon).
    const handleTabActivated = (): void => {
      void detectActiveVideo();
    };
    // Re-détecte uniquement quand l'URL change (navigation SPA YouTube,
    // etc.) — pas sur tous les events onUpdated (sinon flood).
    const handleTabUpdated = (
      _tabId: number,
      changeInfo: { url?: string },
    ): void => {
      if (changeInfo.url) void detectActiveVideo();
    };

    Browser.tabs.onActivated.addListener(handleTabActivated);
    Browser.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      Browser.tabs.onActivated.removeListener(handleTabActivated);
      Browser.tabs.onUpdated.removeListener(handleTabUpdated);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isGuest, detectActiveVideo]);

  async function loadRecentAnalyses(): Promise<void> {
    const items = await getRecentAnalyses();
    setRecentAnalyses(items);
  }

  const isQuotaExceeded = planInfo
    ? planInfo.analyses_this_month >= planInfo.monthly_analyses
    : false;
  const quotaRemaining = planInfo
    ? planInfo.monthly_analyses - planInfo.analyses_this_month
    : null;
  const quotaWarning =
    planInfo && planInfo.monthly_analyses > 0
      ? quotaRemaining !== null &&
        quotaRemaining / planInfo.monthly_analyses < 0.2
      : false;

  const creditsTotal = planInfo?.credits_monthly || user?.credits_monthly || 0;
  const creditsRemaining = planInfo?.credits ?? user?.credits ?? 0;
  const creditsLow = creditsTotal > 0 && creditsRemaining / creditsTotal < 0.3;
  const creditsCritical =
    creditsTotal > 0 && creditsRemaining / creditsTotal < 0.1;

  const userPlanId = planInfo?.plan_id || user?.plan || "free";
  const nextPlan = t.upsell[userPlanId as keyof typeof t.upsell] || null;

  const startQuickChat = useCallback(async () => {
    if (!video) return;
    setQuickChatLoading(true);

    try {
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "QUICK_CHAT",
        data: { url: video.url, lang },
      });

      if (!response.success)
        throw new Error(response.error || "Quick Chat failed");

      const result = response.result as QuickChatResponse;
      Browser.tabs.create({
        url: `${WEBAPP_URL}/chat?summary=${result.summary_id}`,
      });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setQuickChatLoading(false);
    }
  }, [video, lang, onError]);

  const startAnalysis = useCallback(async () => {
    if (!video) return;

    if (isGuest) {
      const count = await getFreeAnalysisCount();
      if (count >= 3) {
        setGuestUsed(true);
        return;
      }
    }

    setAnalysis({
      phase: "analyzing",
      progress: 0,
      message: t.analysis.starting,
    });

    try {
      const startRes = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "START_ANALYSIS",
        data: { url: video.url, options: { mode, lang } },
      });

      if (!startRes.success) {
        setAnalysis({
          phase: "error",
          message: startRes.error || t.analysis.startFailed,
        });
        return;
      }

      const taskId = (startRes.result as { task_id: string }).task_id;

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await Browser.runtime.sendMessage<
            unknown,
            MessageResponse
          >({
            action: "GET_TASK_STATUS",
            data: { taskId },
          });

          if (!statusRes.success || !statusRes.status) return;
          const status = statusRes.status;

          if (status.status === "completed" && status.result?.summary_id) {
            if (pollRef.current) clearInterval(pollRef.current);

            if (isGuest) {
              await incrementFreeAnalysisCount();
              setGuestUsed(true);
            }

            await addRecentAnalysis({
              videoId: video.videoId,
              summaryId: status.result.summary_id,
              title: status.result.video_title || video.title,
            });

            const summaryRes = await Browser.runtime.sendMessage<
              unknown,
              MessageResponse
            >({
              action: "GET_SUMMARY",
              data: { summaryId: status.result.summary_id },
            });

            if (summaryRes.success && summaryRes.summary) {
              setAnalysis({
                phase: "complete",
                summaryId: status.result.summary_id,
                summary: summaryRes.summary,
              });
              loadRecentAnalyses();
            }
          } else if (status.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setAnalysis({
              phase: "error",
              message: status.error || t.analysis.failed,
            });
          } else {
            setAnalysis({
              phase: "analyzing",
              progress: status.progress || 0,
              message: status.message || t.analysis.processing,
            });
          }
        } catch {
          // Polling error — will retry
        }
      }, 2500);
    } catch (e) {
      setAnalysis({ phase: "error", message: (e as Error).message });
    }
  }, [video, mode, lang, isGuest, t]);

  // Chat view (unchanged)
  if (chatOpen && analysis.phase === "complete") {
    return (
      <ChatView
        summaryId={analysis.summaryId}
        videoTitle={analysis.summary.video_title}
        onClose={() => setChatOpen(false)}
        onSessionExpired={onLogout}
        userPlan={planInfo?.plan_id || user?.plan || "free"}
      />
    );
  }

  const planName = planInfo
    ? t.plans[planInfo.plan_id as keyof typeof t.plans] || planInfo.plan_name
    : null;
  const isFree = !user || user.plan === "free";
  const planLabel = isGuest
    ? t.common.login
    : isFree
      ? planName || t.plans.free
      : planName || "";

  const platform = video ? detectPlatform(video.url) : null;
  const isTikTok = platform === "tiktok";
  const thumbSrc =
    video && !isTikTok
      ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`
      : null;

  /*
    V3 layout reserves bottom-right ~76x76px for the parallel session's
    <SunflowerLayer /> mascot (ambient-lighting-v3 PR). Do not place
    floating elements (FAB, voice button, etc.) in that corner.
  */
  return (
    <div className="v3-app">
      <div className="v3-app-scroll v3-stagger">
        {/* ── Hero header ────────────────────────────────────────── */}
        <div className="v3-hero">
          <img
            src={Browser.runtime.getURL("icons/icon32.png")}
            alt="DeepSight"
            width={28}
            height={28}
            className="v3-brand-logo"
          />
          <span className="v3-brand">DeepSight</span>
          <span className={`v3-plan-chip${isFree ? " v3-plan-chip-free" : ""}`}>
            {planLabel}
          </span>
          <button
            className="v3-icon-btn"
            onClick={() => Browser.tabs.create({ url: WEBAPP_URL })}
            title="Ouvrir DeepSight"
            aria-label="Ouvrir DeepSight"
          >
            <ExternalLinkIcon size={13} />
          </button>
          {isGuest ? (
            <button
              className="v3-text-link"
              onClick={onLoginRedirect}
              aria-label={t.common.login}
            >
              {t.common.login}
            </button>
          ) : (
            <button
              className="v3-icon-btn"
              onClick={onLogout}
              title={t.common.logout}
              aria-label={t.common.logout}
            >
              <LogoutIcon size={14} />
            </button>
          )}
        </div>

        {/* ── Quota strip ────────────────────────────────────────── */}
        {!isGuest && user && (
          <div className="v3-quota">
            {planInfo ? (
              <span
                className={`v3-quota-item${quotaWarning ? " warning" : ""}`}
              >
                {planInfo.analyses_this_month}/{planInfo.monthly_analyses}{" "}
                {t.common.analyses}
              </span>
            ) : (
              <span className="v3-quota-item">
                {user.credits} {t.common.credits}
              </span>
            )}
            {creditsLow && (
              <span
                className={`v3-quota-item${
                  creditsCritical ? " critical" : " warning"
                }`}
                title={t.credits.remaining.replace(
                  "{count}",
                  String(creditsRemaining),
                )}
              >
                {creditsRemaining} {t.credits.low}
              </span>
            )}
          </div>
        )}

        {/* ── Banners (severity ordered) ─────────────────────────── */}
        {!isGuest && creditsCritical && (
          <div className="v3-banner error">
            <div className="v3-banner-content">
              <span className="v3-banner-title">
                {t.credits.critical.replace(
                  "{count}",
                  String(creditsRemaining),
                )}
              </span>
            </div>
            <a
              className="v3-banner-cta"
              href={`${WEBAPP_URL}/upgrade`}
              onClick={(e) => {
                e.preventDefault();
                Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
              }}
            >
              {t.credits.recharge} {"↗"}
            </a>
          </div>
        )}

        {isGuest && (
          <div className="v3-banner">
            <div className="v3-banner-content">
              <span className="v3-banner-subtitle">{t.guest.banner}</span>
            </div>
          </div>
        )}

        {showYtBanner && (
          <div className="v3-banner">
            <img
              src={Browser.runtime.getURL("platforms/youtube-icon-red.png")}
              alt="YouTube"
              style={{ height: 16, width: "auto", flexShrink: 0 }}
            />
            <div className="v3-banner-content">
              <span className="v3-banner-title">{t.ytRecommend.title}</span>
              <span className="v3-banner-subtitle">
                {t.ytRecommend.subtitle}
              </span>
            </div>
            <button
              className="v3-banner-dismiss"
              onClick={dismissYtBanner}
              title={t.ytRecommend.dismiss}
              aria-label={t.ytRecommend.dismiss}
            >
              {"✕"}
            </button>
          </div>
        )}

        {/* ── Analysis flow (idle / quota / guest exhausted) ─────── */}
        {video && analysis.phase === "idle" && (
          <>
            {!isGuest && isQuotaExceeded ? (
              <BeamCard>
                <div className="v3-card-eyebrow">
                  {t.analysis.quotaExceeded}
                </div>
                <h3 className="v3-card-title">
                  {planInfo?.analyses_this_month}/{planInfo?.monthly_analyses}
                </h3>
                <p className="v3-card-desc">{t.analysis.quotaExceededText}</p>
                <button
                  className="v3-button-secondary"
                  onClick={startQuickChat}
                  disabled={quickChatLoading}
                  style={{ marginBottom: 8 }}
                >
                  {quickChatLoading
                    ? t.analysis.quickChatPreparing
                    : t.analysis.quickChatButton}
                </button>
                <a
                  className="v3-button-primary"
                  href={`${WEBAPP_URL}/upgrade`}
                  onClick={(e) => {
                    e.preventDefault();
                    Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
                  }}
                >
                  {t.common.viewPlans} {"↗"}
                </a>
              </BeamCard>
            ) : isGuest && guestUsed ? (
              <BeamCard>
                <div className="v3-card-eyebrow">{t.guest.banner}</div>
                <h3 className="v3-card-title">{t.guest.exhaustedText}</h3>
                <button
                  className="v3-button-primary"
                  onClick={() =>
                    Browser.tabs.create({ url: `${WEBAPP_URL}/register` })
                  }
                >
                  {t.common.createAccount} {"↗"}
                </button>
              </BeamCard>
            ) : (
              <>
                {/* Mode + Lang as pill toggles */}
                <div className="v3-pill-row">
                  <div className="v3-pill-group">
                    <span className="v3-pill-label">{t.analysis.mode}</span>
                    <div className="v3-pill-toggle">
                      <button
                        className={mode === "standard" ? "active" : ""}
                        onClick={() => setMode("standard")}
                      >
                        {t.analysis.modes.standard}
                      </button>
                      <button
                        className={mode === "accessible" ? "active" : ""}
                        onClick={() => setMode("accessible")}
                      >
                        {t.analysis.modes.accessible}
                      </button>
                    </div>
                  </div>
                  <div className="v3-pill-group">
                    <span className="v3-pill-label">{t.analysis.language}</span>
                    <div className="v3-pill-toggle">
                      {(["fr", "en", "es", "de"] as const).map((code) => (
                        <button
                          key={code}
                          className={lang === code ? "active" : ""}
                          onClick={() => setLang(code)}
                          aria-label={
                            t.analysis.languages[
                              code as keyof typeof t.analysis.languages
                            ]
                          }
                        >
                          {code.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary analysis card — video detected */}
                <BeamCard>
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt=""
                      className="v3-video-card-thumb"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="v3-video-card-thumb-fallback">
                      {isTikTok ? "TikTok" : t.analysis.noVideo}
                    </div>
                  )}
                  <span className="v3-platform-pill">
                    <img
                      src={Browser.runtime.getURL(
                        isTikTok ? "brand/tiktok.png" : "brand/youtube.svg",
                      )}
                      alt=""
                      width={12}
                      height={12}
                      className="v3-platform-pill-icon"
                    />
                    {isTikTok ? "TIKTOK" : "YOUTUBE"}
                  </span>
                  <h3 className="v3-card-title">{video.title}</h3>
                  <p className="v3-card-desc">{t.mistral.badge}</p>
                  <button className="v3-button-primary" onClick={startAnalysis}>
                    {t.analysis.analyzeButton} {"→"}
                  </button>
                </BeamCard>

                {video && (
                  <SuggestionPills
                    suggestions={[
                      {
                        id: "flashcards",
                        label: "Créer flashcards",
                        icon: "🎴",
                        onTrigger: () =>
                          Browser.tabs.create({
                            url: `${WEBAPP_URL}/study/${video.videoId}`,
                          }),
                      },
                      {
                        id: "sources",
                        label: "Voir sources",
                        icon: "🔍",
                        onTrigger: () =>
                          Browser.tabs.create({
                            url: `${WEBAPP_URL}/library`,
                          }),
                      },
                      {
                        id: "openweb",
                        label: "Ouvrir dans l'app",
                        icon: "🌐",
                        onTrigger: () =>
                          Browser.tabs.create({
                            url: `${WEBAPP_URL}/`,
                          }),
                      },
                    ]}
                  />
                )}

                {/* Quick Chat secondary card */}
                <BeamCard>
                  <div className="v3-card-eyebrow">
                    {t.analysis.quickChatButton}
                  </div>
                  <h3 className="v3-card-title">
                    {t.analysis.quickChatButton}
                  </h3>
                  <p className="v3-card-desc">
                    {t.analysis.quickChatPreparing}
                  </p>
                  <button
                    className="v3-button-secondary"
                    onClick={startQuickChat}
                    disabled={!video || quickChatLoading}
                  >
                    {quickChatLoading
                      ? t.analysis.quickChatPreparing
                      : t.analysis.quickChatButton}
                  </button>
                </BeamCard>
              </>
            )}
          </>
        )}

        {/* ── Empty state (no video detected) ────────────────────── */}
        {!video && analysis.phase === "idle" && (
          <BeamCard>
            <div className="v3-card-eyebrow">{t.analysis.noVideo}</div>
            <h3 className="v3-card-title">{t.analysis.analyzeButton}</h3>
            <p className="v3-card-desc">{t.mistral.badge}</p>
          </BeamCard>
        )}

        {/* ── Analyzing state ────────────────────────────────────── */}
        {analysis.phase === "analyzing" && (
          <div className="v3-progress-card">
            <DeepSightSpinner size="md" speed="fast" />
            <div className="v3-progress-bar">
              <div
                className="v3-progress-fill"
                style={{ width: `${analysis.progress}%` }}
              />
            </div>
            <p className="v3-progress-text">{analysis.message}</p>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────── */}
        {analysis.phase === "error" && (
          <BeamCard>
            <div className="v3-card-eyebrow">Erreur</div>
            <h3 className="v3-card-title" style={{ color: "#fca5a5" }}>
              {analysis.message}
            </h3>
            <button
              className="v3-button-primary"
              onClick={() => setAnalysis({ phase: "idle" })}
            >
              {t.common.retry}
            </button>
          </BeamCard>
        )}

        {/* ── Complete (synthesis) ───────────────────────────────── */}
        {analysis.phase === "complete" && (
          <>
            <SynthesisView
              summary={analysis.summary}
              summaryId={analysis.summaryId}
              planInfo={planInfo}
              onOpenChat={() => setChatOpen(true)}
            />

            {!isGuest && nextPlan && userPlanId !== "pro" && (
              <BeamCard>
                <div className="v3-card-eyebrow">{nextPlan.label}</div>
                <h3 className="v3-card-title">{nextPlan.feature}</h3>
                <p className="v3-card-desc">
                  {nextPlan.price}/{language === "fr" ? "mois" : "mo"}
                </p>
                <a
                  className="v3-button-primary"
                  href={`${WEBAPP_URL}/upgrade`}
                  onClick={(e) => {
                    e.preventDefault();
                    Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
                  }}
                >
                  {t.common.unlock} {"↗"}
                </a>
              </BeamCard>
            )}

            {isGuest && (
              <BeamCard>
                <div className="v3-card-eyebrow">{t.guest.banner}</div>
                <p className="v3-card-desc">{t.guest.exhaustedText}</p>
                <button
                  className="v3-button-primary"
                  onClick={() =>
                    Browser.tabs.create({ url: `${WEBAPP_URL}/register` })
                  }
                >
                  {t.common.createAccount} {"↗"}
                </button>
              </BeamCard>
            )}
          </>
        )}

        {/* ── Recents ────────────────────────────────────────────── */}
        {!isGuest && analysis.phase === "idle" && recentAnalyses.length > 0 && (
          <>
            <h3 className="v3-section-title">{t.analysis.recent}</h3>
            <ul className="v3-recents-list">
              {recentAnalyses.slice(0, 5).map((item) => (
                <li key={item.videoId}>
                  <a
                    href={`${WEBAPP_URL}/summary/${item.summaryId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="v3-recent-item"
                  >
                    {item.platform === "tiktok" ? (
                      <div className="v3-recent-thumb-fallback">TT</div>
                    ) : (
                      <img
                        src={getThumbnailUrl(item.videoId, "youtube") || ""}
                        alt=""
                        loading="lazy"
                        className="v3-recent-thumb"
                      />
                    )}
                    <div className="v3-recent-meta">
                      <div className="v3-recent-title">{item.title}</div>
                    </div>
                    <span className="v3-recent-chevron">{"›"}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ── Footer (Mistral attribution) ───────────────────────── */}
        <div className="v3-footer">
          <span style={{ opacity: 0.5, fontSize: 10 }}>Propulsé par</span>
          <img
            src={Browser.runtime.getURL("brand/mistral-wordmark-white.svg")}
            alt="Mistral AI"
            height={12}
            style={{ opacity: 0.7, verticalAlign: "middle", marginLeft: 6 }}
          />
        </div>
      </div>

      {/* Promo Banner — kept at the bottom */}
      <PromoBanner planInfo={planInfo} />
    </div>
  );
};
