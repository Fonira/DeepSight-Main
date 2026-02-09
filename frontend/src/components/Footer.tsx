/**
 * DEEP SIGHT v8.0 — Footer
 * Minimal footer with border-subtle styling
 */

import React from "react";
import { Link } from "react-router-dom";
import { Scale, Heart } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border-subtle bg-bg-secondary/50 py-3.5 px-6 flex-shrink-0">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-text-tertiary text-xs flex items-center gap-1">
          {t.footer.copyright}
          <span className="mx-1 text-border-default">·</span>
          <span className="flex items-center gap-1">
            {t.footer.madeWith} <Heart className="w-2.5 h-2.5 text-red-400 fill-red-400" /> {t.footer.inFrance}
          </span>
        </div>
        <Link
          to="/legal"
          className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary transition-colors text-xs"
        >
          <Scale className="w-3 h-3" />
          {t.footer.legal}
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
