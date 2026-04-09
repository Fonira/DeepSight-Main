import React, { useState } from 'react';
import type { Summary, PlanInfo } from '../../types';
import { CATEGORY_ICONS } from '../../types';
import { escapeHtml, markdownToFullHtml, parseAnalysisToSummary } from '../../utils/sanitize';
import type { KeyPoint } from '../../utils/sanitize';
import { WEBAPP_URL } from '../../utils/config';
import { ChatIcon, ExternalLinkIcon, ChevronDownIcon, ChevronUpIcon, ShareIcon } from './Icons';
import { useTranslation } from '../../i18n/useTranslation';

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
  labelKey: 'flashcards' | 'mindMaps' | 'webSearch' | 'exports' | 'playlists';
  hash: string;
  minPlan: string;
  price: string;
}

const FEATURE_CTAS: FeatureCTA[] = [
  { key: 'flashcards', icon: '\uD83D\uDDC2\uFE0F', labelKey: 'flashcards', hash: '#flashcards', minPlan: 'pro', price: '5,99€' },
  { key: 'mind_maps', icon: '\uD83E\uDDE0', labelKey: 'mindMaps', hash: '#mindmap', minPlan: 'pro', price: '5,99€' },
  { key: 'web_search', icon: '\uD83C\uDF10', labelKey: 'webSearch', hash: '#websearch', minPlan: 'pro', price: '5,99€' },
  { key: 'exports', icon: '\uD83D\uDCE4', labelKey: 'exports', hash: '#export', minPlan: 'pro', price: '5,99€' },
  { key: 'playlists', icon: '\uD83C\uDFAC', labelKey: 'playlists', hash: '#playlists', minPlan: 'pro', price: '5,99€' },
];

export const SynthesisView: React.FC<SynthesisViewProps> = ({ summary, summaryId, planInfo, onOpenChat }) => {
  const { t, language } = useTranslation();
  const [showDetail, setShowDetail] = useState(false);

  const parsed = parseAnalysisToSummary(summary.summary_content);
  const categoryIcon = CATEGORY_ICONS[summary.category] || '\u{1F4CB}';
  const score = summary.reliability_score;
  const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
  const scoreIcon = score >= 80 ? '\u2705' : score >= 60 ? '\u26A0\uFE0F' : '\u2753';

  const detailedHtml = markdownToFullHtml(escapeHtml(summary.summary_content));

  const handleShare = () => {
    const scoreLabel = score >= 80 ? t.synthesis.reliable : score >= 60 ? t.synthesis.toVerify : t.synthesis.unreliable;
    const html = generateShareHtml(summary, parsed, score, scoreLabel, t, language);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url });
  };

  // Build feature CTAs
  const availableCTAs: { cta: FeatureCTA; available: boolean }[] = FEATURE_CTAS.map((cta) => ({
    cta,
    available: planInfo?.features?.[cta.key] ?? false,
  }));

  return (
    <div className="synthesis">
      {/* Status bar */}
      <div className="synthesis-header">
        <span className="synthesis-done">{'\u2705'} {t.synthesis.complete}</span>
        <div className="synthesis-badges">
          <span className="synthesis-badge">{categoryIcon} {summary.category}</span>
          <span className={`synthesis-badge ${scoreClass}`}>{scoreIcon} {score}%</span>
        </div>
      </div>

      {/* Platform logos + Tournesol badge */}
      <div className="synthesis-platforms">
        <img src={chrome.runtime.getURL('platforms/youtube-icon-red.png')} alt="YouTube" style={{ height: 16 }} />
        <span className="synthesis-platform-sep" />
        <img src={chrome.runtime.getURL('platforms/tiktok-note-white.png')} alt="TikTok" style={{ height: 14 }} />
        <span className="synthesis-platform-sep" />
        <img src={chrome.runtime.getURL('platforms/mistral-logo-white.png')} alt="Mistral AI" style={{ height: 12, opacity: 0.7 }} />
        <span className="synthesis-platform-sep" />
        <img src={chrome.runtime.getURL('platforms/tournesol-logo.png')} alt="Tournesol" style={{ height: 13, opacity: 0.8 }} />
      </div>

      {/* Tournesol Score Badge */}
      {summary.tournesol?.found && summary.tournesol.tournesol_score !== null && (
        <a
          href={`https://tournesol.app/entities/yt:${summary.video_url?.match(/[?&]v=([^&]+)/)?.[1] || ''}`}
          target="_blank"
          rel="noreferrer"
          className="tournesol-badge"
          title={`Score Tournesol: ${summary.tournesol.tournesol_score} | ${summary.tournesol.n_contributors} contributeurs | ${summary.tournesol.n_comparisons} comparaisons`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            margin: '8px 0',
            borderRadius: '8px',
            background: summary.tournesol.tournesol_score >= 50 ? 'rgba(34,197,94,0.12)' :
                         summary.tournesol.tournesol_score >= 20 ? 'rgba(234,179,8,0.12)' :
                         'rgba(255,255,255,0.05)',
            border: `1px solid ${summary.tournesol.tournesol_score >= 50 ? 'rgba(34,197,94,0.25)' :
                                  summary.tournesol.tournesol_score >= 20 ? 'rgba(234,179,8,0.25)' :
                                  'rgba(255,255,255,0.1)'}`,
            fontSize: '12px',
            color: '#d4d4d8',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '14px' }}>{'\uD83C\uDF3B'}</span>
          <span style={{ fontWeight: 600 }}>Tournesol: {summary.tournesol.tournesol_score > 0 ? '+' : ''}{Math.round(summary.tournesol.tournesol_score)}</span>
          <span style={{ opacity: 0.6, fontSize: '11px' }}>({summary.tournesol.n_contributors} votes)</span>
        </a>
      )}

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
              <div className="concept-def">{concept.definition || t.synthesis.generatingDef}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toggle detail */}
      <button className="toggle-detail" onClick={() => setShowDetail(!showDetail)}>
        <span>{showDetail ? t.synthesis.hideDetail : t.synthesis.showDetail}</span>
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
          <ExternalLinkIcon size={14} /> {t.synthesis.fullAnalysis}
        </a>
        <button className="btn-action btn-action-secondary" onClick={onOpenChat}>
          <ChatIcon size={14} /> {t.synthesis.chat}
        </button>
        <button className="btn-action btn-action-secondary" onClick={handleShare} title={t.synthesis.share}>
          <ShareIcon size={14} /> {t.synthesis.share}
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
              <span className="feature-cta-label">{t.features[cta.labelKey]}</span>
              <span className="feature-cta-arrow">{'\u2197'}</span>
            </button>
          ) : (
            <button
              key={cta.key}
              className="feature-cta feature-cta-locked"
              onClick={() => chrome.tabs.create({ url: `${WEBAPP_URL}/upgrade` })}
            >
              <span className="feature-cta-icon">{'\uD83D\uDD12'}</span>
              <span className="feature-cta-label">{t.features[cta.labelKey]}</span>
              <span className="feature-cta-price">{t.features.fromPrice.replace('{price}', cta.price)}</span>
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
          {t.common.allPlans} {'\u2197'}
        </a>
      </div>
    </div>
  );
};

/**
 * Generates a beautiful standalone HTML page for sharing a synthesis.
 */
function generateShareHtml(
  summary: Summary,
  parsed: ReturnType<typeof parseAnalysisToSummary>,
  score: number,
  scoreLabel: string,
  t: ReturnType<typeof useTranslation>['t'],
  language: string,
): string {
  const scoreClass = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-US';
  const date = new Date(summary.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });

  const keyPointsHtml = parsed.keyPoints.map(kp => {
    const icon = kp.type === 'solid' ? '\u2705' : kp.type === 'weak' ? '\u26A0\uFE0F' : '\u{1F4A1}';
    return `<div style="display:flex;gap:10px;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px">
      <span style="font-size:16px;flex-shrink:0">${icon}</span>
      <span style="color:#d4d4d8;font-size:14px;line-height:1.6">${kp.text}</span>
    </div>`;
  }).join('');

  const tagsHtml = parsed.tags.map(tag =>
    `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:rgba(59,130,246,0.12);color:#60a5fa;font-size:12px;font-weight:500">${tag}</span>`
  ).join(' ');

  const conceptsHtml = (summary.concepts || []).slice(0, 5).map(c =>
    `<div style="padding:14px 18px;border-radius:12px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15)">
      <div style="font-weight:600;color:#c4b5fd;font-size:14px;margin-bottom:4px">${c.name}</div>
      <div style="color:#a1a1aa;font-size:13px;line-height:1.5">${c.definition || t.synthesis.generatingDef}</div>
    </div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${summary.video_title} — ${t.synthesis.shareTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,sans-serif;background:#0a0a0f;color:#e4e4e7;min-height:100vh}
    .page{max-width:720px;margin:0 auto;padding:40px 24px 60px}
    .header{text-align:center;margin-bottom:32px}
    .logo{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#8b5cf6;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:16px}
    .logo svg{width:18px;height:18px}
    .video-title{font-size:22px;font-weight:700;line-height:1.35;color:#fafafa;margin-bottom:8px}
    .video-meta{display:flex;align-items:center;justify-content:center;gap:16px;font-size:13px;color:#71717a;flex-wrap:wrap}
    .score-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-weight:600;font-size:13px;background:${scoreClass}15;color:${scoreClass}}
    .section{margin-top:28px}
    .section-title{font-size:15px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .verdict{padding:20px 24px;border-radius:14px;background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08));border:1px solid rgba(139,92,246,0.15);font-size:15px;line-height:1.7;color:#d4d4d8}
    .concepts-grid{display:grid;gap:10px}
    .tags{display:flex;flex-wrap:wrap;gap:8px}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;color:#52525b;font-size:12px}
    .footer a{color:#8b5cf6;text-decoration:none}
    .footer a:hover{text-decoration:underline}
    .btn-print{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all 0.2s}
    .btn-print:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(99,102,241,0.35)}
    .actions{text-align:center;margin-top:28px;display:flex;gap:12px;justify-content:center}
    @media print{
      body{background:white;color:#1a1a1a}
      .verdict{background:#f8fafc;border-color:#e2e8f0}
      .score-badge{background:#f0fdf4}
      .actions,.btn-print{display:none!important}
      .section-title{color:#64748b}
      .footer{color:#94a3b8}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        DeepSight Synthesis
      </div>
      <h1 class="video-title">${summary.video_title}</h1>
      <div class="video-meta">
        <span>\uD83D\uDCFA ${summary.video_channel}</span>
        <span>\uD83D\uDCC1 ${summary.category}</span>
        <span>${date}</span>
        <span class="score-badge">\uD83C\uDFAF ${score}% — ${scoreLabel}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">\uD83D\uDD0D ${t.synthesis.verdict}</div>
      <div class="verdict">${parsed.verdict}</div>
    </div>

    ${parsed.keyPoints.length > 0 ? `
    <div class="section">
      <div class="section-title">\uD83D\uDCCC ${t.synthesis.keyPoints}</div>
      ${keyPointsHtml}
    </div>` : ''}

    ${(summary.concepts || []).length > 0 ? `
    <div class="section">
      <div class="section-title">\uD83E\uDDE0 ${t.synthesis.concepts}</div>
      <div class="concepts-grid">${conceptsHtml}</div>
    </div>` : ''}

    ${parsed.tags.length > 0 ? `
    <div class="section">
      <div class="section-title">\uD83C\uDFF7\uFE0F ${t.synthesis.tags}</div>
      <div class="tags">${tagsHtml}</div>
    </div>` : ''}

    <div class="actions">
      <button class="btn-print" onclick="window.print()">\uD83D\uDDA8\uFE0F ${t.synthesis.printPdf}</button>
    </div>

    <div class="footer">
      <p>${t.synthesis.generatedBy} <a href="https://www.deepsightsynthesis.com" target="_blank">DeepSight</a> — ${t.synthesis.analysisDesc}</p>
      <p style="margin-top:4px">\uD83C\uDDEB\uD83C\uDDF7\uD83C\uDDEA\uD83C\uDDFA ${t.synthesis.euBadge}</p>
    </div>
  </div>
</body>
</html>`;
}
