/**
 * ChatWelcomeInsight — "Ghost bubble" dans le empty state du ChatPage.
 * Montre un concept de l'historique comme conversation starter.
 * Filtre source: 'history' uniquement.
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lightbulb, ArrowRight } from "lucide-react";
import { useLoadingWord } from "../contexts/LoadingWordContext";
import { useLanguage } from "../contexts/LanguageContext";
import type { LoadingWord } from "../contexts/LoadingWordContext";

const ROTATION_INTERVAL = 45_000;

interface ChatWelcomeInsightProps {
  onPrefillChat?: (text: string) => void;
}

export const ChatWelcomeInsight: React.FC<ChatWelcomeInsightProps> = ({
  onPrefillChat,
}) => {
  const { getWordByFilter, hasHistory } = useLoadingWord();
  const { language } = useLanguage();
  const [word, setWord] = useState<LoadingWord | null>(null);
  const [visible, setVisible] = useState(false);

  // Fetch a history-only word
  useEffect(() => {
    if (!hasHistory) return;
    const w = getWordByFilter({ source: "history" });
    if (w) setWord(w);
  }, [getWordByFilter, hasHistory]);

  // Delayed entrance
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-rotation
  useEffect(() => {
    if (!hasHistory) return;
    const timer = setInterval(() => {
      const w = getWordByFilter({ source: "history" });
      if (w) setWord(w);
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [getWordByFilter, hasHistory]);

  if (!word || !visible || !hasHistory) return null;

  const handleDiscuss = () => {
    const question =
      language === "fr"
        ? `Explique-moi le concept de "${word.term}" et son importance.`
        : `Explain the concept of "${word.term}" and its importance.`;
    onPrefillChat?.(question);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mt-6 max-w-sm mx-auto"
    >
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm opacity-60 hover:opacity-90 transition-opacity duration-300">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-accent-primary/60" />
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
            {language === "fr" ? "Le saviez-vous ?" : "Did you know?"}
          </span>
        </div>

        {/* Video source */}
        {word.videoTitle && (
          <p className="text-[10px] text-text-muted/60 mb-2 truncate">
            {language === "fr"
              ? "De votre analyse de"
              : "From your analysis of"}{" "}
            "{word.videoTitle}"
          </p>
        )}

        {/* Term + definition */}
        <div className="flex items-start gap-3 mb-3">
          {word.imageUrl && (
            <img
              src={word.imageUrl}
              alt={word.term}
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              style={{ border: "1.5px solid rgba(200, 144, 58, 0.3)" }}
              loading="lazy"
            />
          )}
          <p className="text-sm text-text-secondary leading-relaxed">
            <span className="font-display font-semibold text-text-primary">
              {word.term}
            </span>
            <span className="mx-1.5 text-accent-primary/30">—</span>
            {word.shortDefinition}
          </p>
        </div>

        {/* CTA */}
        {onPrefillChat && (
          <button
            onClick={handleDiscuss}
            className="flex items-center gap-1.5 text-[11px] text-accent-primary/70 hover:text-accent-primary transition-colors font-medium"
          >
            {language === "fr" ? "Discuter de ça" : "Discuss this"}
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ChatWelcomeInsight;
