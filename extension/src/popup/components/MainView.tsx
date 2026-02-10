import React, { useState } from 'react';
import { WEBAPP_URL } from '../../utils/config';
import { getThumbnailUrl } from '../../utils/youtube';
import type { User, RecentAnalysis } from '../../types';
import { DeepSightLogo } from './DeepSightLogo';
import { DeepSightSpinner } from './DeepSightSpinner';

interface MainViewProps {
  user: User;
  recentAnalyses: RecentAnalysis[];
  onLogout: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
  onError: (msg: string) => void;
}

const TABS = ['All', 'Source', 'Podcast', 'News', 'Science'] as const;

const PLAN_CLASSES: Record<string, string> = {
  free: 'plan-free',
  student: 'plan-student',
  starter: 'plan-starter',
  pro: 'plan-pro',
  team: 'plan-team',
};

export const MainView: React.FC<MainViewProps> = ({
  user,
  recentAnalyses,
  onLogout,
  onShowHistory,
  onShowSettings,
  onError,
}) => {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [tier, setTier] = useState<string>('standard');
  const [lang, setLang] = useState<string>('fr');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function handleAnalyze(): Promise<void> {
    setIsAnalyzing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url?.includes('youtube.com/watch')) {
        onError('Please navigate to a YouTube video first');
        setIsAnalyzing(false);
        return;
      }
      await chrome.runtime.sendMessage({
        action: 'ANALYZE_VIDEO',
        data: { url: tab.url, mode: tier, lang },
      });
      window.close();
    } catch (err) {
      onError((err as Error).message || 'Analysis failed');
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="view main-view">
      {/* Header */}
      <div className="main-header">
        <div className="main-header-left">
          <DeepSightLogo size="sm" />
          <h1>DeepSight</h1>
          <span className="ds-badge">AI Analysis</span>
        </div>
        <button
          className="back-btn"
          onClick={onShowSettings}
          title="Settings"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#8888a0', fontSize: 16 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* User Bar */}
      <div className="user-bar">
        <span className={`plan-badge ${PLAN_CLASSES[user.plan] || 'plan-free'}`}>
          {user.plan}
        </span>
        <span className="user-credits">
          {user.credits} credits
        </span>
        <button className="user-signout" onClick={onLogout}>
          Sign out
        </button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Analyze Button */}
        <button
          className={`analyze-btn${isAnalyzing ? ' loading' : ''}`}
          onClick={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <DeepSightSpinner size="sm" />
              Analyzing...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Analyze Current Video
            </>
          )}
        </button>

        {/* Tier & Language Selectors */}
        <div className="selectors-row">
          <div className="ds-select-wrapper">
            <label>Tier</label>
            <select className="ds-select" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="accessible">Standard</option>
              <option value="standard">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div className="ds-select-wrapper">
            <label>Language</label>
            <select className="ds-select" value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="fr">Fran\u00e7ais</option>
              <option value="en">English</option>
              <option value="es">Espa\u00f1ol</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="tabs-container">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`tab-btn${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Recent Analyses */}
        {recentAnalyses.length > 0 && (
          <div className="recent-section">
            <h3>Recent Analyses</h3>
            <div className="recent-list">
              {recentAnalyses.slice(0, 3).map((item) => (
                <a
                  key={item.summaryId}
                  href={`${WEBAPP_URL}/summary/${item.summaryId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="recent-item"
                >
                  <img
                    src={getThumbnailUrl(item.videoId)}
                    alt=""
                  />
                  <span className="recent-title">{item.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="quick-actions">
          <a
            href={`${WEBAPP_URL}/analyze`}
            target="_blank"
            rel="noreferrer"
            className="action-card"
          >
            <span className="action-icon action-icon-analyze">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2" strokeLinecap="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
            <span>Web App</span>
          </a>
          <button onClick={onShowHistory} className="action-card">
            <span className="action-icon action-icon-history">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span>History</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="popup-footer">
        <a href={WEBAPP_URL} target="_blank" rel="noreferrer">
          Open DeepSight
        </a>
      </div>
    </div>
  );
};
