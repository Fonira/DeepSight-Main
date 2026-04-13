/**
 * IntellectualProfileBanner — Bannière "Profil Intellectuel" en haut de la page History.
 * Gauche: mini bar chart des top catégories. Droite: mot rotatif.
 * Glassmorphism, barres animées au mount.
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ExternalLink, BarChart3 } from "lucide-react";
import { useLoadingWord } from "../contexts/LoadingWordContext";
import { useLanguage } from "../contexts/LanguageContext";

const CAT_ICONS: Record<string, string> = {
  cognitive_bias: "🧠",
  science: "🔬",
  philosophy: "🎭",
  culture: "🌍",
  misc: "✨",
  history: "📜",
  technology: "⚡",
  person: "👤",
  company: "🏢",
  concept: "💡",
  event: "📅",
  place: "📍",
  psychology: "🧩",
  economics: "💰",
  art: "🎨",
  nature: "🌿",
};

const CAT_LABELS: Record<string, { fr: string; en: string }> = {
  cognitive_bias: { fr: "Biais cognitifs", en: "Cognitive Biases" },
  science: { fr: "Science", en: "Science" },
  philosophy: { fr: "Philosophie", en: "Philosophy" },
  culture: { fr: "Culture", en: "Culture" },
  technology: { fr: "Technologie", en: "Technology" },
  concept: { fr: "Concepts", en: "Concepts" },
  person: { fr: "Personnalités", en: "People" },
  company: { fr: "Entreprises", en: "Companies" },
  psychology: { fr: "Psychologie", en: "Psychology" },
  economics: { fr: "Économie", en: "Economics" },
  history: { fr: "Histoire", en: "History" },
  art: { fr: "Art", en: "Art" },
  nature: { fr: "Nature", en: "Nature" },
  misc: { fr: "Divers", en: "Misc" },
};

interface IntellectualProfileBannerProps {
  onCategoryFilter?: (category: string) => void;
}

export const IntellectualProfileBanner: React.FC<
  IntellectualProfileBannerProps
> = ({ onCategoryFilter }) => {
  const { userCategories, currentWord, nextWord, historyCount } =
    useLoadingWord();
  const { language } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const topCategories = userCategories.slice(0, 4);
  const maxCount = topCategories[0]?.count || 1;

  if (topCategories.length === 0 && !currentWord) return null;

  return (
    <div className="mb-6 rounded-2xl border border-accent-primary/10 bg-bg-secondary/80 backdrop-blur-xl overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Left — Category chart */}
        {topCategories.length > 0 && (
          <div className="flex-1 p-4 sm:p-5 sm:border-r border-b sm:border-b-0 border-border-subtle/30">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-3.5 h-3.5 text-accent-primary/60" />
              <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                {language === "fr" ? "Votre profil" : "Your profile"}
              </span>
              <span className="text-[10px] text-text-muted/50 ml-auto">
                {historyCount} {language === "fr" ? "termes" : "terms"}
              </span>
            </div>

            <div className="space-y-2">
              {topCategories.map((cat, i) => {
                const icon = CAT_ICONS[cat.category] || "📚";
                const label =
                  CAT_LABELS[cat.category]?.[language] || cat.category;
                const widthPercent = (cat.count / maxCount) * 100;

                return (
                  <button
                    key={cat.category}
                    onClick={() => onCategoryFilter?.(cat.category)}
                    className="w-full flex items-center gap-2 group hover:bg-white/[0.03] rounded-lg px-1 py-0.5 transition-colors"
                  >
                    <span className="text-xs flex-shrink-0">{icon}</span>
                    <span className="text-[11px] text-text-tertiary group-hover:text-text-secondary transition-colors w-20 text-left truncate">
                      {label}
                    </span>
                    <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-accent-primary/60 to-accent-primary/30 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: mounted ? `${widthPercent}%` : 0 }}
                        transition={{
                          duration: 0.6,
                          delay: i * 0.1,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted tabular-nums w-6 text-right">
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Right — Current word */}
        {currentWord && (
          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                💡 {language === "fr" ? "Le saviez-vous ?" : "Did you know?"}
              </span>
              <button
                onClick={nextWord}
                className="p-1 rounded-md text-text-muted hover:text-accent-primary hover:bg-white/5 transition-all"
                title={language === "fr" ? "Suivant" : "Next"}
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentWord.term}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2 }}
              >
                <p className="font-display text-sm font-semibold text-text-primary mb-1">
                  {CAT_ICONS[currentWord.category] || "📚"} {currentWord.term}
                </p>
                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-3">
                  {currentWord.shortDefinition}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {currentWord.wikiUrl && (
                    <a
                      href={currentWord.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-info transition-colors"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      Source
                    </a>
                  )}
                  {currentWord.source === "history" && (
                    <span className="text-[9px] text-accent-primary/40">
                      📜 {language === "fr" ? "Vos analyses" : "Your analyses"}
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntellectualProfileBanner;
