/**
 * DEEP SIGHT v8.0 — Footer
 * Minimal footer with border-subtle styling
 */

import React from "react";
import { Link } from "react-router-dom";
import { Scale, Heart, Shield } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";
import { FooterTicker } from "./FooterTicker";

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border-subtle bg-bg-secondary/50 py-3.5 px-6 flex-shrink-0">
      {/* 💡 Knowledge Ticker — termes défilants */}
      <FooterTicker />

      {/* Sovereignty & Ethics badges */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-3 text-[10px] text-text-tertiary">
        <a
          href="https://mistral.ai"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 hover:text-text-secondary transition-colors"
          title="IA 100% Fran\u00e7aise — Donn\u00e9es h\u00e9berg\u00e9es en Union Europ\u00e9enne"
        >
          <Shield className="w-3 h-3 text-blue-400" />
          <span>IA Mistral</span>
          <span className="opacity-60">
            \uD83C\uDDEB\uD83C\uDDF7\uD83C\uDDEA\uD83C\uDDFA
          </span>
        </a>
        <span className="text-border-default">\u00B7</span>
        <a
          href="https://tournesol.app"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 hover:text-text-secondary transition-colors"
          title="Recommandations \u00e9thiques — Scores de qualit\u00e9 par la communaut\u00e9 Tournesol"
        >
          <span>\uD83C\uDF3B</span>
          <span>Qualit\u00e9 Tournesol</span>
        </a>
        <span className="text-border-default">\u00B7</span>
        <span
          className="flex items-center gap-1"
          title="Donn\u00e9es h\u00e9berg\u00e9es en Union Europ\u00e9enne — RGPD natif"
        >
          <Shield className="w-3 h-3 text-green-400" />
          <span>RGPD &amp; EU AI Act</span>
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-text-tertiary text-xs flex items-center gap-1">
          {t.footer.copyright}
          <span className="mx-1 text-border-default">\u00B7</span>
          <span className="flex items-center gap-1">
            {t.footer.madeWith}{" "}
            <Heart className="w-2.5 h-2.5 text-red-400 fill-red-400" />{" "}
            {t.footer.inFrance}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link
            to="/legal"
            className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <Scale className="w-3 h-3" />
            {t.footer.legal}
          </Link>
          <span className="text-border-default">\u00B7</span>
          <Link
            to="/legal/cgu"
            className="text-text-tertiary hover:text-text-secondary transition-colors"
          >
            CGU
          </Link>
          <span className="text-border-default">\u00B7</span>
          <Link
            to="/legal/cgv"
            className="text-text-tertiary hover:text-text-secondary transition-colors"
          >
            CGV
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
