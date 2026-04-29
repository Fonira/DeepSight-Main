import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  GraduationCap,
  BookOpen,
  Newspaper,
  Briefcase,
  Search,
} from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { authApi } from "../../services/api";
import { PersonaCard } from "./PersonaCard";

export type Persona =
  | "researcher"
  | "journalist"
  | "student"
  | "professional"
  | null;

export interface OnboardingFlowProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

/**
 * Onboarding modal 3 étapes : Welcome → Persona → First analysis.
 *
 * Mounted depuis `ProtectedLayout` quand `user.preferences.has_completed_onboarding !== true`.
 *
 * Persistance : `authApi.updatePreferences({ extra_preferences: { has_completed_onboarding, persona } })`.
 * Skip à n'importe quelle étape → set `has_completed_onboarding=true` avec `persona=null`
 * (ou la valeur sélectionnée si déjà choisie).
 */
export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [persona, setPersona] = useState<Persona>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finish = async (finalPersona: Persona = persona) => {
    setSubmitting(true);
    try {
      await authApi.updatePreferences({
        extra_preferences: {
          has_completed_onboarding: true,
          persona: finalPersona,
        },
      });
    } catch (err) {
      // Best-effort : on ferme quand même pour ne pas bloquer l'utilisateur
      // sur un échec réseau. Le flag sera retenté à la prochaine session.
      // eslint-disable-next-line no-console
      console.warn("[onboarding] persist failed", err);
    } finally {
      setSubmitting(false);
      onComplete();
    }
  };

  const personas: Array<{
    id: Exclude<Persona, null>;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
  }> = [
    {
      id: "researcher",
      icon: Search,
      label: t.onboarding.persona.researcher.label,
      description: t.onboarding.persona.researcher.description,
    },
    {
      id: "journalist",
      icon: Newspaper,
      label: t.onboarding.persona.journalist.label,
      description: t.onboarding.persona.journalist.description,
    },
    {
      id: "student",
      icon: GraduationCap,
      label: t.onboarding.persona.student.label,
      description: t.onboarding.persona.student.description,
    },
    {
      id: "professional",
      icon: Briefcase,
      label: t.onboarding.persona.professional.label,
      description: t.onboarding.persona.professional.description,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-lg mx-4 rounded-2xl bg-bg-secondary border border-white/10 backdrop-blur-xl p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs text-text-tertiary">{`${step} / 3`}</span>
          <button
            type="button"
            onClick={() => finish(step === 2 ? persona : null)}
            disabled={submitting}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {t.onboarding.skip}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-14 h-14 mb-5 rounded-2xl bg-accent-primary/15 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-accent-primary" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                {t.onboarding.welcome.title}
              </h2>
              <p className="text-sm text-text-tertiary mb-8">
                {t.onboarding.welcome.description}
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full px-4 py-3 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors"
              >
                {t.onboarding.welcome.cta}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="persona"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-bold text-text-primary mb-2">
                {t.onboarding.persona.title}
              </h2>
              <p className="text-sm text-text-tertiary mb-6">
                {t.onboarding.persona.description}
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {personas.map((p) => (
                  <PersonaCard
                    key={p.id}
                    icon={p.icon as never}
                    label={p.label}
                    description={p.description}
                    selected={persona === p.id}
                    onSelect={() => setPersona(p.id)}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg bg-white/[0.05] text-text-secondary text-sm font-medium hover:bg-white/[0.08] transition-colors"
                >
                  {t.onboarding.previous}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={persona === null}
                  className="flex-1 px-4 py-2 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.onboarding.next}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="first"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-14 h-14 mb-5 rounded-2xl bg-cyan-500/15 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                {t.onboarding.first_analysis.title}
              </h2>
              <p className="text-sm text-text-tertiary mb-4">
                {t.onboarding.first_analysis.description}
              </p>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={t.onboarding.first_analysis.placeholder}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-accent-primary/40"
              />
              <p className="text-xs text-text-tertiary mt-2 mb-6">
                {t.onboarding.first_analysis.tip}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (videoUrl.trim()) {
                      // Navigation déléguée : on stocke l'URL pour DashboardPage
                      try {
                        sessionStorage.setItem(
                          "ds-onboarding-video-url",
                          videoUrl.trim(),
                        );
                      } catch {
                        /* */
                      }
                    }
                    void finish();
                  }}
                  disabled={submitting}
                  className="w-full px-4 py-2 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors disabled:opacity-50"
                >
                  {t.onboarding.first_analysis.cta}
                </button>
                <button
                  type="button"
                  onClick={() => void finish()}
                  disabled={submitting}
                  className="w-full px-4 py-2 rounded-lg bg-white/[0.04] text-text-secondary text-sm hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                >
                  {t.onboarding.first_analysis.skip}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default OnboardingFlow;
