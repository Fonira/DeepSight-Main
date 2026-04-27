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
  type VideoPlatform,
} from "../../utils/video";
import {
  addRecentAnalysis,
  getRecentAnalyses,
  getFreeAnalysisCount,
  incrementFreeAnalysisCount,
} from "../../utils/storage";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { LogoutIcon, PlayIcon, ExternalLinkIcon } from "../shared/Icons";
import { SynthesisView } from "../shared/SynthesisView";
import { ChatView } from "./ChatView";
import { PromoBanner } from "../components/PromoBanner";
import { VoiceCallButton } from "../components/VoiceCallButton";
import { DeepSightSpinner } from "../shared/DeepSightSpinner";
import { DoodleIcon } from "../shared/doodles/DoodleIcon";
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

  useEffect(() => {
    Browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const url = tabs[0]?.url || "";
      const videoId = extractVideoId(url);
      if (videoId) {
        const platform = detectPlatform(url);
        const fallbackTitle =
          platform === "tiktok" ? "TikTok Video" : "YouTube Video";
        setVideo({ url, videoId, title: tabs[0]?.title || fallbackTitle });
      }
    });
    if (!isGuest) loadRecentAnalyses();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isGuest]);

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

  // Mapping plan backend → plan voice (widget n'accepte que free/pro/expert).
  // Voice call est une feature Expert : tout le reste retombe sur "free"
  // (badge essai gratuit ou disabled). Pro reste "pro" pour permettre le CTA
  // upgrade futur — actuellement le widget ne distingue pas pro.
  const voicePlan: "free" | "pro" | "expert" =
    userPlanId === "expert" ? "expert" : userPlanId === "pro" ? "pro" : "free";
  // trialUsed et monthlyMinutesUsed ne sont pas encore exposés dans PlanInfo
  // (backend Task 7 à étendre). Default = false / 0 ; le backend reste la
  // source de vérité au moment de l'appel POST /voice/session.
  const voiceTrialUsed = false;
  const voiceMonthlyMinutesUsed = 0;

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

  // Chat view
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

  return (
    <div className="main-view">
      {/* Header */}
      <div className="main-header">
        <div className="main-header-left">
          <DeepSightSpinner size="xs" speed="slow" />
          {isGuest ? (
            <h1>DeepSight</h1>
          ) : isFree ? (
            <h1>DeepSight {planName || t.plans.free}</h1>
          ) : (
            <h1>DeepSight {planName}</h1>
          )}
        </div>
        <div className="main-header-actions">
          <button
            className="btn-open-webapp"
            onClick={() => Browser.tabs.create({ url: WEBAPP_URL })}
            title="Ouvrir DeepSight"
          >
            <ExternalLinkIcon size={12} /> Web
          </button>
          {isGuest ? (
            <button className="btn-header-login" onClick={onLoginRedirect}>
              {t.common.login}
            </button>
          ) : (
            <button
              className="icon-btn icon-btn-danger"
              onClick={onLogout}
              title={t.common.logout}
            >
              <LogoutIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {/* User/Plan bar */}
      {!isGuest && user && (
        <div className="user-bar">
          <span className={`plan-badge plan-${user.plan}`}>
            {t.plans[user.plan as keyof typeof t.plans] || user.plan}
          </span>
          {planInfo ? (
            <span
              className={`user-quota ${quotaWarning ? "quota-warning" : ""}`}
            >
              {planInfo.analyses_this_month}/{planInfo.monthly_analyses}{" "}
              {t.common.analyses}
            </span>
          ) : (
            <span className="user-credits">
              {user.credits} {t.common.credits}
            </span>
          )}
          {creditsLow && (
            <span
              className={`credits-urgency ${creditsCritical ? "credits-critical" : "credits-low"}`}
              title={t.credits.remaining.replace(
                "{count}",
                String(creditsRemaining),
              )}
            >
              {creditsCritical ? "\u{1F6A8}" : "\u26A0\uFE0F"}{" "}
              {creditsRemaining} {t.credits.low}
            </span>
          )}
        </div>
      )}

      {!isGuest && creditsCritical && (
        <div className="credits-banner-critical">
          <span>
            {t.credits.critical.replace(
              "{count}",
              String(creditsRemaining),
            )}{" "}
          </span>
          <a
            href={`${WEBAPP_URL}/upgrade`}
            onClick={(e) => {
              e.preventDefault();
              Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
            }}
          >
            {t.credits.recharge} {"\u2197"}
          </a>
        </div>
      )}

      {isGuest && (
        <div className="guest-banner">
          <span>{t.guest.banner}</span>
        </div>
      )}

      {/* YouTube recommendation banner */}
      {showYtBanner && (
        <div className="yt-recommend-banner">
          <div className="yt-recommend-content">
            <img
              src={Browser.runtime.getURL("platforms/youtube-icon-red.png")}
              alt="YouTube"
              style={{ height: 18, width: "auto", flexShrink: 0 }}
            />
            <div className="yt-recommend-text">
              <span className="yt-recommend-title">{t.ytRecommend.title}</span>
              <span className="yt-recommend-subtitle">
                {t.ytRecommend.subtitle}
              </span>
            </div>
          </div>
          <button
            className="yt-recommend-dismiss"
            onClick={dismissYtBanner}
            title={t.ytRecommend.dismiss}
          >
            {"\u2715"}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="main-content">
        {/* Video status */}
        {video ? (
          (() => {
            const platform = detectPlatform(video.url);
            const isTikTok = platform === "tiktok";
            const thumbSrc = isTikTok
              ? null
              : `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
            const urlLabel = isTikTok
              ? `tiktok.com/video/${video.videoId}`
              : `youtube.com/watch?v=${video.videoId}`;
            return (
              <div className="video-status-card">
                {thumbSrc ? (
                  <img
                    src={thumbSrc}
                    alt=""
                    className="video-thumbnail"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="video-thumbnail"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(200,144,58,0.1)",
                    }}
                  >
                    <DoodleIcon
                      name="waveform"
                      size={20}
                      color="var(--accent-primary)"
                    />
                  </div>
                )}
                <div className="video-status-body">
                  <span className="video-status-title">
                    {video.title.length > 52
                      ? video.title.substring(0, 52) + "\u2026"
                      : video.title}
                  </span>
                  <span className="video-status-url">{urlLabel}</span>
                </div>
                <div className="video-live-dot" title="Video detected" />
              </div>
            );
          })()
        ) : (
          <div className="video-status">
            <div className="video-status-icon">
              <DoodleIcon name="play" size={16} color="var(--text-muted)" />
            </div>
            <span className="video-status-text video-status-none">
              {t.analysis.noVideo}
            </span>
          </div>
        )}

        {/* Voice Call — visible dès qu'une video est détectée, à côté de Analyser */}
        {video && (
          <VoiceCallButton
            plan={voicePlan}
            trialUsed={voiceTrialUsed}
            monthlyMinutesUsed={voiceMonthlyMinutesUsed}
            videoId={video.videoId}
            videoTitle={video.title}
          />
        )}

        {/* Analysis controls */}
        {video && analysis.phase === "idle" && (
          <>
            {!isGuest && isQuotaExceeded ? (
              <div className="quota-exceeded">
                <p className="quota-exceeded-text">
                  {t.analysis.quotaExceeded} ({planInfo?.analyses_this_month}/
                  {planInfo?.monthly_analyses}) — {t.analysis.quotaExceededText}
                </p>
                <button
                  className="analyze-btn analyze-btn-disabled btn-shimmer"
                  disabled
                >
                  {t.analysis.analyzeButton}
                </button>
                <button
                  className="quickchat-btn"
                  onClick={startQuickChat}
                  disabled={quickChatLoading}
                >
                  {quickChatLoading
                    ? t.analysis.quickChatPreparing
                    : t.analysis.quickChatButton}
                </button>
                <a
                  href={`${WEBAPP_URL}/upgrade`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-upgrade-cta"
                  onClick={(e) => {
                    e.preventDefault();
                    Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
                  }}
                >
                  {t.common.viewPlans} {"\u2197"}
                </a>
              </div>
            ) : isGuest && guestUsed ? (
              <div className="guest-exhausted">
                <p className="guest-exhausted-text">{t.guest.exhaustedText}</p>
                <button
                  className="btn-create-account"
                  onClick={() =>
                    Browser.tabs.create({ url: `${WEBAPP_URL}/register` })
                  }
                >
                  {t.common.createAccount} {"\u2197"}
                </button>
              </div>
            ) : (
              <>
                <div className="selectors-row">
                  <div className="ds-select-wrapper">
                    <label>{t.analysis.mode}</label>
                    <select
                      className="ds-select"
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="standard">
                        {t.analysis.modes.standard}
                      </option>
                      <option value="accessible">
                        {t.analysis.modes.accessible}
                      </option>
                    </select>
                  </div>
                  <div className="ds-select-wrapper">
                    <label>{t.analysis.language}</label>
                    <select
                      className="ds-select"
                      value={lang}
                      onChange={(e) => setLang(e.target.value)}
                    >
                      <option value="fr">{t.analysis.languages.fr}</option>
                      <option value="en">{t.analysis.languages.en}</option>
                      <option value="es">{t.analysis.languages.es}</option>
                      <option value="de">{t.analysis.languages.de}</option>
                    </select>
                  </div>
                </div>
                <button
                  className="quickchat-btn"
                  onClick={startQuickChat}
                  disabled={!video || quickChatLoading}
                >
                  {quickChatLoading
                    ? t.analysis.quickChatPreparing
                    : t.analysis.quickChatButton}
                </button>
                <button
                  className="analyze-btn btn-shimmer"
                  onClick={startAnalysis}
                  style={{ animation: "float 3s ease-in-out infinite" }}
                >
                  {t.analysis.analyzeButton}
                </button>
                <div className="mistral-badge">
                  <span>{"\uD83C\uDDEB\uD83C\uDDF7"}</span>
                  <span>{t.mistral.badge}</span>
                </div>
              </>
            )}
          </>
        )}

        {/* Progress */}
        {analysis.phase === "analyzing" && (
          <div className="progress-container">
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <DeepSightSpinner size="sm" speed="fast" />
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${analysis.progress}%` }}
              />
            </div>
            <p className="progress-text">{analysis.message}</p>
          </div>
        )}

        {/* Error */}
        {analysis.phase === "error" && (
          <div style={{ textAlign: "center", padding: "12px" }}>
            <p
              style={{
                color: "var(--error)",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              {analysis.message}
            </p>
            <button
              className="analyze-btn btn-shimmer"
              onClick={() => setAnalysis({ phase: "idle" })}
              style={{
                height: "40px",
                fontSize: "13px",
                animation: "float 3s ease-in-out infinite",
              }}
            >
              {t.common.retry}
            </button>
          </div>
        )}

        {/* Synthesis */}
        {analysis.phase === "complete" && (
          <>
            <SynthesisView
              summary={analysis.summary}
              summaryId={analysis.summaryId}
              planInfo={planInfo}
              onOpenChat={() => setChatOpen(true)}
            />

            {!isGuest && nextPlan && userPlanId !== "pro" && (
              <div className="post-analysis-upsell">
                <div className="upsell-content">
                  <DoodleIcon
                    name="sparkle4pt"
                    size={18}
                    color="var(--accent-primary)"
                  />
                  <div className="upsell-text">
                    <span className="upsell-headline">{nextPlan.feature}</span>
                    <span className="upsell-sub">
                      Plan {nextPlan.label} — {nextPlan.price}/
                      {language === "fr" ? "mois" : "mo"}
                    </span>
                  </div>
                </div>
                <a
                  href={`${WEBAPP_URL}/upgrade`}
                  className="upsell-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
                  }}
                >
                  {t.common.unlock} {"\u2197"}
                </a>
              </div>
            )}

            {isGuest && (
              <div className="guest-post-analysis">
                <p>{t.guest.exhaustedText}</p>
                <button
                  className="btn-create-account"
                  onClick={() =>
                    Browser.tabs.create({ url: `${WEBAPP_URL}/register` })
                  }
                >
                  {t.common.createAccount} {"\u2197"}
                </button>
              </div>
            )}
          </>
        )}

        {/* Recent */}
        {!isGuest && analysis.phase === "idle" && recentAnalyses.length > 0 && (
          <div className="recent-section">
            <h3>{t.analysis.recent}</h3>
            <div className="recent-list">
              {recentAnalyses.slice(0, 5).map((item) => (
                <a
                  key={item.videoId}
                  href={`${WEBAPP_URL}/summary/${item.summaryId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="recent-item"
                >
                  {item.platform === "tiktok" ? (
                    <div
                      style={{
                        width: 48,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(200,144,58,0.1)",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      <DoodleIcon
                        name="waveform"
                        size={16}
                        color="var(--accent-primary)"
                      />
                    </div>
                  ) : (
                    <img
                      src={getThumbnailUrl(item.videoId, "youtube") || ""}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <span className="recent-title">{item.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Promo Banner */}
      <PromoBanner planInfo={planInfo} />
    </div>
  );
};
