import React, { useState, useEffect, useRef, useCallback } from "react";
import type {
  User,
  Summary,
  PlanInfo,
  QuickChatResponse,
  MessageResponse,
} from "../../types";
import Browser from "../../utils/browser-polyfill";
import { extractVideoId, detectPlatform } from "../../utils/video";
import {
  addRecentAnalysis,
  getFreeAnalysisCount,
  incrementFreeAnalysisCount,
} from "../../utils/storage";
import { WEBAPP_URL } from "../../utils/config";
import { LogoutIcon, ExternalLinkIcon } from "../shared/Icons";
import { DeepSightSpinner } from "../shared/DeepSightSpinner";
import { DoodleIcon } from "../shared/doodles/DoodleIcon";
import { useTranslation } from "../../i18n/useTranslation";

interface AnalysisViewProps {
  user: User | null;
  planInfo: PlanInfo | null;
  isGuest: boolean;
  onLogout: () => void;
  onLoginRedirect: () => void;
  onError: (msg: string) => void;
  onAnalysisComplete: (summaryId: number, summary: Summary) => void;
}

interface VideoInfo {
  url: string;
  videoId: string;
  title: string;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  user,
  planInfo,
  isGuest,
  onLogout,
  onLoginRedirect,
  onError,
  onAnalysisComplete,
}) => {
  const { t, language } = useTranslation();
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [mode, setMode] = useState<string>(user?.default_mode || "standard");
  const [lang, setLang] = useState<string>(user?.default_lang || "fr");
  const [phase, setPhase] = useState<"idle" | "analyzing" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [guestUsed, setGuestUsed] = useState(false);
  const [quickChatLoading, setQuickChatLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isGuest) {
      getFreeAnalysisCount().then((count) => {
        if (count >= 3) setGuestUsed(true);
      });
    }
  }, [isGuest]);

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
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
  const creditsCritical =
    creditsTotal > 0 && creditsRemaining / creditsTotal < 0.1;

  const userPlanId = planInfo?.plan_id || user?.plan || "free";

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

    setPhase("analyzing");
    setProgress(0);
    setProgressMsg(t.analysis.starting);

    try {
      const startRes = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "START_ANALYSIS",
        data: { url: video.url, options: { mode, lang } },
      });

      if (!startRes.success) {
        setPhase("error");
        setErrorMsg(startRes.error || t.analysis.startFailed);
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
              onAnalysisComplete(status.result.summary_id, summaryRes.summary);
            }
          } else if (status.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase("error");
            setErrorMsg(status.error || t.analysis.failed);
          } else {
            setProgress(status.progress || 0);
            setProgressMsg(status.message || t.analysis.processing);
          }
        } catch {
          // Polling error — will retry
        }
      }, 2500);
    } catch (e) {
      setPhase("error");
      setErrorMsg((e as Error).message);
    }
  }, [video, mode, lang, isGuest, t, onAnalysisComplete]);

  const planName = planInfo
    ? t.plans[planInfo.plan_id as keyof typeof t.plans] || planInfo.plan_name
    : null;

  return (
    <div className="analysis-view">
      {/* Header */}
      <div className="main-header">
        <div className="main-header-left">
          <img
            src={Browser.runtime.getURL("assets/deepsight-logo-cosmic.png")}
            alt="DeepSight"
            className="header-logo-img"
          />
          <h1>DeepSight</h1>
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

      {/* Platform logos strip */}
      <div className="platform-logos-strip">
        <img
          src={Browser.runtime.getURL("platforms/youtube-icon-red.svg")}
          alt="YouTube"
        />
        <img
          src={Browser.runtime.getURL("platforms/tiktok-note-color.svg")}
          alt="TikTok"
        />
        <img
          src={Browser.runtime.getURL("platforms/mistral-icon.svg")}
          alt="Mistral AI"
        />
        <img
          src={Browser.runtime.getURL("platforms/tournesol-logo.png")}
          alt="Tournesol"
        />
      </div>

      {/* User bar */}
      {!isGuest && user && (
        <div className="user-bar">
          <span className={`plan-badge plan-${user.plan}`}>
            {t.plans[user.plan as keyof typeof t.plans] || user.plan}
          </span>
          {planInfo && (
            <span
              className={`user-quota ${quotaWarning ? "quota-warning" : ""}`}
            >
              {planInfo.analyses_this_month}/{planInfo.monthly_analyses}{" "}
              {t.common.analyses}
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

      {/* Content */}
      <div className="main-content">
        {/* Video card */}
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
                  <div className="video-thumbnail video-thumbnail-placeholder">
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

        {/* Analysis controls — idle state */}
        {video && phase === "idle" && (
          <>
            {!isGuest && isQuotaExceeded ? (
              <div className="quota-exceeded">
                <p className="quota-exceeded-text">
                  {t.analysis.quotaExceeded} ({planInfo?.analyses_this_month}/
                  {planInfo?.monthly_analyses}) — {t.analysis.quotaExceededText}
                </p>
                <button className="analyze-btn analyze-btn-disabled" disabled>
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
                <button className="analyze-btn" onClick={startAnalysis}>
                  {t.analysis.analyzeButton}
                </button>
                <button
                  className="quickchat-btn"
                  onClick={startQuickChat}
                  disabled={!video || quickChatLoading}
                >
                  {quickChatLoading
                    ? t.analysis.quickChatPreparing
                    : t.analysis.quickChatButton}
                </button>
                <div className="mistral-badge">
                  <img
                    src={Browser.runtime.getURL("platforms/mistral-icon.svg")}
                    alt=""
                    style={{ height: 12, width: "auto" }}
                  />
                  <span>{t.mistral.badge}</span>
                </div>
              </>
            )}
          </>
        )}

        {/* Progress — analyzing state */}
        {phase === "analyzing" && (
          <div className="progress-container">
            <div className="hero-spinner">
              <DeepSightSpinner size="md" speed="fast" showLogos />
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="progress-text">{progressMsg}</p>
            <p className="progress-percent">{progress}%</p>
          </div>
        )}

        {/* Error state */}
        {phase === "error" && (
          <div className="error-container">
            <p className="error-message">{errorMsg}</p>
            <button className="analyze-btn" onClick={() => setPhase("idle")}>
              {t.common.retry}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
