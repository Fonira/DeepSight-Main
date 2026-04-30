/**
 * PricingSection — Grille tarifaire 3 plans alignee sur planPrivileges.ts.
 * Plans : Gratuit (0) / Plus (4.99) / Pro (9.99)
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Zap, Star, Crown, Check, X, ArrowRight, Shield } from "lucide-react";
import {
  PLAN_LIMITS,
  PLANS_INFO,
  type PlanId,
} from "../../config/planPrivileges";

const ease = [0.4, 0, 0.2, 1] as const;

interface PlanCard {
  id: PlanId;
  icon: typeof Zap;
  gradient: string;
  borderColor: string;
  glowColor: string;
  features: Array<{
    textFr: string;
    textEn: string;
    included: boolean;
    highlight?: boolean;
  }>;
}

const PLAN_CARDS: PlanCard[] = [
  {
    id: "free",
    icon: Zap,
    gradient: "from-gray-500 to-gray-600",
    borderColor: "border-border-subtle",
    glowColor: "",
    features: [
      {
        textFr: `${PLAN_LIMITS.free.monthlyAnalyses} analyses/mois`,
        textEn: `${PLAN_LIMITS.free.monthlyAnalyses} analyses/month`,
        included: true,
      },
      {
        textFr: `Videos jusqu'a ${PLAN_LIMITS.free.maxVideoLengthMin} min`,
        textEn: `Videos up to ${PLAN_LIMITS.free.maxVideoLengthMin} min`,
        included: true,
      },
      {
        textFr: "Chat IA basique (5/video)",
        textEn: "Basic AI Chat (5/video)",
        included: true,
      },
      {
        textFr: "Flashcards & Quiz",
        textEn: "Flashcards & Quiz",
        included: true,
      },
      { textFr: "Export texte", textEn: "Text export", included: true },
      { textFr: "Mindmap", textEn: "Mindmap", included: false },
      { textFr: "Fact-check", textEn: "Fact-check", included: false },
      { textFr: "Export PDF", textEn: "PDF export", included: false },
    ],
  },
  {
    id: "pro",
    icon: Star,
    gradient: "from-blue-500 to-indigo-600",
    borderColor: "border-blue-500/50",
    glowColor: "shadow-xl shadow-blue-500/15",
    features: [
      {
        textFr: `${PLAN_LIMITS.pro.monthlyAnalyses} analyses/mois`,
        textEn: `${PLAN_LIMITS.pro.monthlyAnalyses} analyses/month`,
        included: true,
      },
      {
        textFr: `Videos jusqu'a ${PLAN_LIMITS.pro.maxVideoLengthMin} min`,
        textEn: `Videos up to ${PLAN_LIMITS.pro.maxVideoLengthMin} min`,
        included: true,
      },
      {
        textFr: "Chat IA (25/video)",
        textEn: "AI Chat (25/video)",
        included: true,
      },
      {
        textFr: "Mindmap interactif",
        textEn: "Interactive Mindmap",
        included: true,
        highlight: true,
      },
      {
        textFr: "Fact-check automatique",
        textEn: "Automated Fact-check",
        included: true,
        highlight: true,
      },
      {
        textFr: "Web Search IA (20/mois)",
        textEn: "AI Web Search (20/mo)",
        included: true,
        highlight: true,
      },
      {
        textFr: "Export PDF & Markdown",
        textEn: "PDF & Markdown export",
        included: true,
      },
      {
        textFr: "Debat IA (3/mois)",
        textEn: "AI Debate (3/mo)",
        included: true,
      },
    ],
  },
  {
    id: "expert",
    icon: Crown,
    gradient: "from-violet-500 to-purple-600",
    borderColor: "border-violet-500/40",
    glowColor: "",
    features: [
      {
        textFr: `${PLAN_LIMITS.expert.monthlyAnalyses} analyses/mois`,
        textEn: `${PLAN_LIMITS.expert.monthlyAnalyses} analyses/month`,
        included: true,
      },
      {
        textFr: `Videos jusqu'a ${Math.round(PLAN_LIMITS.expert.maxVideoLengthMin / 60)}h`,
        textEn: `Videos up to ${Math.round(PLAN_LIMITS.expert.maxVideoLengthMin / 60)}h`,
        included: true,
      },
      {
        textFr: "Chat IA illimite",
        textEn: "Unlimited AI Chat",
        included: true,
        highlight: true,
      },
      {
        textFr: "Playlists (10 max)",
        textEn: "Playlists (10 max)",
        included: true,
        highlight: true,
      },
      {
        textFr: "Chat vocal (45 min/mois)",
        textEn: "Voice chat (45 min/mo)",
        included: true,
        highlight: true,
      },
      {
        textFr: "Deep Research",
        textEn: "Deep Research",
        included: true,
        highlight: true,
      },
      {
        textFr: "Web Search IA (60/mois)",
        textEn: "AI Web Search (60/mo)",
        included: true,
      },
      { textFr: "File prioritaire", textEn: "Priority queue", included: true },
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
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6" ref={ref}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
            {lang === "fr"
              ? "Investissez dans votre comprehension"
              : "Invest in your understanding"}
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto mb-4">
            {lang === "fr"
              ? "Commencez gratuitement. Evoluez quand vos besoins grandissent. Sans engagement."
              : "Start for free. Scale when your needs grow. No commitment."}
          </p>
          <p className="text-text-tertiary text-xs sm:text-sm max-w-lg mx-auto">
            {lang === "fr"
              ? "Pourquoi payer ? Parce qu'une heure de video analysee en 5 minutes, des affirmations verifiees par des sources, et des syntheses exportables transforment votre productivite intellectuelle."
              : "Why pay? Because an hour of video analyzed in 5 minutes, claims verified against sources, and exportable summaries transform your intellectual productivity."}
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 max-w-4xl mx-auto">
          {PLAN_CARDS.map((plan, cardIndex) => {
            const info = PLANS_INFO[plan.id];
            const Icon = plan.icon;
            const isPopular = info.popular;
            const price = info.priceMonthly / 100;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }
                }
                transition={{
                  duration: 0.4,
                  ease,
                  delay: 0.1 + cardIndex * 0.08,
                }}
              >
                <div
                  className={`relative p-6 rounded-xl border transition-all h-full flex flex-col overflow-hidden ${
                    isPopular
                      ? `${plan.borderColor} bg-blue-500/[0.06] ${plan.glowColor} scale-[1.03] ring-1 ring-blue-500/25 z-10`
                      : `${plan.borderColor} bg-bg-secondary/40 hover:border-border-default`
                  }`}
                >
                  {/* Badge populaire */}
                  {info.badge && (
                    <div className="absolute -top-0 -right-0">
                      <div
                        className="text-white text-[0.625rem] font-bold px-2 py-1 rounded-bl-xl"
                        style={{ backgroundColor: info.badge.color }}
                      >
                        {info.badge.text}
                      </div>
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4 shadow-lg`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Header */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-text-primary text-sm">
                      {lang === "fr" ? info.name : info.nameEn}
                    </h3>
                    <p className="text-[0.6875rem] text-text-tertiary">
                      {lang === "fr" ? info.description : info.descriptionEn}
                    </p>
                  </div>

                  {/* Prix */}
                  <div className="mb-5">
                    <span className="text-2xl font-semibold text-text-primary tabular-nums">
                      {price === 0 ? "0" : price.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-text-tertiary text-xs ml-1">
                      /{lang === "fr" ? "mois" : "month"}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="space-y-2 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 text-xs ${
                          feature.included
                            ? feature.highlight
                              ? "text-accent-primary"
                              : "text-text-secondary"
                            : "text-text-muted line-through"
                        }`}
                      >
                        {feature.included ? (
                          <div
                            className={`w-4 h-4 rounded-full ${
                              feature.highlight
                                ? "bg-amber-500/20"
                                : "bg-green-500/20"
                            } flex items-center justify-center flex-shrink-0 mt-0.5`}
                          >
                            <Check
                              className={`w-2.5 h-2.5 ${
                                feature.highlight
                                  ? "text-amber-400"
                                  : "text-green-400"
                              }`}
                            />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <X className="w-2.5 h-2.5 text-gray-500" />
                          </div>
                        )}
                        <span
                          className={feature.highlight ? "font-medium" : ""}
                        >
                          {lang === "fr" ? feature.textFr : feature.textEn}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <motion.button
                    onClick={() => onNavigate("/login?tab=register")}
                    className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                      isPopular
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 shadow-lg"
                        : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-subtle"
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {plan.id === "free"
                      ? lang === "fr"
                        ? "Commencer gratuitement"
                        : "Start for free"
                      : plan.id === "pro"
                        ? lang === "fr"
                          ? "Essayer 7 jours gratuitement"
                          : "Try 7 days free"
                        : lang === "fr"
                          ? "Commencer"
                          : "Get started"}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Garanties */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, ease, delay: 0.5 }}
          className="text-center mt-10"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              {lang === "fr" ? "Annulation a tout moment" : "Cancel anytime"}
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-400" />
              {lang === "fr" ? "Remboursement 14 jours" : "14-day refund"}
            </span>
            <span className="flex items-center gap-1.5">
              <span>🇪🇺</span>
              {lang === "fr"
                ? "Donnees hebergees en Europe"
                : "Data hosted in Europe"}
            </span>
          </div>
        </motion.div>

        {/* B2B contact */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, ease, delay: 0.6 }}
          className="text-center mt-10"
        >
          <div className="inline-flex flex-col items-center gap-2 p-5 rounded-xl border border-border-subtle bg-bg-secondary/40 backdrop-blur-sm">
            <p className="text-sm text-text-primary font-medium">
              {lang === "fr"
                ? "Besoin d'une offre sur-mesure ?"
                : "Need a custom plan?"}
            </p>
            <p className="text-xs text-text-secondary max-w-md">
              {lang === "fr"
                ? "Equipes, universites, entreprises — contactez-nous pour un plan adapte."
                : "Teams, universities, enterprises — contact us for a tailored plan."}
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
    </section>
  );
}
