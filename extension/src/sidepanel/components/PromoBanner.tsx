import React, { useState, useEffect } from "react";
import type { PlanInfo } from "../../types";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { DoodleIcon } from "../shared/doodles/DoodleIcon";
import { useTranslation } from "../../i18n/useTranslation";

interface Promo {
  id: string;
  textKey: number;
  url: string;
  gradient: string;
}

const GRADIENTS = {
  goldDark:
    "linear-gradient(135deg, rgba(200,144,58,0.15), rgba(155,107,74,0.15))",
  goldStrong:
    "linear-gradient(135deg, rgba(200,144,58,0.2), rgba(200,144,58,0.08))",
  violetGold:
    "linear-gradient(135deg, rgba(155,107,74,0.15), rgba(200,144,58,0.1))",
};

const PROMOS_FREE: Promo[] = [
  {
    id: "free-flashcards",
    textKey: 0,
    url: `${WEBAPP_URL}/upgrade`,
    gradient: GRADIENTS.goldStrong,
  },
  {
    id: "free-mindmap",
    textKey: 1,
    url: `${WEBAPP_URL}/upgrade`,
    gradient: GRADIENTS.violetGold,
  },
  {
    id: "free-quota",
    textKey: 2,
    url: `${WEBAPP_URL}/upgrade`,
    gradient: GRADIENTS.goldDark,
  },
];

const PROMOS_PRO: Promo[] = [
  {
    id: "pro-mobile",
    textKey: 0,
    url: `${WEBAPP_URL}/mobile`,
    gradient: GRADIENTS.goldDark,
  },
  {
    id: "pro-web",
    textKey: 1,
    url: WEBAPP_URL,
    gradient: GRADIENTS.goldStrong,
  },
];

type PromoTier = "free" | "pro";

function getPromoTier(planId?: string): PromoTier {
  switch (planId) {
    case "plus":
    case "pro":
    case "expert":
    case "etudiant":
    case "student":
    case "starter":
      return "pro";
    default:
      return "free";
  }
}

function getPromosForPlan(planId?: string): Promo[] {
  switch (getPromoTier(planId)) {
    case "pro":
      return PROMOS_PRO;
    default:
      return PROMOS_FREE;
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
    Browser.storage.local.get(["promoDismissedAt"]).then((data) => {
      if (data.promoDismissedAt) {
        const elapsed = Date.now() - (data.promoDismissedAt as number);
        if (elapsed > 24 * 60 * 60 * 1000) {
          Browser.storage.local.remove(["promoDismissedAt"]);
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
    Browser.storage.local.set({ promoDismissedAt: Date.now() });
  };

  if (dismissed || promos.length === 0) return null;

  const idx = current % promos.length;
  const promo = promos[idx];
  const textData = promoTexts[idx] || promoTexts[0];

  const doodleNames = ["sparkle4pt", "star", "crown"];

  return (
    <div
      className="promo-banner"
      style={{
        background: promo.gradient,
        borderTop: "1px solid var(--border-accent)",
      }}
    >
      <div className="promo-content">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DoodleIcon
            name={doodleNames[idx % doodleNames.length]}
            size={16}
            color="var(--accent-primary)"
          />
          <span className="promo-text" style={{ color: "var(--text-primary)" }}>
            {textData.text}
          </span>
        </div>
        <a
          href={promo.url}
          target="_blank"
          rel="noreferrer"
          className="promo-cta"
          style={{ color: "var(--accent-primary)" }}
          onClick={(e) => {
            e.preventDefault();
            Browser.tabs.create({ url: promo.url });
          }}
        >
          {textData.cta} &rarr;
        </a>
      </div>
      <button
        type="button"
        className="promo-close"
        onClick={handleDismiss}
        title={t.common.hide}
        aria-label={t.common.hide}
      >
        &times;
      </button>
    </div>
  );
};
