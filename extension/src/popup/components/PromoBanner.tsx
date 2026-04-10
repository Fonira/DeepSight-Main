import React, { useState, useEffect } from 'react';
import type { PlanInfo } from '../../types';
import { WEBAPP_URL } from '../../utils/config';
import { useTranslation } from '../../i18n/useTranslation';

// ── Promo definitions per plan tier ──

interface Promo {
  id: string;
  textKey: number; // index into t.promos[tier]
  url: string;
  gradient: string;
}

const GRADIENTS = {
  blueViolet: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  violetCyan: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
  warmOrange: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  cyanBlue: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  violetOrange: 'linear-gradient(135deg, #8b5cf6, #f59e0b)',
  greenCyan: 'linear-gradient(135deg, #22c55e, #06b6d4)',
};

const PROMOS_FREE: Promo[] = [
  { id: 'free-flashcards', textKey: 0, url: `${WEBAPP_URL}/upgrade`, gradient: GRADIENTS.blueViolet },
  { id: 'free-mindmap', textKey: 1, url: `${WEBAPP_URL}/upgrade`, gradient: GRADIENTS.violetCyan },
  { id: 'free-quota', textKey: 2, url: `${WEBAPP_URL}/upgrade`, gradient: GRADIENTS.warmOrange },
];

const PROMOS_PRO: Promo[] = [
  { id: 'pro-mobile', textKey: 0, url: `${WEBAPP_URL}/mobile`, gradient: GRADIENTS.greenCyan },
  { id: 'pro-web', textKey: 1, url: WEBAPP_URL, gradient: GRADIENTS.blueViolet },
];

type PromoTier = 'free' | 'pro';

function getPromoTier(planId?: string): PromoTier {
  switch (planId) {
    case 'plus':
    case 'pro':
    case 'expert':
    case 'etudiant':
    case 'student':
    case 'starter':
      return 'pro';
    default:
      return 'free';
  }
}

function getPromosForPlan(planId?: string): Promo[] {
  switch (getPromoTier(planId)) {
    case 'pro': return PROMOS_PRO;
    default: return PROMOS_FREE;
  }
}

interface PromoBannerProps {
  planInfo: PlanInfo | null;
}

export const PromoBanner: React.FC<PromoBannerProps> = ({ planInfo }) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const tier = getPromoTier(planInfo?.plan_id);
  const promos = getPromosForPlan(planInfo?.plan_id);
  const promoTexts = t.promos[tier];

  useEffect(() => {
    chrome.storage.local.get(['promoDismissedAt']).then((data) => {
      if (data.promoDismissedAt) {
        const elapsed = Date.now() - data.promoDismissedAt;
        if (elapsed > 24 * 60 * 60 * 1000) {
          chrome.storage.local.remove(['promoDismissedAt']);
        } else {
          setDismissed(true);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (dismissed || promos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((i) => (i + 1) % promos.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [dismissed, promos.length]);

  useEffect(() => {
    setCurrent(0);
  }, [planInfo?.plan_id]);

  const handleDismiss = () => {
    setDismissed(true);
    chrome.storage.local.set({ promoDismissedAt: Date.now() });
  };

  if (dismissed || promos.length === 0) return null;

  const idx = current % promos.length;
  const promo = promos[idx];
  const textData = promoTexts[idx] || promoTexts[0];

  return (
    <div className="promo-banner" style={{ background: promo.gradient }}>
      <div className="promo-content">
        <span className="promo-text">{textData.text}</span>
        <a
          href={promo.url}
          target="_blank"
          rel="noreferrer"
          className="promo-cta"
          onClick={(e) => {
            e.preventDefault();
            chrome.tabs.create({ url: promo.url });
          }}
        >
          {textData.cta} &rarr;
        </a>
      </div>
      <button className="promo-close" onClick={handleDismiss} title={t.common.hide}>
        &times;
      </button>
    </div>
  );
};
