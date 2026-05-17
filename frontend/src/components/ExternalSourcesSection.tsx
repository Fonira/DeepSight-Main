/**
 * DEEP SIGHT — ExternalSourcesSection
 *
 * Pages externes citées dans la description vidéo (URLs scrapées + résumées
 * par Mistral). Spec : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §9.
 *
 * Gating :
 *  - free  → <ExternalSourcesUpgradeCTA />
 *  - pro   → vue complète (cap 5 pages)
 *  - expert → vue complète (cap 10 pages)
 *
 * Empty states : `data=null` (rien à afficher, silent), `data.pages.length===0`
 * (idem, silent — pipeline backend retourne null dans ce cas mais on défend).
 */

import React from "react";
import { motion } from "framer-motion";
import { Link2 } from "lucide-react";
import type { ExternalPagesData } from "../services/api";
import { canAccess } from "../config/planPrivileges";
import { ExternalSourcesUpgradeCTA } from "./ExternalSourcesUpgradeCTA";
import { ExternalSourceCard } from "./ExternalSourceCard";

interface Props {
  data: ExternalPagesData | null | undefined;
  userPlan: string | undefined | null;
  language: "fr" | "en";
  onUpgradeClick?: () => void;
}

export const ExternalSourcesSection: React.FC<Props> = ({
  data,
  userPlan,
  language,
  onUpgradeClick,
}) => {
  const plan = (userPlan || "free").toLowerCase();
  const isAllowed = canAccess(plan, "external_sources", "web");

  // Free plan → CTA upgrade (afficher même si pas de data, pour discoverability).
  if (!isAllowed) {
    return (
      <ExternalSourcesUpgradeCTA
        language={language}
        onUpgradeClick={onUpgradeClick}
      />
    );
  }

  // Pas encore généré ou aucune page exploitable → silent (pipeline asynchrone,
  // peut être null si description vide / aucune URL / toutes les pages ont échoué).
  if (!data || !data.pages || data.pages.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl bg-white/5 border border-indigo-500/20 backdrop-blur-xl p-5"
      data-testid="external-sources-section"
    >
      <header className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
          <Link2 className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary">
            {language === "fr"
              ? "Sources externes citées"
              : "External sources cited"}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {language === "fr"
              ? `${data.stats.successful}/${data.pages.length} pages traitées`
              : `${data.stats.successful}/${data.pages.length} pages processed`}
          </p>
        </div>
      </header>

      <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory -mx-1 px-1">
        {data.pages.map((page, i) => (
          <ExternalSourceCard
            key={`${page.final_url}-${i}`}
            page={page}
            index={i}
            language={language}
          />
        ))}
      </div>
    </motion.section>
  );
};

export default ExternalSourcesSection;
