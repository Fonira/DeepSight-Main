/**
 * SocialProofCounter — 3 compteurs en bandeau (vidéos analysées, mots synthétisés, utilisateurs actifs 30j).
 *
 * Fetch via landingApi.getStats() ; skeleton pendant chargement ;
 * en cas d'erreur réseau, le composant s'efface silencieusement (pas d'UI d'erreur sur la home).
 */

import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Video, FileText, Users } from "lucide-react";
import { landingApi, type LandingStatsResponse } from "../../services/api";

const ease = [0.4, 0, 0.2, 1] as const;

export interface SocialProofCounterProps {
  language: "fr" | "en" | string;
}

type FetchState =
  | { status: "loading" }
  | { status: "success"; stats: LandingStatsResponse }
  | { status: "error" };

function formatNumber(value: number, lang: "fr" | "en"): string {
  return value.toLocaleString(lang === "fr" ? "fr-FR" : "en-US");
}

interface CountUpProps {
  value: number;
  lang: "fr" | "en";
  testId: string;
}

function CountUp({ value, lang, testId }: CountUpProps) {
  const motionValue = useMotionValue(0);
  // Stiffness/damping élevés pour converger en quelques frames (utile en test).
  const spring = useSpring(motionValue, {
    stiffness: 220,
    damping: 35,
    mass: 1,
  });
  const display = useTransform(spring, (latest) =>
    formatNumber(Math.round(latest), lang),
  );
  const [text, setText] = useState(formatNumber(value, lang));

  useEffect(() => {
    const unsubscribe = display.on("change", setText);
    motionValue.set(value);
    return () => unsubscribe();
  }, [value, motionValue, display]);

  return (
    <span data-testid={testId} className="tabular-nums">
      {text}
    </span>
  );
}

export default function SocialProofCounter({
  language,
}: SocialProofCounterProps) {
  const lang = language === "fr" ? "fr" : "en";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    landingApi
      .getStats()
      .then((stats) => {
        if (!cancelled) setState({ status: "success", stats });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Erreur réseau : on s'efface silencieusement (pas d'UI d'erreur sur la home)
  if (state.status === "error") {
    return null;
  }

  const cards = [
    {
      id: "videos",
      icon: Video,
      labelFr: "vidéos analysées",
      labelEn: "videos analyzed",
      value: state.status === "success" ? state.stats.total_videos_analyzed : 0,
    },
    {
      id: "words",
      icon: FileText,
      labelFr: "mots synthétisés",
      labelEn: "words synthesized",
      value:
        state.status === "success" ? state.stats.total_words_synthesized : 0,
    },
    {
      id: "users",
      icon: Users,
      labelFr: "utilisateurs actifs (30 j)",
      labelEn: "active users (30 d)",
      value: state.status === "success" ? state.stats.active_users_30d : 0,
    },
  ];

  return (
    <section
      className="py-8 sm:py-12 px-4 sm:px-6"
      ref={ref}
      aria-labelledby="social-proof-heading"
    >
      <div className="max-w-5xl mx-auto">
        <h2 id="social-proof-heading" className="sr-only">
          {lang === "fr" ? "Statistiques DeepSight" : "DeepSight statistics"}
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"
        >
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                  <Icon
                    className="w-5 h-5 text-accent-primary"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {state.status === "loading" ? (
                    <div
                      data-testid="social-proof-skeleton"
                      className="h-7 w-28 rounded bg-white/10 animate-pulse mb-1.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <div className="text-2xl font-bold text-text-primary">
                      <CountUp
                        value={c.value}
                        lang={lang}
                        testId={`counter-${c.id}`}
                      />
                    </div>
                  )}
                  <div className="text-xs text-text-tertiary">
                    {lang === "fr" ? c.labelFr : c.labelEn}
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
