/**
 * DemoAnalysisStatic — Simulation d'une analyse DeepSight avec donnees statiques.
 * Aucun appel API. Affiche un resultat type d'analyse avec animation de "generation".
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Shield,
  BookOpen,
  ChevronDown,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

// ─── Donnees statiques d'analyse ───

const DEMO_VIDEO = {
  title: "Comment l'IA transforme la recherche scientifique en 2026",
  channel: "Science & Futur",
  duration: "18:24",
  thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  category: "Science & Technologie",
  wordCount: 3842,
  reliability: 78,
};

interface KeyPoint {
  text: string;
  certainty: "solid" | "plausible" | "uncertain" | "verify";
  source?: string;
}

const KEY_POINTS: KeyPoint[] = [
  {
    text: "Les modeles de langage sont desormais capables d'analyser des articles scientifiques et d'en extraire les methodologies en quelques secondes.",
    certainty: "solid",
    source: "Nature, 2025",
  },
  {
    text: "L'IA a permis de reduire de 40% le temps de revue systematique dans les meta-analyses medicales.",
    certainty: "plausible",
    source: "The Lancet Digital Health",
  },
  {
    text: "D'ici 2028, 60% des publications scientifiques utiliseront l'IA comme co-auteur.",
    certainty: "uncertain",
  },
  {
    text: "Les biais algorithmiques dans l'IA de recherche sont completement maitrises grace aux nouvelles reglementations europeennes.",
    certainty: "verify",
  },
];

const DEMO_SUMMARY = `L'intervenant presente les avancees recentes de l'intelligence artificielle dans le domaine de la recherche scientifique. Il distingue trois axes : l'acceleration de la revue de litterature, l'assistance a la formulation d'hypotheses, et l'automatisation partielle de l'analyse de donnees.

Le discours est globalement optimiste mais nuance : si les gains de productivite sont documentes, les questions ethiques liees a l'attribution intellectuelle et aux biais de reproduction restent ouvertes.`;

const DEMO_TAGS = [
  "Intelligence Artificielle",
  "Recherche Scientifique",
  "Machine Learning",
  "Ethique IA",
  "Meta-analyse",
  "Publication Scientifique",
];

const CERTAINTY_CONFIG = {
  solid: {
    label: "SOLIDE",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: CheckCircle2,
  },
  plausible: {
    label: "PLAUSIBLE",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: BarChart3,
  },
  uncertain: {
    label: "INCERTAIN",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: HelpCircle,
  },
  verify: {
    label: "A VERIFIER",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: AlertTriangle,
  },
};

// ─── Tabs disponibles ───

type DemoTab = "summary" | "keypoints" | "factcheck";

const TABS: {
  id: DemoTab;
  labelFr: string;
  labelEn: string;
  icon: typeof Brain;
}[] = [
  { id: "summary", labelFr: "Synthese", labelEn: "Summary", icon: BookOpen },
  {
    id: "keypoints",
    labelFr: "Points cles",
    labelEn: "Key Points",
    icon: Brain,
  },
  {
    id: "factcheck",
    labelFr: "Fact-check",
    labelEn: "Fact-check",
    icon: Shield,
  },
];

// ─── Composant principal ───

interface DemoAnalysisStaticProps {
  language: string;
}

export default function DemoAnalysisStatic({
  language,
}: DemoAnalysisStaticProps) {
  const lang = language === "fr" ? "fr" : "en";
  const [activeTab, setActiveTab] = useState<DemoTab>("summary");
  const [isGenerating, setIsGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [expandedPoint, setExpandedPoint] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulation d'une generation progressive
  useEffect(() => {
    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setIsGenerating(false);
              setShowContent(true);
            }, 400);
            return 100;
          }
          // Acceleration progressive puis ralentissement
          const increment = prev < 60 ? 4 : prev < 85 ? 2 : 1;
          return Math.min(prev + increment, 100);
        });
      }, 80);

      return () => clearInterval(interval);
    }, 600);

    return () => clearTimeout(startDelay);
  }, []);

  const progressSteps = [
    {
      threshold: 15,
      labelFr: "Extraction du transcript...",
      labelEn: "Extracting transcript...",
    },
    {
      threshold: 40,
      labelFr: "Analyse par Mistral AI...",
      labelEn: "Analyzing with Mistral AI...",
    },
    {
      threshold: 70,
      labelFr: "Evaluation de la fiabilite...",
      labelEn: "Evaluating reliability...",
    },
    {
      threshold: 90,
      labelFr: "Structuration des resultats...",
      labelEn: "Structuring results...",
    },
    {
      threshold: 100,
      labelFr: "Analyse terminee",
      labelEn: "Analysis complete",
    },
  ];

  const currentStep =
    progressSteps.find((s) => progress <= s.threshold) ||
    progressSteps[progressSteps.length - 1];

  return (
    <div ref={containerRef} className="w-full">
      {/* Titre section */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
            {lang === "fr"
              ? "Voyez DeepSight en action"
              : "See DeepSight in action"}
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
            {lang === "fr"
              ? "Voici ce que DeepSight produit en quelques minutes a partir d'une video YouTube."
              : "Here's what DeepSight produces in minutes from a YouTube video."}
          </p>
        </motion.div>
      </div>
      {/* Carte d'analyse */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="max-w-3xl mx-auto"
      >
        <div className="relative rounded-2xl border border-border-subtle bg-white/[0.03] backdrop-blur-xl overflow-hidden">
          {/* Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 pointer-events-none" />

          {/* Video header */}
          <div className="relative flex gap-4 p-5 border-b border-white/5">
            {/* Thumbnail simulee */}
            <div className="flex-shrink-0 w-36 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-white/5 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-1">
                  <svg
                    className="w-4 h-4 text-text-secondary"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="text-[9px] text-text-tertiary">
                  {DEMO_VIDEO.duration}
                </span>
              </div>
            </div>

            {/* Video info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2">
                {DEMO_VIDEO.title}
              </h3>
              <p className="text-text-muted text-xs mt-1">{DEMO_VIDEO.channel}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[10px] text-text-secondary">
                  <Clock className="w-2.5 h-2.5" />
                  {DEMO_VIDEO.duration}
                </span>
                <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] text-indigo-300">
                  {DEMO_VIDEO.category}
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] text-emerald-300">
                  {DEMO_VIDEO.wordCount.toLocaleString()}{" "}
                  {lang === "fr" ? "mots" : "words"}
                </span>
              </div>
            </div>

            {/* Score de fiabilite */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-white/5"
                  />
                  <motion.circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                    animate={
                      showContent
                        ? {
                            strokeDashoffset:
                              2 *
                              Math.PI *
                              20 *
                              (1 - DEMO_VIDEO.reliability / 100),
                          }
                        : {}
                    }
                    transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient
                      id="scoreGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-text-primary">
                    {showContent ? DEMO_VIDEO.reliability : "--"}
                  </span>
                </div>
              </div>
              <span className="text-[9px] text-text-tertiary mt-1">
                {lang === "fr" ? "Fiabilite" : "Reliability"}
              </span>
            </div>
          </div>

          {/* Barre de progression / Generation */}
          <AnimatePresence mode="wait">
            {isGenerating && (
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="px-5 py-4 border-b border-white/5"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-xs text-text-secondary">
                      {lang === "fr"
                        ? currentStep.labelFr
                        : currentStep.labelEn}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted font-mono">
                    {progress}%
                  </span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
                    style={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs */}
          <AnimatePresence>
            {showContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex border-b border-white/5">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium transition-all relative
                          ${isActive ? "text-indigo-400" : "text-white/40 hover:text-white/60"}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {lang === "fr" ? tab.labelFr : tab.labelEn}
                        {isActive && (
                          <motion.div
                            layoutId="demo-tab-indicator"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-500"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Contenu des tabs */}
                <div className="p-5">
                  <AnimatePresence mode="wait">
                    {activeTab === "summary" && (
                      <motion.div
                        key="summary"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        {DEMO_SUMMARY.split("\n\n").map((paragraph, i) => (
                          <motion.p
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.15, duration: 0.4 }}
                            className="text-text-secondary text-sm leading-relaxed"
                          >
                            {paragraph}
                          </motion.p>
                        ))}

                        {/* Tags */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4, duration: 0.4 }}
                          className="flex flex-wrap gap-1.5 pt-2"
                        >
                          {DEMO_TAGS.map((tag, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-full text-[11px] bg-white/[0.03] border border-white/[0.06] text-text-muted"
                            >
                              #{tag}
                            </span>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}

                    {activeTab === "keypoints" && (
                      <motion.div
                        key="keypoints"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-3"
                      >
                        {/* Legende marqueurs epistemiques */}
                        <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                          {Object.entries(CERTAINTY_CONFIG).map(
                            ([key, config]) => {
                              const Icon = config.icon;
                              return (
                                <div
                                  key={key}
                                  className="flex items-center gap-1"
                                >
                                  <Icon className={`w-3 h-3 ${config.color}`} />
                                  <span
                                    className={`text-[10px] font-medium ${config.color}`}
                                  >
                                    {config.label}
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>

                        {KEY_POINTS.map((point, index) => {
                          const config = CERTAINTY_CONFIG[point.certainty];
                          const Icon = config.icon;
                          const isExpanded = expandedPoint === index;

                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                delay: index * 0.12,
                                duration: 0.4,
                              }}
                            >
                              <button
                                onClick={() =>
                                  setExpandedPoint(isExpanded ? null : index)
                                }
                                className={`w-full text-left p-3 rounded-xl ${config.bg} border ${config.border} transition-all hover:bg-white/[0.04]`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`flex-shrink-0 w-6 h-6 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center mt-0.5`}
                                  >
                                    <Icon
                                      className={`w-3.5 h-3.5 ${config.color}`}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}
                                      >
                                        {config.label}
                                      </span>
                                      {point.source && (
                                        <span className="text-[9px] text-text-tertiary">
                                          — {point.source}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-text-secondary text-sm leading-relaxed">
                                      {point.text}
                                    </p>
                                  </div>
                                  <ChevronDown
                                    className={`w-4 h-4 text-white/20 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  />
                                </div>
                              </button>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-4 py-3 ml-9 text-xs text-text-muted leading-relaxed">
                                      {point.certainty === "solid" &&
                                        (lang === "fr"
                                          ? "Cette affirmation est etayee par des publications scientifiques recentes et des donnees verifiables."
                                          : "This claim is supported by recent scientific publications and verifiable data.")}
                                      {point.certainty === "plausible" &&
                                        (lang === "fr"
                                          ? "Cette affirmation est coherente avec les tendances observees mais necessite des donnees supplementaires pour etre confirmee."
                                          : "This claim is consistent with observed trends but needs additional data to be confirmed.")}
                                      {point.certainty === "uncertain" &&
                                        (lang === "fr"
                                          ? "Cette projection est speculative et depend de nombreux facteurs non maitrises."
                                          : "This projection is speculative and depends on many uncontrolled factors.")}
                                      {point.certainty === "verify" &&
                                        (lang === "fr"
                                          ? "Cette affirmation semble exageree. Les reglementations europeennes sont en cours mais ne garantissent pas l'elimination complete des biais."
                                          : "This claim seems exaggerated. European regulations are in progress but do not guarantee complete elimination of biases.")}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}

                    {activeTab === "factcheck" && (
                      <motion.div
                        key="factcheck"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        {/* Fact-check resume */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/5 to-cyan-500/5 border border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                              {lang === "fr"
                                ? "Verification automatique"
                                : "Automated Verification"}
                            </span>
                          </div>
                          <p className="text-text-secondary text-xs leading-relaxed">
                            {lang === "fr"
                              ? "4 affirmations analysees — 1 confirmee, 1 plausible, 1 incertaine, 1 a verifier. Sources croisees avec Nature, The Lancet et les rapports de l'UE."
                              : "4 claims analyzed — 1 confirmed, 1 plausible, 1 uncertain, 1 needs verification. Cross-referenced with Nature, The Lancet and EU reports."}
                          </p>
                        </div>

                        {/* Fact items */}
                        {[
                          {
                            claim:
                              lang === "fr"
                                ? "Les LLM analysent les articles scientifiques"
                                : "LLMs analyze scientific articles",
                            verdict: "confirmed" as const,
                            source: "Nature Reviews Methods Primers, 2025",
                          },
                          {
                            claim:
                              lang === "fr"
                                ? "Reduction de 40% du temps de meta-analyse"
                                : "40% reduction in meta-analysis time",
                            verdict: "partial" as const,
                            source:
                              "The Lancet Digital Health — chiffre varie de 25% a 50%",
                          },
                          {
                            claim:
                              lang === "fr"
                                ? "Biais algorithmiques completement maitrises"
                                : "Algorithmic biases completely controlled",
                            verdict: "false" as const,
                            source:
                              lang === "fr"
                                ? "AI Act (UE) — reglementation en cours, pas de maitrise complete"
                                : "AI Act (EU) — regulation in progress, no complete control",
                          },
                        ].map((fact, index) => {
                          const verdictConfig = {
                            confirmed: {
                              label: lang === "fr" ? "Confirme" : "Confirmed",
                              color: "text-emerald-400",
                              bg: "bg-emerald-500/10",
                              border: "border-emerald-500/20",
                            },
                            partial: {
                              label:
                                lang === "fr"
                                  ? "Partiellement vrai"
                                  : "Partially true",
                              color: "text-amber-400",
                              bg: "bg-amber-500/10",
                              border: "border-amber-500/20",
                            },
                            false: {
                              label: lang === "fr" ? "Trompeur" : "Misleading",
                              color: "text-red-400",
                              bg: "bg-red-500/10",
                              border: "border-red-500/20",
                            },
                          };
                          const vc = verdictConfig[fact.verdict];

                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                delay: index * 0.15,
                                duration: 0.4,
                              }}
                              className={`p-3 rounded-xl ${vc.bg} border ${vc.border}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-text-secondary text-sm mb-1">
                                    "{fact.claim}"
                                  </p>
                                  <p className="text-text-tertiary text-[11px]">
                                    {fact.source}
                                  </p>
                                </div>
                                <span
                                  className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${vc.color} ${vc.bg} border ${vc.border}`}
                                >
                                  {vc.label}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badge DeepSight */}
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-text-tertiary">
                {lang === "fr"
                  ? "Analyse par Mistral AI"
                  : "Analysis by Mistral AI"}
              </span>
            </div>
            <span className="text-[10px] text-text-tertiary font-mono">
              {lang === "fr" ? "Donnees de demonstration" : "Demo data"}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
