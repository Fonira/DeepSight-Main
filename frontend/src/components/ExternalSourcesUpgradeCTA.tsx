/**
 * DEEP SIGHT — ExternalSourcesUpgradeCTA
 *
 * CTA discret pour les users free : "Sources externes citées — disponible avec Pro".
 * Click → navigate vers /pricing (ou handler custom).
 */

import React from "react";
import { Link2, ArrowRight, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  language: "fr" | "en";
  onUpgradeClick?: () => void;
}

export const ExternalSourcesUpgradeCTA: React.FC<Props> = ({
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
      className="w-full text-left rounded-xl bg-gradient-to-br from-indigo-500/8 to-cyan-500/8 border border-indigo-500/20 hover:border-indigo-400/40 backdrop-blur-xl p-4 transition-colors group"
      data-testid="external-sources-upgrade-cta"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
          <Link2 className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            {language === "fr"
              ? "Sources externes citées"
              : "External sources cited"}
            <Lock className="w-3 h-3 text-text-muted" />
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {language === "fr"
              ? "Mini-résumé de chaque lien cité dans la description — disponible avec Pro"
              : "Mini-summary of each link cited in the description — available with Pro"}
          </p>
        </div>
        <span className="text-xs font-medium text-indigo-400 flex items-center gap-1 shrink-0 group-hover:text-indigo-300">
          {language === "fr" ? "Passer Pro" : "Upgrade"}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  );
};

export default ExternalSourcesUpgradeCTA;
