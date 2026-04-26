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

  return (
    <div className="ds-app">
      <div className="ds-app-scroll ds-stagger">
        {/* ── Hero header ────────────────────────────────────────── */}
        <div className="ds-hero">
          <div className="ds-hero-spinner">
            <DeepSightSpinner size="sm" speed="slow" />
          </div>
          <h1 className="ds-hero-title">DeepSight</h1>
          <div className="ds-hero-actions">
            <span
              className={`ds-plan-chip ${
                userPlanId === "pro" || userPlanId === "expert"
                  ? "ds-plan-chip-pro"
                  : ""
              }`}
            >
              {planLabel}
            </span>
            <button
              className="ds-icon-btn"
              onClick={() => Browser.tabs.create({ url: WEBAPP_URL })}
              title="Ouvrir DeepSight"
              aria-label="Ouvrir DeepSight"
            >
              <ExternalLinkIcon size={13} />
            </button>
            {isGuest ? (
              <button
                className="ds-button-ghost"
                onClick={onLoginRedirect}
                aria-label={t.common.login}
              >
                {t.common.login}
              </button>
            ) : (
              <button
                className="ds-icon-btn ds-icon-btn-danger"
                onClick={onLogout}
                title={t.common.logout}
                aria-label={t.common.logout}
              >
                <LogoutIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── User stats strip (quota + credits low) ─────────────── */}
        {!isGuest && user && (
          <div
            style={{
              padding: "0 18px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {planInfo ? (
              <span
                className={`ds-quota-strip ${quotaWarning ? "warning" : ""}`}
              >
                <DoodleIcon name="lightning" size={11} />
                {planInfo.analyses_this_month}/{planInfo.monthly_analyses}{" "}
                {t.common.analyses}
              </span>
            ) : (
              <span className="ds-quota-strip">
                <DoodleIcon name="diamond" size={11} />
                {user.credits} {t.common.credits}
              </span>
            )}
            {creditsLow && (
              <span
                className={`ds-quota-strip ${creditsCritical ? "warning" : ""}`}
                title={t.credits.remaining.replace(
                  "{count}",
                  String(creditsRemaining),
                )}
              >
                {creditsCritical ? "\u{1F6A8}" : "⚠️"} {creditsRemaining}{" "}
                {t.credits.low}
              </span>
            )}
          </div>
        )}

        {/* ── Banners (severity ordered) ─────────────────────────── */}
        {!isGuest && creditsCritical && (
          <div className="ds-banner error">
            <span className="ds-banner-icon">
              <DoodleIcon name="lightning" size={14} />
            </span>
            <div className="ds-banner-content">
              <span className="ds-banner-title">
                {t.credits.critical.replace(
                  "{count}",
                  String(creditsRemaining),
                )}
              </span>
            </div>
            <a
              className="ds-banner-cta"
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
          <div className="ds-banner cyan">
            <span className="ds-banner-icon">
              <DoodleIcon name="sparkle4pt" size={14} />
            </span>
            <div className="ds-banner-content">
              <span className="ds-banner-subtitle">{t.guest.banner}</span>
            </div>
          </div>
        )}

        {showYtBanner && (
          <div className="ds-banner">
            <img
              src={Browser.runtime.getURL("platforms/youtube-icon-red.png")}
              alt="YouTube"
              style={{ height: 16, width: "auto", flexShrink: 0 }}
            />
            <div className="ds-banner-content">
              <span className="ds-banner-title">{t.ytRecommend.title}</span>
              <span className="ds-banner-subtitle">
                {t.ytRecommend.subtitle}
              </span>
            </div>
            <button
              className="ds-banner-dismiss"
              onClick={dismissYtBanner}
              title={t.ytRecommend.dismiss}
              aria-label={t.ytRecommend.dismiss}
            >
              {"✕"}
            </button>
          </div>
        )}

        {/* ── Video detection / empty state ──────────────────────── */}
        {video ? (
          <div className="ds-video-card">
            {thumbSrc ? (
              <img
                src={thumbSrc}
                alt=""
                className="ds-video-thumb"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="ds-video-thumb-fallback">
                <DoodleIcon
                  name="waveform"
                  size={22}
                  color="rgba(199, 210, 254, 0.7)"
                />
              </div>
            )}
            <div className="ds-video-info">
              <span className="ds-video-title">{video.title}</span>
              <div className="ds-video-meta">
                <span className="ds-platform-pill">
                  {isTikTok ? "TikTok" : "YouTube"}
                </span>
                <span className="ds-video-live-dot" title="Vidéo détectée" />
              </div>
            </div>
          </div>
        ) : (
          <div className="ds-empty-card">
            <div className="ds-empty-icon">
              <DoodleIcon
                name="play"
                size={20}
                color="var(--ds-accent-indigo)"
              />
            </div>
            <span className="ds-empty-text">{t.analysis.noVideo}</span>
          </div>
        )}

        {/* ── Analysis flow (idle / quota / guest exhausted) ─────── */}
        {video && analysis.phase === "idle" && (
          <>
            {!isGuest && isQuotaExceeded ? (
              <div className="ds-card">
                <DoodleIcon
                  name="shield"
                  size={48}
                  color="var(--ds-accent-violet)"
                  className="ds-card-doodle"
                />
                <div className="ds-card-title">{t.analysis.quotaExceeded}</div>
                <div className="ds-card-subtitle">
                  {planInfo?.analyses_this_month}/{planInfo?.monthly_analyses} —{" "}
                  {t.analysis.quotaExceededText}
                </div>
                <button
                  className="ds-button-secondary"
                  onClick={startQuickChat}
                  disabled={quickChatLoading}
                  style={{ marginBottom: 8 }}
                >
                  {quickChatLoading
                    ? t.analysis.quickChatPreparing
                    : t.analysis.quickChatButton}
                </button>
                <a
                  className="ds-button-primary"
                  href={`${WEBAPP_URL}/upgrade`}
                  onClick={(e) => {
                    e.preventDefault();
                    Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  {t.common.viewPlans} {"↗"}
                </a>
              </div>
            ) : isGuest && guestUsed ? (
              <div className="ds-card">
                <DoodleIcon
                  name="crown"
                  size={48}
                  color="var(--ds-accent-violet)"
                  className="ds-card-doodle"
                />
                <div className="ds-card-title">{t.guest.exhaustedText}</div>
                <button
                  className="ds-button-primary"
                  onClick={() =>
                    Browser.tabs.create({ url: `${WEBAPP_URL}/register` })
                  }
                >
                  {t.common.createAccount} {"↗"}
                </button>
              </div>
            ) : (
              <>
                {/* Mode + Lang as pill toggles */}
                <div className="ds-pill-row">
                  <div className="ds-pill-group">
                    <span className="ds-pill-label">{t.analysis.mode}</span>
                    <div className="ds-pill-toggle">
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
                  <div className="ds-pill-group">
                    <span className="ds-pill-label">{t.analysis.language}</span>
                    <div className="ds-pill-toggle">
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

                {/* Primary analysis card */}
                <div className="ds-card">
                  <DoodleIcon
                    name="sparkles"
                    size={42}
                    color="var(--ds-accent-indigo)"
                    className="ds-card-doodle"
                  />
                  <div className="ds-card-title">
                    {t.analysis.analyzeButton}
                  </div>
                  <div className="ds-card-subtitle">{t.mistral.badge}</div>
                  <button className="ds-button-primary" onClick={startAnalysis}>
                    {t.analysis.analyzeButton} {"→"}
                  </button>
                </div>

                {/* Quick Chat secondary card */}
                <div className="ds-card">
                  <DoodleIcon
                    name="lightbulb"
                    size={42}
                    color="var(--ds-accent-cyan)"
                    className="ds-card-doodle"
                  />
                  <div className="ds-card-title">
                    {t.analysis.quickChatButton}
                  </div>
                  <div className="ds-card-subtitle">
                    {t.analysis.quickChatPreparing}
                  </div>
                  <button
                    className="ds-button-secondary"
                    onClick={startQuickChat}
                    disabled={!video || quickChatLoading}
                  >
                    {quickChatLoading
                      ? t.analysis.quickChatPreparing
                      : t.analysis.quickChatButton}
                  </button>
                </div>

                {/* Mistral attribution mini-strip */}
                <div className="ds-mistral-strip">
                  <span>{"🇫🇷"}</span>
                  <span>{t.mistral.badge}</span>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Analyzing state ────────────────────────────────────── */}
        {analysis.phase === "analyzing" && (
          <div className="ds-progress-card">
            <DeepSightSpinner size="md" speed="fast" />
            <div className="ds-progress-bar">
              <div
                className="ds-progress-fill"
                style={{ width: `${analysis.progress}%` }}
              />
            </div>
            <p className="ds-progress-text">{analysis.message}</p>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────── */}
        {analysis.phase === "error" && (
          <div className="ds-card">
            <DoodleIcon
              name="shield"
              size={42}
              color="#fca5a5"
              className="ds-card-doodle"
            />
            <div className="ds-card-title" style={{ color: "#fca5a5" }}>
              {analysis.message}
            </div>
            <button
              className="ds-button-primary"
              onClick={() => setAnalysis({ phase: "idle" })}
            >
              {t.common.retry}
            </button>
          </div>
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
              <div className="ds-card">
                <DoodleIcon
                  name="sparkle4pt"
                  size={42}
                  color="var(--ds-accent-violet)"
                  className="ds-card-doodle"
                />
                <div className="ds-card-title">{nextPlan.feature}</div>
                <div className="ds-card-subtitle">
                  Plan {nextPlan.label} — {nextPlan.price}/
                  {language === "fr" ? "mois" : "mo"}
                </div>
                <a
                  className="ds-button-primary"
                  href={`${WEBAPP_URL}/upgrade`}
                  onClick={(e) => {
                    e.preventDefault();
                    Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  {t.common.unlock} {"↗"}
                </a>
              </div>
            )}

            {isGuest && (
              <div className="ds-card">
                <DoodleIcon
                  name="crown"
                  size={42}
                  color="var(--ds-accent-violet)"
                  className="ds-card-doodle"
                />
                <div className="ds-card-subtitle">{t.guest.exhaustedText}</div>
                <button
                  className="ds-button-primary"
                  onClick={() =>
                    Browser.tabs.create({ url: `${WEBAPP_URL}/register` })
                  }
                >
                  {t.common.createAccount} {"↗"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Recents ────────────────────────────────────────────── */}
        {!isGuest && analysis.phase === "idle" && recentAnalyses.length > 0 && (
          <>
            <h3 className="ds-section-title">
              <DoodleIcon name="book" size={11} />
              {t.analysis.recent}
            </h3>
            <div className="ds-recent-list">
              {recentAnalyses.slice(0, 5).map((item) => (
                <a
                  key={item.videoId}
                  href={`${WEBAPP_URL}/summary/${item.summaryId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ds-recent-item"
                >
                  {item.platform === "tiktok" ? (
                    <div className="ds-recent-thumb-fallback">
                      <DoodleIcon
                        name="waveform"
                        size={16}
                        color="rgba(199, 210, 254, 0.7)"
                      />
                    </div>
                  ) : (
                    <img
                      src={getThumbnailUrl(item.videoId, "youtube") || ""}
                      alt=""
                      loading="lazy"
                      className="ds-recent-thumb"
                    />
                  )}
                  <div className="ds-recent-meta">
                    <div className="ds-recent-title">{item.title}</div>
                  </div>
                  <span className="ds-recent-chevron">{"›"}</span>
                </a>
              ))}
            </div>
          </>
        )}

        {/* ── Footer (Mistral attribution) ───────────────────────── */}
        <div className="ds-footer">
          <DoodleIcon
            name="sparkle4pt"
            size={12}
            color="var(--ds-accent-indigo)"
            className="ds-footer-doodle"
          />
          <span>{t.mistral.badge}</span>
        </div>
      </div>

      {/* Promo Banner — kept at the bottom */}
      <PromoBanner planInfo={planInfo} />
    </div>
  );
};
