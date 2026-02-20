import React, { useState } from 'react';
import type { Summary } from '../../types';
import { CATEGORY_ICONS } from '../../types';
import { escapeHtml, markdownToFullHtml, parseAnalysisToSummary } from '../../utils/sanitize';
import type { KeyPoint } from '../../utils/sanitize';
import { ChatIcon, ExternalLinkIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';

interface SynthesisViewProps {
  summary: Summary;
  summaryId: number;
  onOpenChat: () => void;
}

function keyPointIcon(type: KeyPoint['type']): string {
  switch (type) {
    case 'solid': return '\u2705';
    case 'weak': return '\u26A0\uFE0F';
    case 'insight': return '\u{1F4A1}';
  }
}

function keyPointClass(type: KeyPoint['type']): string {
  switch (type) {
    case 'solid': return 'keypoint-solid';
    case 'weak': return 'keypoint-weak';
    case 'insight': return 'keypoint-insight';
  }
}

export const SynthesisView: React.FC<SynthesisViewProps> = ({ summary, summaryId, onOpenChat }) => {
  const [showDetail, setShowDetail] = useState(false);

  const parsed = parseAnalysisToSummary(summary.summary_content);
  const categoryIcon = CATEGORY_ICONS[summary.category] || '\u{1F4CB}';
  const score = summary.reliability_score;
  const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
  const scoreIcon = score >= 80 ? '\u2705' : score >= 60 ? '\u26A0\uFE0F' : '\u2753';

  const detailedHtml = markdownToFullHtml(escapeHtml(summary.summary_content));

  return (
    <div className="synthesis">
      {/* Status bar */}
      <div className="synthesis-header">
        <span className="synthesis-done">\u2705 Analysis Complete</span>
        <div className="synthesis-badges">
          <span className="synthesis-badge">{categoryIcon} {summary.category}</span>
          <span className={`synthesis-badge ${scoreClass}`}>{scoreIcon} {score}%</span>
        </div>
      </div>

      {/* Verdict */}
      <div className="synthesis-verdict">
        <p>{parsed.verdict}</p>
      </div>

      {/* Key Points */}
      {parsed.keyPoints.length > 0 && (
        <div className="synthesis-keypoints">
          {parsed.keyPoints.map((kp, i) => (
            <div key={i} className={`keypoint ${keyPointClass(kp.type)}`}>
              <span className="keypoint-icon">{keyPointIcon(kp.type)}</span>
              <span className="keypoint-text">{kp.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {parsed.tags.length > 0 && (
        <div className="synthesis-tags">
          {parsed.tags.map((tag, i) => (
            <span key={i} className="tag-pill">{tag}</span>
          ))}
        </div>
      )}

      {/* Concepts */}
      {summary.concepts && summary.concepts.length > 0 && (
        <div className="synthesis-concepts">
          {summary.concepts.slice(0, 3).map((concept, i) => (
            <div key={i} className="concept-item">
              <div className="concept-name">{concept.name}</div>
              <div className="concept-def">{concept.definition}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toggle detail */}
      <button className="toggle-detail" onClick={() => setShowDetail(!showDetail)}>
        <span>{showDetail ? 'Hide detailed analysis' : 'See detailed analysis'}</span>
        {showDetail ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
      </button>

      {/* Detail panel */}
      {showDetail && (
        <div
          className="detail-panel"
          dangerouslySetInnerHTML={{ __html: detailedHtml }}
        />
      )}

      {/* Actions */}
      <div className="synthesis-actions">
        <a
          href={`https://www.deepsightsynthesis.com/summary/${summaryId}`}
          target="_blank"
          rel="noreferrer"
          className="btn-action btn-action-primary"
        >
          <ExternalLinkIcon size={14} /> Full analysis
        </a>
        <button className="btn-action btn-action-secondary" onClick={onOpenChat}>
          <ChatIcon size={14} /> Chat
        </button>
      </div>
    </div>
  );
};
