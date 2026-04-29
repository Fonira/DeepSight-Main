/**
 * Testimonials — 3 cards témoignages chiffrés
 *
 * ⚠️ Les 3 témoignages seed sont fictifs (`isPlaceholder: true`).
 * En prod, le composant retourne null si toutes les entrées sont placeholder.
 * En dev/staging, un badge "Démo" rappelle leur statut fictif.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Quote, Star } from "lucide-react";

const ease = [0.4, 0, 0.2, 1] as const;

export interface TestimonialEntry {
  id: string;
  author: string;
  roleFr: string;
  roleEn: string;
  quoteFr: string;
  quoteEn: string;
  metricFr: string;
  metricEn: string;
  isPlaceholder: boolean;
}

const TESTIMONIALS: TestimonialEntry[] = [
  {
    id: "marie-l",
    author: "Dr. Marie L.",
    roleFr: "Chercheuse CNRS",
    roleEn: "CNRS Researcher",
    quoteFr:
      "J'analysais 2h de conférences en 30 min. Le fact-checking m'a fait gagner une demi-journée.",
    quoteEn:
      "I used to spend 2h on conference videos — now 30 min. Fact-checking saved me half a day.",
    metricFr: "2h → 30 min",
    metricEn: "2h → 30 min",
    isPlaceholder: true,
  },
  {
    id: "thomas-b",
    author: "Thomas B.",
    roleFr: "Journaliste, agence régionale",
    roleEn: "Journalist, regional agency",
    quoteFr:
      "Vérifier les affirmations des vidéos avec timecodes et sources ? Indispensable.",
    quoteEn:
      "Verifying video claims with timecodes and sources? Indispensable.",
    metricFr: "3 fact-checks/jour",
    metricEn: "3 fact-checks/day",
    isPlaceholder: true,
  },
  {
    id: "lea-k",
    author: "Léa K.",
    roleFr: "Étudiante Master Droit",
    roleEn: "Law Master's student",
    quoteFr: "Les flashcards FSRS me font réviser 3x plus efficacement.",
    quoteEn: "FSRS flashcards make me review 3x more efficiently.",
    metricFr: "+40 % rétention",
    metricEn: "+40 % retention",
    isPlaceholder: true,
  },
];

function getInitials(author: string): string {
  // "Dr. Marie L." -> "ML" ; "Thomas B." -> "TB" ; "Léa K." -> "LK"
  const honorifics = new Set([
    "dr",
    "dr.",
    "mr",
    "mr.",
    "mme",
    "mme.",
    "m.",
    "ms",
    "ms.",
  ]);
  const tokens = author
    .split(/\s+/)
    .map((t) => t.replace(/[.,]/g, ""))
    .filter((t) => t.length > 0 && !honorifics.has(t.toLowerCase()));
  return tokens
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? "")
    .join("");
}

export interface TestimonialsProps {
  language: "fr" | "en" | string;
}

export default function Testimonials({ language }: TestimonialsProps) {
  const lang = language === "fr" ? "fr" : "en";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  // Anti-prod garde-fou : si toutes les entrées sont placeholder ET on est en prod, ne rien rendre
  const allPlaceholder = TESTIMONIALS.every((t) => t.isPlaceholder);
  if (import.meta.env.PROD && allPlaceholder) {
    return null;
  }

  const showDemoBadge = import.meta.env.DEV && allPlaceholder;

  return (
    <section
      id="testimonials"
      className="py-16 sm:py-24 px-4 sm:px-6"
      ref={ref}
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-6xl mx-auto">
        {showDemoBadge && (
          <div className="flex justify-center mb-6">
            <div
              data-testid="testimonials-demo-badge"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold"
            >
              {lang === "fr"
                ? "⚠ Démo — témoignages fictifs (dev/staging)"
                : "⚠ Demo — fictional testimonials (dev/staging)"}
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2
            id="testimonials-heading"
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3"
          >
            {lang === "fr"
              ? "Ce que nos utilisateurs en disent"
              : "What our users say"}
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
            {lang === "fr"
              ? "Des chercheurs, journalistes et étudiants qui gagnent un temps précieux."
              : "Researchers, journalists and students saving precious time."}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: 0.4, ease, delay: 0.1 + i * 0.08 }}
              className="relative p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col"
            >
              <Quote
                className="w-6 h-6 text-accent-primary/40 mb-3"
                aria-hidden="true"
              />

              <div
                className="flex items-center gap-1 mb-3"
                aria-label={
                  lang === "fr" ? "5 étoiles sur 5" : "5 stars out of 5"
                }
              >
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star
                    key={s}
                    className="w-3.5 h-3.5 text-amber-400 fill-amber-400"
                    aria-hidden="true"
                  />
                ))}
              </div>

              <p className="text-sm text-text-secondary leading-relaxed mb-5 flex-1">
                « {lang === "fr" ? t.quoteFr : t.quoteEn} »
              </p>

              <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
                {lang === "fr" ? t.metricFr : t.metricEn}
              </div>

              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/5">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-sm font-semibold text-text-primary"
                  aria-label={
                    lang === "fr"
                      ? `Avatar de ${t.author}`
                      : `Avatar of ${t.author}`
                  }
                >
                  {getInitials(t.author)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">
                    {t.author}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {lang === "fr" ? t.roleFr : t.roleEn}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
