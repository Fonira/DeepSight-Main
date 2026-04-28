/**
 * DemoFeaturesShowcase — Bandeau de mise en avant des features pendant la demo.
 * Met en avant la conversation vocale IA et les outils d'etude.
 */

import { motion } from "framer-motion";

interface DemoFeaturesShowcaseProps {
  language: string;
  onSignup: () => void;
}

const features = [
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    ),
    title: { fr: "Conversez avec la video", en: "Talk to the video" },
    description: {
      fr: "Posez vos questions a voix haute — l'IA vous repond comme un expert",
      en: "Ask your questions out loud — AI answers like an expert",
    },
    highlight: true,
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
    title: { fr: "Flashcards & Quiz", en: "Flashcards & Quiz" },
    description: {
      fr: "Revisez avec des flashcards generees automatiquement",
      en: "Review with auto-generated flashcards",
    },
    highlight: false,
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    title: { fr: "Cartes mentales", en: "Mind Maps" },
    description: {
      fr: "Visualisez les idees en cartes mentales interactives",
      en: "Visualize ideas as interactive mind maps",
    },
    highlight: false,
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
    title: { fr: "Fact-checking web", en: "Web Fact-checking" },
    description: {
      fr: "Chaque affirmation verifiee par recherche web en temps reel",
      en: "Every claim verified by real-time web search",
    },
    highlight: false,
  },
];

export default function DemoFeaturesShowcase({
  language,
  onSignup,
}: DemoFeaturesShowcaseProps) {
  const lang = language as "fr" | "en";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4, duration: 0.5 }}
      className="w-full max-w-2xl mx-auto mt-4"
    >
      {/* Hero feature: Voice conversation */}
      <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-indigo-500/40 via-violet-500/40 to-cyan-500/40 mb-3">
        <div className="relative bg-[#0c0c14] rounded-2xl p-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-violet-500/[0.07] pointer-events-none" />
          <div className="relative flex items-center gap-4">
            {/* Mic icon with pulse */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center">
              <div className="relative">
                <svg
                  className="w-6 h-6 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-white font-semibold text-sm mb-0.5">
                {lang === "fr"
                  ? "Conversez litteralement avec la video"
                  : "Literally talk to the video"}
              </h4>
              <p className="text-text-muted text-xs leading-relaxed">
                {lang === "fr"
                  ? "Agent IA vocal — posez vos questions a voix haute et obtenez des reponses instantanees"
                  : "Voice AI agent — ask your questions out loud and get instant answers"}
              </p>
            </div>

            <button
              onClick={onSignup}
              className="flex-shrink-0 px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-xs font-medium rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/20"
            >
              {lang === "fr" ? "Essayer" : "Try it"}
              <svg
                className="w-3 h-3 inline-block ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* Secondary features grid */}
      <div className="grid grid-cols-3 gap-2">
        {features
          .filter((f) => !f.highlight)
          .map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6 + index * 0.1, duration: 0.4 }}
              className="p-3 rounded-xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200"
            >
              <div className="text-indigo-400/70 mb-2">{feature.icon}</div>
              <h5 className="text-text-secondary text-[11px] font-medium leading-tight mb-0.5">
                {feature.title[lang]}
              </h5>
              <p className="text-text-tertiary text-[10px] leading-relaxed line-clamp-2">
                {feature.description[lang]}
              </p>
            </motion.div>
          ))}
      </div>
    </motion.div>
  );
}
