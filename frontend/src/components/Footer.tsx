/**
 * DEEP SIGHT v5.1 — Footer
 * ✅ Utilise le système i18n centralisé
 */

import React from "react";
import { Link } from "react-router-dom";
import { Scale, Heart } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <footer className="border-t border-border-default bg-bg-secondary py-4 px-6 flex-shrink-0">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-text-secondary text-sm flex items-center gap-1">
          {t.footer.copyright}
          <span className="mx-1">•</span>
          <span className="flex items-center gap-1">
            {t.footer.madeWith} <Heart className="w-3 h-3 text-red-400 fill-red-400" /> {t.footer.inFrance}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/legal"
            className="flex items-center gap-2 text-accent-primary hover:text-accent-primary-hover transition-colors text-sm font-medium"
          >
            <Scale className="w-4 h-4" />
            {t.footer.legal}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
