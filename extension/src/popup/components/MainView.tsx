import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { User, Summary, RecentAnalysis, PlanInfo } from '../../types';
import { extractVideoId, getThumbnailUrl } from '../../utils/youtube';
import { addRecentAnalysis, getRecentAnalyses, getFreeAnalysisCount, incrementFreeAnalysisCount } from '../../utils/storage';
import { WEBAPP_URL } from '../../utils/config';
import { LogoutIcon, PlayIcon, ExternalLinkIcon } from './Icons';
import { SynthesisView } from './SynthesisView';
import { ChatDrawer } from './ChatDrawer';

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
const PLAN_DISPLAY: Record<string, string> = {
  free: 'Gratuit',
  etudiant: 'Étudiant',
  student: 'Étudiant',   // alias rétrocompatibilité
  starter: 'Starter',
  pro: 'Pro',
  equipe: 'Équipe',
  team: 'Équipe',        // alias rétrocompatibilité
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

  // Detect current YouTube video
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      const videoId = extractVideoId(url);
      if (videoId) {
        setVideo({ url, videoId, title: tabs[0]?.title || 'YouTube Video' });
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

  // Quota calculations
  const isQuotaExceeded = planInfo
    ? planInfo.analyses_this_month >= planInfo.monthly_analyses
    : false;
  const quotaRemaining = planInfo
    ? planInfo.monthly_analyses - planInfo.analyses_this_month
    : null;
  const quotaWarning = planInfo && planInfo.monthly_analyses > 0
    ? (quotaRemaining !== null && quotaRemaining / planInfo.monthly_analyses < 0.2)
    : false;

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

    setAnalysis({ phase: 'analyzing', progress: 0, message: 'Starting analysis...' });

    try {
      const startRes = await chrome.runtime.sendMessage({
        action: 'START_ANALYSIS',
        data: { url: video.url, options: { mode, lang } },
      });

      if (!startRes.success) {
        setAnalysis({ phase: 'error', message: startRes.error || 'Failed to start analysis' });
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
            setAnalysis({ phase: 'error', message: status.error || 'Analysis failed' });
          } else {
            setAnalysis({
              phase: 'analyzing',
              progress: status.progress || 0,
              message: status.message || 'Processing...',
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
            <button className="icon-btn icon-btn-danger" onClick={onLogout} title="Sign out">
              <LogoutIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {/* User/Plan bar */}
      {!isGuest && user && (
        <div className="user-bar">
          <span className={`plan-badge plan-${user.plan}`}>{user.plan}</span>
          {planInfo ? (
            <span className={`user-quota ${quotaWarning ? 'quota-warning' : ''}`}>
              {planInfo.analyses_this_month}/{planInfo.monthly_analyses} analyses
            </span>
          ) : (
            <span className="user-credits">{user.credits} credits</span>
          )}
        </div>
      )}

      {/* Guest banner */}
      {isGuest && (
        <div className="guest-banner">
          <span>Mode d\u00e9couverte — 1 analyse gratuite sans compte</span>
        </div>
      )}

      {/* Content */}
      <div className="main-content">
        {/* Video status */}
        <div className="video-status">
          <div className="video-status-icon">
            <PlayIcon size={16} />
          </div>
          <span className={`video-status-text ${video ? 'video-status-detected' : 'video-status-none'}`}>
            {video
              ? video.title.length > 45 ? video.title.substring(0, 45) + '...' : video.title
              : 'Open a YouTube video to analyze'}
          </span>
        </div>

        {/* Analysis controls */}
        {video && analysis.phase === 'idle' && (
          <>
            {/* Quota exceeded — logged in user */}
            {!isGuest && isQuotaExceeded ? (
              <div className="quota-exceeded">
                <p className="quota-exceeded-text">
                  {'\uD83D\uDCCA'} Quota atteint ({planInfo?.analyses_this_month}/{planInfo?.monthly_analyses}) — Passez au plan sup\u00e9rieur
                </p>
                <button
                  className="analyze-btn analyze-btn-disabled"
                  disabled
                >
                  {'\u2728'} Analyser cette vid\u00e9o
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
                  Cr\u00e9ez un compte gratuit pour sauvegarder vos analyses et en faire plus
                </p>
                <button
                  className="btn-create-account"
                  onClick={() => chrome.tabs.create({ url: `${WEBAPP_URL}/register` })}
                >
                  Cr\u00e9er un compte {'\u2197'}
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
                    <label>Language</label>
                    <select className="ds-select" value={lang} onChange={(e) => setLang(e.target.value)}>
                      <option value="fr">Fran&ccedil;ais</option>
                      <option value="en">English</option>
                      <option value="es">Espa&ntilde;ol</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>
                </div>
                <button className="analyze-btn" onClick={startAnalysis}>
                  {'\u2728'} Analyser cette vid\u00e9o
                </button>
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
              Retry
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
            {/* Guest post-analysis CTA */}
            {isGuest && (
              <div className="guest-post-analysis">
                <p>Cr\u00e9ez un compte gratuit pour sauvegarder vos analyses et en faire plus</p>
                <button
                  className="btn-create-account"
                  onClick={() => chrome.tabs.create({ url: `${WEBAPP_URL}/register` })}
                >
                  Cr\u00e9er un compte {'\u2197'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Recent */}
        {!isGuest && analysis.phase === 'idle' && recentAnalyses.length > 0 && (
          <div className="recent-section">
            <h3>Recent analyses</h3>
            <div className="recent-list">
              {recentAnalyses.slice(0, 5).map((item) => (
                <a
                  key={item.videoId}
                  href={`${WEBAPP_URL}/summary/${item.summaryId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="recent-item"
                >
                  <img src={getThumbnailUrl(item.videoId)} alt="" loading="lazy" />
                  <span className="recent-title">{item.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
