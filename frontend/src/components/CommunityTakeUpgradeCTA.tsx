/**
 * DEEP SIGHT — CommunityTakeUpgradeCTA
 *
 * CTA discret pour les users free : "Verdict communauté disponible avec Pro".
 * Click → navigate vers /pricing (ou handler custom).
 */

import React from "react";
import { Users, ArrowRight, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  language: "fr" | "en";
  onUpgradeClick?: () => void;
}

export const CommunityTakeUpgradeCTA: React.FC<Props> = ({
  language,
  onUpgradeClick,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      navigate("/pricing");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left rounded-xl bg-gradient-to-br from-violet-500/8 to-indigo-500/8 border border-violet-500/20 hover:border-violet-400/40 backdrop-blur-xl p-4 transition-colors group"
      data-testid="community-take-upgrade-cta"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            {language === "fr" ? "Verdict communauté" : "Community verdict"}
            <Lock className="w-3 h-3 text-text-muted" />
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {language === "fr"
              ? "Analyse des commentaires + synthèse — disponible avec Pro"
              : "Comments analysis + synthesis — available with Pro"}
          </p>
        </div>
        <span className="text-xs font-medium text-violet-400 flex items-center gap-1 shrink-0 group-hover:text-violet-300">
          {language === "fr" ? "Passer Pro" : "Upgrade"}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  );
};

export default CommunityTakeUpgradeCTA;
