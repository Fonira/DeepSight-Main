import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { User, Summary, RecentAnalysis } from '../../types';
import { extractVideoId, getThumbnailUrl } from '../../utils/youtube';
import { addRecentAnalysis, getRecentAnalyses } from '../../utils/storage';
import { LogoutIcon, PlayIcon } from './Icons';
import { SynthesisView } from './SynthesisView';
import { ChatDrawer } from './ChatDrawer';
import { PromoBanner } from './PromoBanner';

interface MainViewProps {
  user: User;
  onLogout: () => void;
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

export const MainView: React.FC<MainViewProps> = ({ user, onLogout, onError }) => {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [mode, setMode] = useState<string>(user.default_mode || 'standard');
  const [lang, setLang] = useState<string>(user.default_lang || 'fr');
  const [analysis, setAnalysis] = useState<AnalysisPhase>({ phase: 'idle' });
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect current YouTube video
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      const videoId = extractVideoId(url);
      if (videoId) {
        setVideo({ url, videoId, title: tabs[0]?.title || 'YouTube Video' });
      }
    });
    loadRecentAnalyses();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function loadRecentAnalyses(): Promise<void> {
    const items = await getRecentAnalyses();
    setRecentAnalyses(items);
  }

  const startAnalysis = useCallback(async () => {
    if (!video) return;

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
  }, [video, mode, lang]);

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
          <h1>DeepSight</h1>
        </div>
        <div className="main-header-actions">
          <button className="icon-btn icon-btn-danger" onClick={onLogout} title="Sign out">
            <LogoutIcon size={16} />
          </button>
        </div>
      </div>

      {/* User bar */}
      <div className="user-bar">
        <span className={`plan-badge plan-${user.plan}`}>{user.plan}</span>
        <span className="user-credits">{user.credits} credits</span>
      </div>

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
              {'\u2728'} Analyze this video
            </button>
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
          <SynthesisView
            summary={analysis.summary}
            summaryId={analysis.summaryId}
            onOpenChat={() => setChatOpen(true)}
          />
        )}

        {/* Recent */}
        {analysis.phase === 'idle' && recentAnalyses.length > 0 && (
          <div className="recent-section">
            <h3>Recent analyses</h3>
            <div className="recent-list">
              {recentAnalyses.slice(0, 5).map((item) => (
                <a
                  key={item.videoId}
                  href={`https://www.deepsightsynthesis.com/summary/${item.summaryId}`}
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

        {/* Promo */}
        {analysis.phase === 'idle' && <PromoBanner />}
      </div>
    </div>
  );
};
