import React from 'react';
import { WEBAPP_URL } from '../../utils/config';
import { getThumbnailUrl } from '../../utils/youtube';
import type { RecentAnalysis } from '../../types';

interface HistoryViewProps {
  items: RecentAnalysis[];
  onBack: () => void;
}

function isRecent(timestamp: number): boolean {
  const dayMs = 24 * 60 * 60 * 1000;
  return Date.now() - timestamp < dayMs;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ items, onBack }) => {
  return (
    <div className="view history-view">
      <header>
        <button onClick={onBack} className="back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>History</h2>
      </header>

      <div className="history-list">
        {items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <p>No analyses yet</p>
            <span className="empty-hint">Analyze a YouTube video to see it here</span>
          </div>
        ) : (
          items.map((item) => (
            <a
              key={item.summaryId}
              href={`${WEBAPP_URL}/summary/${item.summaryId}`}
              target="_blank"
              rel="noreferrer"
              className="history-item"
            >
              <img src={getThumbnailUrl(item.videoId)} alt="" />
              <div className="history-item-content">
                <strong>{item.title}</strong>
                <div className="history-meta">
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  {isRecent(item.timestamp) && (
                    <span className="history-badge-new">New</span>
                  )}
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
};
