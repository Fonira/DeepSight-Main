import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { User, Summary, RecentAnalysis, PlanInfo } from '../../types';
import { extractVideoId, getThumbnailUrl, detectPlatform, type VideoPlatform } from '../../utils/video';
import { addRecentAnalysis, getRecentAnalyses, getFreeAnalysisCount, incrementFreeAnalysisCount } from '../../utils/storage';
import { WEBAPP_URL } from '../../utils/config';
import { LogoutIcon, PlayIcon, ExternalLinkIcon } from './Icons';
import { SynthesisView } from './SynthesisView';
import { ChatDrawer } from './ChatDrawer';
import { PromoBanner } from './PromoBanner';

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
  | { phase: 'idle' }
  | { phase: 'analyzing'; progress: number; message: string }
  | { phase: 'complete'; summaryId: number; summary: Summary }
  | { phase: 'error'; message: string };

// Plan display names — sync avec planPrivileges.ts (source de vérité)
// ⚠️ SYNC avec planPrivileges.ts — noms swappés : etudiant→"Starter", starter→"Étudiant"
const PLAN_DISPLAY: Record<string, string> = {
  free: 'Gratuit',
  etudiant: 'Starter',
  student: 'Starter',    // alias rétrocompatibilité
  starter: 'Étudiant',
  pro: 'Pro',
  equipe: 'Pro',         // legacy → redirige vers Pro
  team: 'Pro',           // legacy → redirige vers Pro
};

// ── Next plan upsell config ──
interface NextPlanHint {
  label: string;
  feature: string;
  price: string;
}

const NEXT_PLAN_HINT: Record<string, NextPlanHint> = {
  free: { label: 'Starter', feature: 'Flashcards + Cartes mentales', price: '2,99€' },
  etudiant: { label: 'Étudiant', feature: 'Recherche web IA + 50 analyses', price: '5,99€' },
  student: { label: 'Étudiant', feature: 'Recherche web IA + 50 analyses', price: '5,99€' },
  starter: { label: 'Pro', feature: 'Playlists + Exports + Chat illimité', price: '12,99€' },
};

export const MainView: React.FC<MainViewProps> = ({ user, planInfo, isGuest, onLogout, onLoginRedirect, onError }) => {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [mode, setMode] = useState<string>(user?.default_mode || 'standard');
  const [lang, setLang] = useState<string>(user?.default_lang || 'fr');
  const [analysis, setAnalysis] = useState<AnalysisPhase>({ phase: 'idle' });
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [guestUsed, setGuestUsed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check guest analysis count
  useEffect(() => {
    if (isGuest) {
      getFreeAnalysisCount().then((count) => {
        if (count >= 1) setGuestUsed(true);
      });
    }
  }, [isGuest]);

  // Detect current YouTube or TikTok video
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      const videoId = extractVideoId(url);
      if (videoId) {
        const platform = detectPlatform(url);
        const fallbackTitle = platform === 'tiktok' ? 'TikTok Video' : 'YouTube Video';
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

  // ── Quota calculations ──
  const isQuotaExceeded = planInfo
    ? planInfo.analyses_this_month >= planInfo.monthly_analyses
    : false;
  const quotaRemaining = planInfo
    ? planInfo.monthly_analyses - planInfo.analyses_this_month
    : null;
  const quotaWarning = planInfo && planInfo.monthly_analyses > 0
    ? (quotaRemaining !== null && quotaRemaining / planInfo.monthly_analyses < 0.2)
    : false;

  // ── Credits urgency ──
  const creditsTotal = planInfo?.credits_monthly || user?.credits_monthly || 0;
  const creditsRemaining = planInfo?.credits ?? user?.credits ?? 0;
  const creditsLow = creditsTotal > 0 && creditsRemaining / creditsTotal < 0.3;
  const creditsCritical = creditsTotal > 0 && creditsRemaining / creditsTotal < 0.1;

  // ── Next plan hint for upsell ──
  const userPlanId = planInfo?.plan_id || user?.plan || 'free';
  const nextPlan = NEXT_PLAN_HINT[userPlanId] || null;

  const startAnalysis = useCallback(async () => {
    if (!video) return;

    // Guest mode: check limit
    if (isGuest) {
      const count = await getFreeAnalysisCount();
      if (count >= 1) {
        setGuestUsed(true);
        return;
      }
    }

    setAnalysis({ phase: 'analyzing', progress: 0, message: 'Démarrage de l\'analyse...' });

    try {
      const startRes = await chrome.runtime.sendMessage({
        action: 'START_ANALYSIS',
        data: { url: video.url, options: { mode, lang } },
      });

      if (!startRes.success) {
        setAnalysis({ phase: 'error', message: startRes.error || 'Impossible de démarrer l\'analyse' });
        return;
      }

      const taskId = (startRes.result as { task_id: string }).task_id;

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await chrome.runtime.sendMessage({
            action: 'GET_TASK_STATUS',
            data: { taskId },
          });

          if (!statusRes.success || !statusRes.status) return;
          const status = statusRes.status;

          if (status.status === 'completed' && status.result?.summary_id) {
            if (pollRef.current) clearInterval(pollRef.current);

            // Increment guest counter if guest
            if (isGuest) {
              await incrementFreeAnalysisCount();
              setGuestUsed(true);
            }

            await addRecentAnalysis({
              videoId: video.videoId,
              summaryId: status.result.summary_id,
              title: status.result.video_title || video.title,
            });

            const summaryRes = await chrome.runtime.sendMessage({
              action: 'GET_SUMMARY',
              data: { summaryId: status.result.summary_id },
            });

            if (summaryRes.success && summaryRes.summary) {
              setAnalysis({
                phase: 'complete',
                summaryId: status.result.summary_id,
                summary: summaryRes.summary,
              });
              loadRecentAnalyses();
            }
          } else if (status.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setAnalysis({ phase: 'error', message: status.error || 'Analyse échouée' });
          } else {
            setAnalysis({
              phase: 'analyzing',
              progress: status.progress || 0,
              message: status.message || 'Traitement en cours...',
            });
          }
        } catch {
          // Polling error — will retry
        }
      }, 2500);
    } catch (e) {
      setAnalysis({ phase: 'error', message: (e as Error).message });
    }
  }, [video, mode, lang, isGuest]);

  // Chat view
  if (chatOpen && analysis.phase === 'complete') {
    return (
      <ChatDrawer
        summaryId={analysis.summaryId}
        videoTitle={analysis.summary.video_title}
        onClose={() => setChatOpen(false)}
        onSessionExpired={onLogout}
        userPlan={planInfo?.plan_id || user?.plan || 'free'}
      />
    );
  }

  const planName = planInfo ? PLAN_DISPLAY[planInfo.plan_id] || planInfo.plan_name : null;
  const isFree = !user || user.plan === 'free';

  return (
    <div className="main-view">
      {/* Header */}
      <div className="main-header">
        <div className="main-header-left">
          <img
            src={chrome.runtime.getURL('assets/deepsight-logo-cosmic.png')}
            alt=""
            className="main-header-logo"
            width={24}
            height={24}
          />
          {isGuest ? (
            <h1>Deep Sight</h1>
          ) : isFree ? (
            <h1>{'\u26A1'} Deep Sight {planName || 'D\u00e9couverte'}</h1>
          ) : (
            <h1>Deep Sight {planName}</h1>
          )}
        </div>
        <div className="main-header-actions">
          {isGuest ? (
            <button className="btn-header-login" onClick={onLoginRedirect}>
              Se connecter
            </button>
          ) : (
            <button className="icon-btn icon-btn-danger" onClick={onLogout} title="Déconnexion">
              <LogoutIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {/* User/Plan bar with credits urgency */}
      {!isGuest && user && (
        <div className="user-bar">
          <span className={`plan-badge plan-${user.plan}`}>
            {PLAN_DISPLAY[user.plan] || user.plan}
          </span>
          {planInfo ? (
            <span className={`user-quota ${quotaWarning ? 'quota-warning' : ''}`}>
              {planInfo.analyses_this_month}/{planInfo.monthly_analyses} analyses
            </span>
          ) : (
            <span className="user-credits">{user.credits} crédits</span>
          )}
          {/* Credits urgency badge */}
          {creditsLow && (
            <span
              className={`credits-urgency ${creditsCritical ? 'credits-critical' : 'credits-low'}`}
              title={`${creditsRemaining} crédits restants`}
            >
              {creditsCritical ? '\u{1F6A8}' : '\u26A0\uFE0F'} {creditsRemaining} cr.
            </span>
          )}
        </div>
      )}

      {/* Credits urgency banner — full width when critical */}
      {!isGuest && creditsCritical && (
        <div className="credits-banner-critical">
          <span>Plus que {creditsRemaining} crédits — </span>
          <a
            href={`${WEBAPP_URL}/upgrade`}
            onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: `${WEBAPP_URL}/upgrade` }); }}
          >
            Recharger {'\u2197'}
          </a>
        </div>
      )}

      {/* Guest banner */}
      {isGuest && (
        <div className="guest-banner">
          <span>Mode découverte — 1 analyse gratuite sans compte</span>
        </div>
      )}

      {/* Content */}
      <div className="main-content">
        {/* Video status — card with thumbnail when detected, minimal when not */}
        {video ? (() => {
          const platform = detectPlatform(video.url);
          const isTikTok = platform === 'tiktok';
          const thumbSrc = isTikTok ? null : `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
          const urlLabel = isTikTok ? `tiktok.com/video/${video.videoId}` : `youtube.com/watch?v=${video.videoId}`;
          return (
          <div className="video-status-card">
            {thumbSrc ? (
              <img
                src={thumbSrc}
                alt=""
                className="video-thumbnail"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="video-thumbnail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,182,212,0.1)' }}>
                <span style={{ fontSize: 20 }}>🎵</span>
              </div>
            )}
            <div className="video-status-body">
              <span className="video-status-title">
                {video.title.length > 52 ? video.title.substring(0, 52) + '\u2026' : video.title}
              </span>
              <span className="video-status-url">{urlLabel}</span>
            </div>
            <div className="video-live-dot" title="Vidéo détectée" />
          </div>
          );
        })() : (
          <div className="video-status">
            <div className="video-status-icon">
              <PlayIcon size={16} />
            </div>
            <span className="video-status-text video-status-none">
              Ouvre une vidéo YouTube ou TikTok pour l&apos;analyser
            </span>
          </div>
        )}

        {/* Analysis controls */}
        {video && analysis.phase === 'idle' && (
          <>
            {/* Quota exceeded — logged in user */}
            {!isGuest && isQuotaExceeded ? (
              <div className="quota-exceeded">
                <p className="quota-exceeded-text">
                  {'\uD83D\uDCCA'} Quota atteint ({planInfo?.analyses_this_month}/{planInfo?.monthly_analyses}) — Passez au plan sup&eacute;rieur
                </p>
                <button
                  className="analyze-btn analyze-btn-disabled"
                  disabled
                >
                  {'\u2728'} Analyser cette vid&eacute;o
                </button>
                <a
                  href={`${WEBAPP_URL}/upgrade`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-upgrade-cta"
                  onClick={(e) => {
                    e.preventDefault();
                    chrome.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
                  }}
                >
                  Voir les plans {'\u2197'}
                </a>
              </div>
            ) : isGuest && guestUsed ? (
              /* Guest used their free analysis */
              <div className="guest-exhausted">
                <p className="guest-exhausted-text">
                  Cr&eacute;ez un compte gratuit pour sauvegarder vos analyses et en faire plus
                </p>
                <button
                  className="btn-create-account"
                  onClick={() => chrome.tabs.create({ url: `${WEBAPP_URL}/register` })}
                >
                  Cr&eacute;er un compte {'\u2197'}
                </button>
              </div>
            ) : (
              /* Normal controls */
              <>
                <div className="selectors-row">
                  <div className="ds-select-wrapper">
                    <label>Mode</label>
                    <select className="ds-select" value={mode} onChange={(e) => setMode(e.target.value)}>
                      <option value="standard">Standard</option>
                      <option value="accessible">Accessible</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                  <div className="ds-select-wrapper">
                    <label>Langue</label>
                    <select className="ds-select" value={lang} onChange={(e) => setLang(e.target.value)}>
                      <option value="fr">Fran&ccedil;ais</option>
                      <option value="en">English</option>
                      <option value="es">Espa&ntilde;ol</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>
                </div>
                <button className="analyze-btn" onClick={startAnalysis}>
                  {'\u2728'} Analyser cette vid&eacute;o
                </button>
                {/* Mistral AI attribution */}
                <div className="mistral-badge">
                  <span>{'\uD83C\uDDEB\uD83C\uDDF7'}</span>
                  <span>Propuls&eacute; par Mistral AI</span>
                </div>
              </>
            )}
          </>
        )}

        {/* Progress */}
        {analysis.phase === 'analyzing' && (
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${analysis.progress}%` }} />
            </div>
            <p className="progress-text">{analysis.message}</p>
          </div>
        )}

        {/* Error */}
        {analysis.phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <p style={{ color: 'var(--ds-error)', fontSize: '13px', marginBottom: '8px' }}>
              {'\u274C'} {analysis.message}
            </p>
            <button
              className="analyze-btn"
              onClick={() => setAnalysis({ phase: 'idle' })}
              style={{ height: '40px', fontSize: '13px' }}
            >
              R&eacute;essayer
            </button>
          </div>
        )}

        {/* Synthesis */}
        {analysis.phase === 'complete' && (
          <>
            <SynthesisView
              summary={analysis.summary}
              summaryId={analysis.summaryId}
              planInfo={planInfo}
              onOpenChat={() => setChatOpen(true)}
            />

            {/* Post-analysis upsell — plan-aware CTA */}
            {!isGuest && nextPlan && userPlanId !== 'pro' && (
              <div className="post-analysis-upsell">
                <div className="upsell-content">
                  <span className="upsell-emoji">{'\u2728'}</span>
                  <div className="upsell-text">
                    <span className="upsell-headline">
                      {nextPlan.feature}
                    </span>
                    <span className="upsell-sub">
                      Plan {nextPlan.label} — {nextPlan.price}/mois
                    </span>
                  </div>
                </div>
                <a
                  href={`${WEBAPP_URL}/upgrade`}
                  className="upsell-btn"
                  onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: `${WEBAPP_URL}/upgrade` }); }}
                >
                  D&eacute;bloquer {'\u2197'}
                </a>
              </div>
            )}

            {/* Guest post-analysis CTA */}
            {isGuest && (
              <div className="guest-post-analysis">
                <p>Cr&eacute;ez un compte gratuit pour sauvegarder vos analyses et en faire plus</p>
                <button
                  className="btn-create-account"
                  onClick={() => chrome.tabs.create({ url: `${WEBAPP_URL}/register` })}
                >
                  Cr&eacute;er un compte {'\u2197'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Recent */}
        {!isGuest && analysis.phase === 'idle' && recentAnalyses.length > 0 && (
          <div className="recent-section">
            <h3>Analyses r&eacute;centes</h3>
            <div className="recent-list">
              {recentAnalyses.slice(0, 5).map((item) => (
                <a
                  key={item.videoId}
                  href={`${WEBAPP_URL}/summary/${item.summaryId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="recent-item"
                >
                  {item.platform === 'tiktok' ? (
                    <div style={{ width: 48, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,182,212,0.1)', borderRadius: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 16 }}>🎵</span>
                    </div>
                  ) : (
                    <img src={getThumbnailUrl(item.videoId, 'youtube') || ''} alt="" loading="lazy" />
                  )}
                  <span className="recent-title">{item.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Promo Banner — plan-aware, at the bottom */}
      <PromoBanner planInfo={planInfo} />
    </div>
  );
};
