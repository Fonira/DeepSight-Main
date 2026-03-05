import React, { useState, useEffect } from 'react';
import type { PlanInfo } from '../../types';
import { WEBAPP_URL } from '../../utils/config';

// ── Promo definitions per plan tier ──

interface Promo {
  id: string;
  text: string;
  cta: string;
  url: string;
  gradient: string;
}

// Promos targeted at FREE users → push toward Starter (2.99€)
const PROMOS_FREE: Promo[] = [
  {
    id: 'free-flashcards',
    text: 'Révisez avec des Flashcards IA — dès 2,99€/mois',
    cta: 'Débloquer Starter',
    url: `${WEBAPP_URL}/upgrade`,
    gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  },
  {
    id: 'free-mindmap',
    text: 'Cartes mentales IA pour chaque vidéo — dès 2,99€/mois',
    cta: 'Voir les plans',
    url: `${WEBAPP_URL}/upgrade`,
    gradient: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
  },
  {
    id: 'free-quota',
    text: 'Seulement 5 analyses/mois ? Passez à 20 avec Starter',
    cta: 'Upgrade →',
    url: `${WEBAPP_URL}/upgrade`,
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  },
];

// Promos for STARTER (etudiant) users → push toward Standard (5.99€)
const PROMOS_STARTER: Promo[] = [
  {
    id: 'starter-websearch',
    text: 'Recherche web IA pour croiser les sources — plan Standard',
    cta: 'Débloquer',
    url: `${WEBAPP_URL}/upgrade`,
    gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  },
  {
    id: 'starter-more',
    text: '50 analyses/mois + vidéos 2h — Passez à Standard',
    cta: 'Voir les plans',
    url: `${WEBAPP_URL}/upgrade`,
    gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  },
];

// Promos for STANDARD (starter) users → push toward Pro (12.99€)
const PROMOS_STANDARD: Promo[] = [
  {
    id: 'etudiant-playlists',
    text: 'Analysez des playlists entières — Passez à Pro',
    cta: 'Débloquer Pro',
    url: `${WEBAPP_URL}/upgrade`,
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  },
  {
    id: 'etudiant-exports',
    text: 'Exportez en PDF/DOCX — Pro à 12,99€/mois',
    cta: 'Voir les plans',
    url: `${WEBAPP_URL}/upgrade`,
    gradient: 'linear-gradient(135deg, #8b5cf6, #f59e0b)',
  },
];

// Promos for PRO users → cross-platform engagement (no upgrade needed)
const PROMOS_PRO: Promo[] = [
  {
    id: 'pro-mobile',
    text: 'DeepSight sur mobile — révisez vos flashcards partout',
    cta: 'Télécharger',
    url: `${WEBAPP_URL}/mobile`,
    gradient: 'linear-gradient(135deg, #22c55e, #06b6d4)',
  },
  {
    id: 'pro-web',
    text: 'Gérez vos playlists et exports sur deepsightsynthesis.com',
    cta: 'Ouvrir',
    url: WEBAPP_URL,
    gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  },
];

function getPromosForPlan(planId?: string): Promo[] {
  switch (planId) {
    case 'etudiant':
    case 'student':
      return PROMOS_STARTER;
    case 'starter':
      return PROMOS_STANDARD;
    case 'pro':
      return PROMOS_PRO;
    default:
      return PROMOS_FREE;
  }
}

interface PromoBannerProps {
  planInfo: PlanInfo | null;
}

export const PromoBanner: React.FC<PromoBannerProps> = ({ planInfo }) => {
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const promos = getPromosForPlan(planInfo?.plan_id);

  useEffect(() => {
    chrome.storage.local.get(['promoDismissedAt']).then((data) => {
      // Auto-reset dismissal after 24h to re-engage
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

  // Reset index if plan changes and promos array is shorter
  useEffect(() => {
    setCurrent(0);
  }, [planInfo?.plan_id]);

  const handleDismiss = () => {
    setDismissed(true);
    chrome.storage.local.set({ promoDismissedAt: Date.now() });
  };

  if (dismissed || promos.length === 0) return null;

  const promo = promos[current % promos.length];

  return (
    <div className="promo-banner" style={{ background: promo.gradient }}>
      <div className="promo-content">
        <span className="promo-text">{promo.text}</span>
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
          {promo.cta} &rarr;
        </a>
      </div>
      <button className="promo-close" onClick={handleDismiss} title="Masquer">
        &times;
      </button>
    </div>
  );
};
