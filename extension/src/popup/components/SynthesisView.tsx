import React, { useState } from 'react';
import type { Summary, PlanInfo } from '../../types';
import { CATEGORY_ICONS } from '../../types';
import { escapeHtml, markdownToFullHtml, parseAnalysisToSummary } from '../../utils/sanitize';
import type { KeyPoint } from '../../utils/sanitize';
import { WEBAPP_URL } from '../../utils/config';
import { ChatIcon, ExternalLinkIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';

interface SynthesisViewProps {
  summary: Summary;
  summaryId: number;
  planInfo: PlanInfo | null;
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

// Feature CTA config: features not available in extension but potentially in plan
interface FeatureCTA {
  key: keyof NonNullable<PlanInfo['features']>;
  icon: string;
  label: string;
  hash: string; // URL hash for web app
  minPlan: string; // minimum plan required, for locked display
  price: string; // display price for locked CTA
}

// ⚠️ SYNC avec billing/plan_config.py et frontend/src/config/planPrivileges.ts
const FEATURE_CTAS: FeatureCTA[] = [
  { key: 'flashcards', icon: '🗂️', label: 'Flashcards', hash: '#flashcards', minPlan: 'etudiant', price: '2,99€/mois' },
  { key: 'mind_maps', icon: '🧠', label: 'Cartes mentales', hash: '#mindmap', minPlan: 'etudiant', price: '2,99€/mois' },
  { key: 'web_search', icon: '🌐', label: 'Recherche web', hash: '#websearch', minPlan: 'starter', price: '5,99€/mois' },
  { key: 'exports', icon: '📤', label: 'Exports', hash: '#export', minPlan: 'pro', price: '12,99€/mois' },
  { key: 'playlists', icon: '🎬', label: 'Playlists', hash: '#playlists', minPlan: 'pro', price: '12,99€/mois' },
];

export const SynthesisView: React.FC<SynthesisViewProps> = ({ summary, summaryId, planInfo, onOpenChat }) => {
  const [showDetail, setShowDetail] = useState(false);

  const parsed = parseAnalysisToSummary(summary.summary_content);
  const categoryIcon = CATEGORY_ICONS[summary.category] || '\u{1F4CB}';
  const score = summary.reliability_score;
  const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
  const scoreIcon = score >= 80 ? '\u2705' : score >= 60 ? '\u26A0\uFE0F' : '\u2753';

  const detailedHtml = markdownToFullHtml(escapeHtml(summary.summary_content));

  // Build feature CTAs
  const availableCTAs: { cta: FeatureCTA; available: boolean }[] = FEATURE_CTAS.map((cta) => ({
    cta,
    available: planInfo?.features?.[cta.key] ?? false,
  }));

  return (
    <div className="synthesis">
      {/* Status bar */}
      <div className="synthesis-header">
        <span className="synthesis-done">{'\u2705'} Analyse compl\u00e8te</span>
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
        <span>{showDetail ? 'Masquer l\u0027analyse d\u00e9taill\u00e9e' : 'Voir l\u0027analyse d\u00e9taill\u00e9e'}</span>
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
          href={`${WEBAPP_URL}/summary/${summaryId}`}
          target="_blank"
          rel="noreferrer"
          className="btn-action btn-action-primary"
        >
          <ExternalLinkIcon size={14} /> Analyse compl\u00e8te
        </a>
        <button className="btn-action btn-action-secondary" onClick={onOpenChat}>
          <ChatIcon size={14} /> Chat
        </button>
      </div>

      {/* Feature CTAs */}
      <div className="feature-ctas">
        {availableCTAs.map(({ cta, available }) => (
          available ? (
            <button
              key={cta.key}
              className="feature-cta feature-cta-available"
              onClick={() => chrome.tabs.create({ url: `${WEBAPP_URL}/summary/${summaryId}${cta.hash}` })}
            >
              <span className="feature-cta-icon">{cta.icon}</span>
              <span className="feature-cta-label">{cta.label}</span>
              <span className="feature-cta-arrow">{'\u2197'}</span>
            </button>
          ) : (
            <button
              key={cta.key}
              className="feature-cta feature-cta-locked"
              onClick={() => chrome.tabs.create({ url: `${WEBAPP_URL}/upgrade` })}
            >
              <span className="feature-cta-icon">{'\uD83D\uDD12'}</span>
              <span className="feature-cta-label">{cta.label}</span>
              <span className="feature-cta-price">d\u00e8s {cta.price}</span>
            </button>
          )
        ))}
        <a
          href={`${WEBAPP_URL}/upgrade`}
          target="_blank"
          rel="noreferrer"
          className="feature-cta-all-plans"
          onClick={(e) => {
            e.preventDefault();
            chrome.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
          }}
        >
          Tous les plans {'\u2197'}
        </a>
      </div>
    </div>
  );
};
