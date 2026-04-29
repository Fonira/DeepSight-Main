/**
 * TrustBadges — 5 badges horizontaux de réassurance, placés sous PricingSection.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const ease = [0.4, 0, 0.2, 1] as const;

interface BadgeDef {
  id: string;
  icon: string; // emoji
  labelFr: string;
  labelEn: string;
}

const BADGES: BadgeDef[] = [
  {
    id: "french-ai",
    icon: "🇫🇷",
    labelFr: "IA 100 % Française & Européenne (Mistral)",
    labelEn: "100 % French & European AI (Mistral)",
  },
  {
    id: "lifetime-archive",
    icon: "🗄️",
    labelFr: "Analyses archivées à vie",
    labelEn: "Analyses archived for lifetime",
  },
  {
    id: "gdpr",
    icon: "🛡️",
    labelFr: "Conforme RGPD",
    labelEn: "GDPR-compliant",
  },
  {
    id: "refund-14d",
    icon: "✓",
    labelFr: "Garantie 14 jours satisfait ou remboursé",
    labelEn: "14-day money-back guarantee",
  },
  {
    id: "stripe-secure",
    icon: "🔒",
    labelFr: "Paiement sécurisé Stripe",
    labelEn: "Secure Stripe payment",
  },
];

export interface TrustBadgesProps {
  language: "fr" | "en" | string;
}

export default function TrustBadges({ language }: TrustBadgesProps) {
  const lang = language === "fr" ? "fr" : "en";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-10 sm:py-14 px-4 sm:px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.ul
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease }}
          aria-label={lang === "fr" ? "Garanties de confiance" : "Trust badges"}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4"
        >
          {BADGES.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl text-xs sm:text-[13px] text-text-secondary text-center justify-center"
            >
              <span className="text-base flex-shrink-0" aria-hidden="true">
                {b.icon}
              </span>
              <span className="leading-tight">
                {lang === "fr" ? b.labelFr : b.labelEn}
              </span>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
