/**
 * DEEP SIGHT — ExternalSourceCard
 *
 * Card individuelle dans <ExternalSourcesSection>. Affiche favicon + host +
 * titre + résumé Mistral + 2 key_claims max + lien "Ouvrir".
 *
 * Status gating :
 *  - ok                                    → résumé + claims complet
 *  - paywall                               → notice "Article payant"
 *  - http_error / non_html                 → notice "Page introuvable"
 *  - error / timeout / empty               → notice "Contenu non extractible"
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, AlertCircle, Lock, FileX } from "lucide-react";
import type { ExternalPageCitation } from "../services/api";

interface Props {
  page: ExternalPageCitation;
  index: number;
  language: "fr" | "en";
}

const SAFE_HOST = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl.slice(0, 60);
  }
};

export const ExternalSourceCard: React.FC<Props> = ({
  page,
  index,
  language,
}) => {
  const host = SAFE_HOST(page.final_url);
  const [faviconError, setFaviconError] = useState(false);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;

  const renderBody = () => {
    if (page.status === "paywall") {
      return (
        <div className="flex items-center gap-2 text-amber-400 text-xs">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>
            {language === "fr"
              ? "Article payant non accessible"
              : "Paywalled article"}
          </span>
        </div>
      );
    }
    if (page.status === "http_error" || page.status === "non_html") {
      return (
        <div className="flex items-center gap-2 text-rose-400 text-xs">
          <FileX className="w-3.5 h-3.5 shrink-0" />
          <span>
            {language === "fr" ? "Page introuvable" : "Page not found"}
          </span>
        </div>
      );
    }
    if (
      page.status === "error" ||
      page.status === "timeout" ||
      page.status === "empty"
    ) {
      return (
        <div className="flex items-center gap-2 text-text-muted text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {language === "fr"
              ? "Contenu non extractible"
              : "Content unavailable"}
          </span>
        </div>
      );
    }
    return (
      <>
        <p className="text-sm text-text-secondary line-clamp-3 leading-relaxed">
          {page.summary}
        </p>
        {page.key_claims.length > 0 && (
          <ul className="mt-2 text-xs text-text-muted list-disc list-inside space-y-1">
            {page.key_claims.slice(0, 2).map((claim, i) => (
              <li key={i} className="line-clamp-1">
                {claim}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="snap-start flex-shrink-0 w-72 bg-white/5 border border-white/10 rounded-xl p-4 hover:border-indigo-400/30 transition-colors backdrop-blur-xl flex flex-col"
      data-testid="external-source-card"
      data-index={index}
    >
      <header className="flex items-center gap-2 mb-2 min-w-0">
        {!faviconError ? (
          <img
            src={faviconUrl}
            width={16}
            height={16}
            alt=""
            className="rounded-sm shrink-0"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <div className="w-4 h-4 rounded-sm bg-indigo-500/20 shrink-0" />
        )}
        <span className="text-xs text-text-muted truncate">{host}</span>
      </header>

      <h4
        className="text-sm font-semibold text-text-primary line-clamp-2 mb-2"
        title={page.title || page.final_url}
      >
        {page.title || page.final_url}
      </h4>

      <div className="flex-1">{renderBody()}</div>

      <a
        href={page.final_url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        aria-label={`${language === "fr" ? "Ouvrir" : "Open"} ${page.title || host}`}
      >
        {language === "fr" ? "Ouvrir" : "Open"}
        <ExternalLink className="w-3 h-3" />
      </a>
    </motion.article>
  );
};

export default ExternalSourceCard;
