/**
 * VisualAnalysisSection — Section landing Phase 2 Visual Analysis.
 *
 * Tagline : « Maintenant, DeepSight ne se contente plus d'écouter — elle regarde. »
 * Position : section autonome après DemoAnalysisStatic.
 *
 * Affiche 3 frames mockup (storyboards YouTube simulés) + un overlay JSON
 * structuré (visual_hook, visual_structure, key_moments) montrant la valeur
 * ajoutée de la couche multimodale par-dessus le transcript+sourcing.
 *
 * Spec : 01-Projects/DeepSight/Sessions/2026-05-06-visual-analysis-phase-2-spec.md
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const ease = [0.4, 0, 0.2, 1] as const;

interface VisualMomentDef {
  ts: string; // timestamp affiché
  type: string; // hook | reveal | cta | transition | peak
  description: { fr: string; en: string };
}

// 3 moments visuels mockup pour la démo
const MOCKUP_MOMENTS: VisualMomentDef[] = [
  {
    ts: "00:03",
    type: "hook",
    description: {
      fr: "Plan rapproché sur un visage, fond vif, texte burned-in « ATTENTION »",
      en: "Close-up on face, vivid background, burned-in text « ATTENTION »",
    },
  },
  {
    ts: "01:42",
    type: "reveal",
    description: {
      fr: "Coupe brutale vers un graphique en barres ascendant",
      en: "Hard cut to ascending bar chart",
    },
  },
  {
    ts: "04:18",
    type: "cta",
    description: {
      fr: "Plan large, geste vers la caméra, surimpression « Abonne-toi »",
      en: "Wide shot, gesture toward camera, overlay « Subscribe »",
    },
  },
];

export interface VisualAnalysisSectionProps {
  language: "fr" | "en" | string;
}

export default function VisualAnalysisSection({ language }: VisualAnalysisSectionProps) {
  const lang = language === "fr" ? "fr" : "en";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const tagline = {
    fr: "Maintenant, DeepSight ne se contente plus d'écouter — elle regarde.",
    en: "Now, DeepSight doesn't just listen — it watches.",
  };

  const subtitle = {
    fr: "Hooks visuels, B-roll, CTA en surimpression, infographies : la couche visuelle révèle ce que le transcript ne dit pas. 100% Mistral Vision, sans télécharger la vidéo.",
    en: "Visual hooks, B-roll, on-screen CTAs, infographics: the visual layer surfaces what transcripts can't. 100% Mistral Vision, no video download.",
  };

  const badges = [
    {
      icon: "👁️",
      label: { fr: "Frames extraites", en: "Frames extracted" },
    },
    {
      icon: "🇫🇷",
      label: { fr: "Mistral Pixtral Large", en: "Mistral Pixtral Large" },
    },
    {
      icon: "⚡",
      label: { fr: "Pas de download vidéo", en: "No video download" },
    },
  ];

  return (
    <section
      ref={ref}
      className="py-16 sm:py-24 px-4 sm:px-6 relative"
      aria-label={lang === "fr" ? "Analyse visuelle" : "Visual analysis"}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header — tagline + subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease }}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs font-medium text-violet-300 mb-4">
            <span aria-hidden="true">👁️</span>
            <span>{lang === "fr" ? "Nouveau · Phase 2" : "New · Phase 2"}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-text-primary mb-4 leading-tight">
            {lang === "fr" ? tagline.fr : tagline.en}
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-3xl mx-auto leading-relaxed">
            {lang === "fr" ? subtitle.fr : subtitle.en}
          </p>
        </motion.div>

        {/* Mockup grid : 3 frames + JSON overlay */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Frames column (3 cards mock) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.6, ease, delay: 0.15 }}
            className="lg:col-span-3 space-y-4"
            aria-label={lang === "fr" ? "Frames extraites" : "Extracted frames"}
          >
            {MOCKUP_MOMENTS.map((moment, idx) => (
              <div
                key={moment.ts}
                className="relative flex gap-4 items-start p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl"
              >
                {/* Frame placeholder — gradient simulant un thumbnail YouTube */}
                <div
                  className="flex-shrink-0 w-32 h-20 sm:w-40 sm:h-24 rounded-lg bg-gradient-to-br relative overflow-hidden border border-white/10"
                  style={{
                    background:
                      idx === 0
                        ? "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)"
                        : idx === 1
                          ? "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)"
                          : "linear-gradient(135deg, #8b5cf6 0%, #f59e0b 100%)",
                  }}
                  aria-hidden="true"
                >
                  <div className="absolute inset-0 bg-black/20" />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/70 text-white">
                    {moment.ts}
                  </span>
                </div>
                {/* Description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 uppercase tracking-wider">
                      {moment.type}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-snug">
                    {lang === "fr" ? moment.description.fr : moment.description.en}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* JSON overlay column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ duration: 0.6, ease, delay: 0.3 }}
            className="lg:col-span-2"
            aria-label={lang === "fr" ? "Sortie JSON" : "JSON output"}
          >
            <div className="rounded-xl border border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl overflow-hidden h-full">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-text-secondary font-mono ml-2">
                  visual_analysis.json
                </span>
              </div>
              <pre className="px-4 py-4 text-[11px] sm:text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed">
                <code>
                  <span className="text-violet-300">{`{`}</span>
                  {`\n  `}
                  <span className="text-cyan-300">{`"visual_hook"`}</span>
                  <span className="text-text-secondary">{`: `}</span>
                  <span className="text-emerald-300">
                    {lang === "fr"
                      ? `"Plan choc fond vif, attention immédiate"`
                      : `"Punchy close-up, immediate attention grab"`}
                  </span>
                  <span className="text-text-secondary">{`,`}</span>
                  {`\n  `}
                  <span className="text-cyan-300">{`"visual_structure"`}</span>
                  <span className="text-text-secondary">{`: `}</span>
                  <span className="text-emerald-300">{`"talking_head"`}</span>
                  <span className="text-text-secondary">{`,`}</span>
                  {`\n  `}
                  <span className="text-cyan-300">{`"key_moments"`}</span>
                  <span className="text-text-secondary">{`: [`}</span>
                  {`\n    `}
                  <span className="text-text-secondary">{`{ `}</span>
                  <span className="text-cyan-300">{`"t"`}</span>
                  <span className="text-text-secondary">{`: `}</span>
                  <span className="text-amber-300">{`3.2`}</span>
                  <span className="text-text-secondary">{`, `}</span>
                  <span className="text-cyan-300">{`"type"`}</span>
                  <span className="text-text-secondary">{`: `}</span>
                  <span className="text-emerald-300">{`"hook"`}</span>
                  <span className="text-text-secondary">{` },`}</span>
                  {`\n    `}
                  <span className="text-text-secondary">{`{ `}</span>
                  <span className="text-cyan-300">{`"t"`}</span>
                  <span className="text-text-secondary">{`: `}</span>
                  <span className="text-amber-300">{`102.0`}</span>
                  <span className="text-text-secondary">{`, `}</span>
                  <span className="text-cyan-300">{`"type"`}</span>
                  <span className="text-text-secondary">{`: `}</span>
                  <span className="text-emerald-300">{`"reveal"`}</span>
                  <span className="text-text-secondary">{` }`}</span>
                  {`\n  `}
                  <span className="text-text-secondary">{`],`}</span>
                  {`\n  `}
                  <span className="text-cyan-300">{`"visible_text"`}</span>
                  <span className="text-text-secondary">{`: `}</span>
                  <span className="text-emerald-300">{`"ATTENTION"`}</span>
                  {`\n`}
                  <span className="text-violet-300">{`}`}</span>
                </code>
              </pre>
            </div>
          </motion.div>
        </div>

        {/* Badges row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease, delay: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          {badges.map((badge) => (
            <div
              key={badge.icon}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl text-xs sm:text-sm text-text-secondary"
            >
              <span aria-hidden="true">{badge.icon}</span>
              <span>{lang === "fr" ? badge.label.fr : badge.label.en}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
