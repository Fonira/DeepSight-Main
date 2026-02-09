import React from 'react';
import { WEBAPP_URL } from '../../utils/config';
import { getThumbnailUrl } from '../../utils/youtube';
import type { RecentAnalysis } from '../../types';

interface HistoryViewProps {
  items: RecentAnalysis[];
  onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ items, onBack }) => {
  return (
    <div className="view history-view">
      <header>
        <button onClick={onBack} className="back-btn">
          &larr; Back
        </button>
        <h2>History</h2>
      </header>

      <div className="history-list">
        {items.length === 0 ? (
          <div className="empty-state">
            <span>{'\u{1F4ED}'}</span>
            <p>No analyses yet</p>
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
                <span>{new Date(item.timestamp).toLocaleDateString()}</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
};
