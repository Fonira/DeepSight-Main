import React from 'react';
import { WEBAPP_URL } from '../../utils/config';
import { getThumbnailUrl } from '../../utils/youtube';
import type { User, RecentAnalysis } from '../../types';

interface MainViewProps {
  user: User;
  recentAnalyses: RecentAnalysis[];
  onLogout: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
}

export const MainView: React.FC<MainViewProps> = ({
  user,
  recentAnalyses,
  onLogout,
  onShowHistory,
  onShowSettings,
}) => {
  const creditsPercentage =
    user.credits_monthly > 0
      ? Math.round((user.credits / user.credits_monthly) * 100)
      : 0;

  return (
    <div className="view main-view">
      <header>
        <div className="user-info">
          <div className="avatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} />
            ) : (
              <span>{user.username.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="user-details">
            <strong>{user.username}</strong>
            <span className="plan-badge">{user.plan}</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onShowSettings} title="Settings">
          \u2699\uFE0F
        </button>
      </header>

      <div className="credits-card">
        <div className="credits-header">
          <span>Credits</span>
          <span className="credits-count">
            {user.credits} / {user.credits_monthly}
          </span>
        </div>
        <div className="credits-bar">
          <div className="credits-fill" style={{ width: `${creditsPercentage}%` }} />
        </div>
      </div>

      <div className="quick-actions">
        <a
          href={`${WEBAPP_URL}/analyze`}
          target="_blank"
          rel="noreferrer"
          className="action-card"
        >
          <span className="action-icon">{'\u{1F3AC}'}</span>
          <span>Analyze Video</span>
        </a>
        <button onClick={onShowHistory} className="action-card">
          <span className="action-icon">{'\u{1F4DA}'}</span>
          <span>History</span>
        </button>
      </div>

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

      <div className="popup-footer">
        <a href={WEBAPP_URL} target="_blank" rel="noreferrer">
          Open DeepSight
        </a>
        <button onClick={onLogout} className="logout-btn">
          Sign out
        </button>
      </div>
    </div>
  );
};
