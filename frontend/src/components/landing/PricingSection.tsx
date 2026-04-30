/**
 * PricingSection — Editorial Premium (avril 2026)
 *
 * Section pricing landing publique. 3 plans v2 avec hierarchie visuelle,
 * trial 7j visible sur Pro/Expert, lien vers /upgrade pour comparaison
 * detaillee. Aligne sur UpgradePage.tsx.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Zap,
  Star,
  Crown,
  Check,
  ArrowRight,
  Gift,
  Shield,
} from "lucide-react";
import {
  PLAN_LIMITS,
  PLANS_INFO,
  type PlanId,
} from "../../config/planPrivileges";

const ease = [0.22, 1, 0.36, 1] as const;

interface PlanCardData {
  id: PlanId;
  icon: typeof Zap;
  gradient: string;
  ringClass: string;
  taglineFr: string;
  taglineEn: string;
  features: { textFr: string; textEn: string; highlight?: boolean }[];
}

const PLAN_CARDS: PlanCardData[] = [
  {
    id: "free",
    icon: Zap,
    gradient: "from-slate-500 to-slate-600",
    ringClass: "ring-1 ring-white/[0.06]",
    taglineFr: "Pour decouvrir",
    taglineEn: "To discover",
    features: [
      {
        textFr: `${PLAN_LIMITS.free.monthlyAnalyses} analyses / mois`,
        textEn: `${PLAN_LIMITS.free.monthlyAnalyses} analyses / month`,
      },
      {
        textFr: `Videos jusqu'a ${PLAN_LIMITS.free.maxVideoLengthMin} min`,
        textEn: `Videos up to ${PLAN_LIMITS.free.maxVideoLengthMin} min`,
      },
      { textFr: "Chat IA basique", textEn: "Basic AI Chat" },
      { textFr: "Flashcards & Quiz", textEn: "Flashcards & Quiz" },
      { textFr: "Export texte", textEn: "Text export" },
    ],
  },
  {
    id: "pro",
    icon: Star,
    gradient: "from-blue-500 to-indigo-600",
    ringClass: "ring-1 ring-blue-500/40",
    taglineFr: "Pour apprendre serieusement",
    taglineEn: "For serious learners",
    features: [
      {
        textFr: `${PLAN_LIMITS.pro.monthlyAnalyses} analyses / mois`,
        textEn: `${PLAN_LIMITS.pro.monthlyAnalyses} analyses / month`,
      },
      {
        textFr: "Videos jusqu'a 1 h",
        textEn: "Videos up to 1 h",
      },
      { textFr: "Chat IA (25 q/video)", textEn: "AI Chat (25 q/video)" },
      {
        textFr: "Cartes mentales interactives",
        textEn: "Interactive mind maps",
        highlight: true,
      },
      {
        textFr: "Fact-check automatique",
        textEn: "Auto fact-check",
        highlight: true,
      },
      {
        textFr: "Voice chat (30 min/mois)",
        textEn: "Voice chat (30 min/mo)",
        highlight: true,
      },
      { textFr: "Recherche web (20/mois)", textEn: "Web search (20/mo)" },
      { textFr: "Export PDF + Markdown", textEn: "PDF + Markdown export" },
    ],
  },
  {
    id: "expert",
    icon: Crown,
    gradient: "from-violet-500 via-fuchsia-500 to-purple-600",
    ringClass: "ring-2 ring-violet-500/60",
    taglineFr: "Pour les createurs et chercheurs",
    taglineEn: "For creators & researchers",
    features: [
      {
        textFr: `${PLAN_LIMITS.expert.monthlyAnalyses} analyses / mois`,
        textEn: `${PLAN_LIMITS.expert.monthlyAnalyses} analyses / month`,
      },
      {
        textFr: `Videos jusqu'a ${Math.round(PLAN_LIMITS.expert.maxVideoLengthMin / 60)} h`,
        textEn: `Videos up to ${Math.round(PLAN_LIMITS.expert.maxVideoLengthMin / 60)} h`,
      },
      {
        textFr: "Chat IA illimite",
        textEn: "Unlimited AI Chat",
        highlight: true,
      },
      {
        textFr: "Playlists (10 × 20 videos)",
        textEn: "Playlists (10 × 20 videos)",
        highlight: true,
      },
      {
        textFr: "Voice chat (120 min/mois)",
        textEn: "Voice chat (120 min/mo)",
        highlight: true,
      },
      {
        textFr: "Deep Research + TTS",
        textEn: "Deep Research + TTS",
        highlight: true,
      },
      { textFr: "Recherche web (60/mois)", textEn: "Web search (60/mo)" },
      { textFr: "File d'attente prioritaire", textEn: "Priority queue" },
    ],
  },
];

interface PricingSectionProps {
  language: string;
  onNavigate: (path: string) => void;
}

export default function PricingSection({
  language,
  onNavigate,
}: PricingSectionProps) {
  const lang = language === "fr" ? "fr" : "en";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6" ref={ref}>
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest text-violet-200 bg-violet-500/10 border border-violet-500/20 mb-5">
            {lang === "fr"
              ? "Tarifs simples · sans engagement"
              : "Simple pricing · no commitment"}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-text-primary mb-4">
            {lang === "fr" ? "Investissez dans votre " : "Invest in your "}
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              {lang === "fr" ? "comprehension" : "understanding"}
            </span>
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto">
            {lang === "fr"
              ? "Commencez gratuitement. Essayez Pro ou Expert 7 jours sans CB. Annulez quand vous voulez."
              : "Start for free. Try Pro or Expert 7 days without a card. Cancel anytime."}
          </p>
        </motion.div>

        {/* CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:items-end max-w-5xl mx-auto">
          {PLAN_CARDS.map((plan, cardIndex) => {
            const info = PLANS_INFO[plan.id];
            const Icon = plan.icon;
            const monthly = info.priceMonthly / 100;
            const isExpert = plan.id === "expert";
            const isPro = plan.id === "pro";
            const isFree = plan.id === "free";
            const showsTrial = isPro || isExpert;
            const tagline = lang === "fr" ? plan.taglineFr : plan.taglineEn;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }
                }
                transition={{
                  duration: 0.45,
                  ease,
                  delay: 0.08 + cardIndex * 0.06,
                }}
                className={`relative ${
                  isExpert
                    ? "lg:scale-[1.04] lg:-mt-4"
                    : isFree
                      ? "lg:opacity-95"
                      : ""
                }`}
              >
                {/* Glow Expert */}
                {isExpert && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-purple-500/30 blur-2xl opacity-60"
                    style={{
                      animation: "ds-pricing-glow 4s ease-in-out infinite",
                    }}
                  />
                )}

                <div
                  className={`relative h-full flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl ${plan.ringClass}`}
                >
                  {/* Top ribbon */}
                  {showsTrial ? (
                    <div
                      className={`text-center text-[11px] font-bold tracking-wide py-2 text-white ${
                        isExpert
                          ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500"
                          : "bg-gradient-to-r from-blue-500 to-cyan-500"
                      }`}
                    >
                      <Gift className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                      {lang === "fr"
                        ? "ESSAI 7 JOURS · SANS CB"
                        : "7-DAY TRIAL · NO CARD"}
                    </div>
                  ) : (
                    <div className="h-[34px]" aria-hidden />
                  )}

                  <div className="p-6 sm:p-7 flex flex-col flex-1">
                    {/* Icon + name + tagline */}
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={`flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-lg`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-text-primary leading-tight">
                          {lang === "fr" ? info.name : info.nameEn}
                        </h3>
                        <p className="text-[11px] text-text-tertiary leading-tight mt-0.5">
                          {tagline}
                        </p>
                      </div>
                    </div>

                    {/* Prix */}
                    <div className="mb-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-semibold text-text-primary tabular-nums tracking-tight">
                          {monthly === 0
                            ? "0"
                            : monthly.toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-text-tertiary text-sm">
                          €/{lang === "fr" ? "mois" : "mo"}
                        </span>
                      </div>
                      {monthly === 0 ? (
                        <p className="text-xs text-text-tertiary mt-1">
                          {lang === "fr"
                            ? "Sans CB · a vie"
                            : "No card · forever"}
                        </p>
                      ) : (
                        <p className="text-xs text-text-tertiary mt-1">
                          {lang === "fr"
                            ? `ou ${(info.priceYearly / 100).toFixed(0)} € / an (−17 %)`
                            : `or €${(info.priceYearly / 100).toFixed(0)} / yr (−17%)`}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-text-secondary mb-5 leading-relaxed">
                      {lang === "fr" ? info.description : info.descriptionEn}
                    </p>

                    {/* Features */}
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {plan.features.map((feat, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-2.5 text-[13px] leading-snug ${
                            feat.highlight
                              ? "text-text-primary"
                              : "text-text-secondary"
                          }`}
                        >
                          <span
                            className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                              feat.highlight
                                ? isExpert
                                  ? "bg-violet-500/20"
                                  : "bg-blue-500/20"
                                : "bg-emerald-500/15"
                            }`}
                          >
                            <Check
                              className={`w-2.5 h-2.5 ${
                                feat.highlight
                                  ? isExpert
                                    ? "text-violet-300"
                                    : "text-blue-300"
                                  : "text-emerald-400"
                              }`}
                              strokeWidth={3}
                            />
                          </span>
                          <span className={feat.highlight ? "font-medium" : ""}>
                            {lang === "fr" ? feat.textFr : feat.textEn}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTAs */}
                    <div className="space-y-2">
                      {showsTrial ? (
                        <>
                          <button
                            onClick={() =>
                              onNavigate(`/login?tab=register&trial=${plan.id}`)
                            }
                            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 min-h-[44px] active:scale-[0.98] ${
                              isExpert
                                ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:opacity-95"
                                : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:opacity-95"
                            }`}
                          >
                            <Gift className="w-4 h-4" />
                            {lang === "fr"
                              ? "Essayer 7 jours gratuits"
                              : "Try 7 days free"}
                          </button>
                          <button
                            onClick={() => onNavigate("/upgrade")}
                            className="w-full py-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors flex items-center justify-center gap-1"
                          >
                            {lang === "fr" ? (
                              <>
                                voir comparaison detaillee{" "}
                                <span aria-hidden>→</span>
                              </>
                            ) : (
                              <>
                                see detailed comparison{" "}
                                <span aria-hidden>→</span>
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onNavigate("/login?tab=register")}
                          className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 min-h-[44px] active:scale-[0.98] bg-white/[0.04] text-text-secondary border border-white/[0.08] hover:bg-white/[0.07]"
                        >
                          {lang === "fr"
                            ? "Commencer gratuitement"
                            : "Start for free"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* TRUST SIGNALS */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, ease, delay: 0.4 }}
          className="text-center mt-12"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-text-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              {lang === "fr" ? "Annulation a tout moment" : "Cancel anytime"}
            </span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              {lang === "fr" ? "Remboursement 14 jours" : "14-day refund"}
            </span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span>🇪🇺</span>
              {lang === "fr" ? "Donnees en Europe" : "Data in Europe"}
            </span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span>🇫🇷</span>
              {lang === "fr" ? "IA Mistral" : "Mistral AI"}
            </span>
          </div>
        </motion.div>

        {/* B2B contact */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, ease, delay: 0.5 }}
          className="text-center mt-10"
        >
          <div className="inline-flex flex-col items-center gap-2 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm max-w-md mx-auto">
            <p className="text-sm text-text-primary font-medium">
              {lang === "fr"
                ? "Besoin d'une offre sur-mesure ?"
                : "Need a custom plan?"}
            </p>
            <p className="text-xs text-text-secondary text-center">
              {lang === "fr"
                ? "Equipes, universites, entreprises — un plan adapte a vos volumes."
                : "Teams, universities, companies — a plan tailored to your volumes."}
            </p>
            <a
              href="mailto:contact@deepsightsynthesis.com?subject=Offre%20sur-mesure%20DeepSight"
              className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-text-primary text-xs font-medium transition-all"
            >
              {lang === "fr" ? "Contactez-nous" : "Contact us"}
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes ds-pricing-glow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
      `}</style>
    </section>
  );
}
