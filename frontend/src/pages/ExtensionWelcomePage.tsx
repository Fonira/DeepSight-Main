/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Extension Welcome Page — Post-install landing for Chrome   ║
 * ║  Route: /extension-welcome                                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { SEO } from "../components/SEO";
import DoodleBackground from "../components/DoodleBackground";
import { useAuth } from "../hooks/useAuth";

const STEPS = [
  {
    icon: "🎬",
    title: "Ouvrez une vidéo YouTube ou TikTok",
    desc: "Naviguez sur n'importe quelle vidéo YouTube ou TikTok. DeepSight apparaît automatiquement dans la barre latérale.",
  },
  {
    icon: "🚀",
    title: 'Cliquez "Analyser"',
    desc: "Notre IA analyse la transcription complète, identifie les arguments clés et évalue la fiabilité des sources.",
  },
  {
    icon: "💬",
    title: "Posez vos questions",
    desc: "Discutez avec l'IA directement depuis YouTube. Elle connaît toute la vidéo et peut chercher sur le web.",
  },
];

const FEATURES = [
  { icon: "🧠", label: "Synthèse sourcée & nuancée", plan: "Gratuit" },
  { icon: "🃏", label: "Flashcards IA", plan: "Starter" },
  { icon: "🌐", label: "Recherche web IA", plan: "Standard" },
  { icon: "📦", label: "Export PDF/DOCX", plan: "Pro" },
];

const ExtensionWelcomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Track extension install
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("source") !== "extension") {
        // Add source param for analytics
        const url = new URL(window.location.href);
        url.searchParams.set("source", "extension");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      // Ignore URL manipulation errors
    }
  }, []);

  return (
    <>
      <SEO
        title="Extension installée — DeepSight"
        description="Bienvenue ! L'extension Chrome DeepSight est installée. Découvrez comment analyser vos vidéos YouTube et TikTok avec l'IA."
        path="/extension-welcome"
      />

      <div className="min-h-screen bg-bg-primary relative overflow-hidden">
        <DoodleBackground variant="tech" />
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent-primary/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent-violet/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-16 sm:py-24">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 mb-8"
            >
              <span className="text-2xl">✅</span>
              <span className="text-accent-primary font-semibold text-base">
                Extension installée avec succès
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-3xl sm:text-5xl font-black text-text-primary mb-4 leading-tight"
            >
              Bienvenue sur{" "}
              <span className="bg-gradient-to-r from-accent-primary via-accent-violet to-accent-cyan bg-clip-text text-transparent">
                DeepSight
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-text-secondary text-lg sm:text-xl max-w-xl mx-auto"
            >
              Ne subissez plus vos vidéos —{" "}
              <strong className="text-text-primary">interrogez-les.</strong>
            </motion.p>
          </motion.div>

          {/* Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid gap-4 sm:grid-cols-3 mb-16"
          >
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="relative p-6 rounded-2xl bg-bg-secondary/80 border border-border-default backdrop-blur-sm hover:border-border-strong transition-colors"
              >
                <div className="absolute -top-3 -left-1 w-7 h-7 rounded-full bg-accent-primary text-gray-900 text-xs font-bold flex items-center justify-center shadow-lg shadow-accent-primary/30">
                  {i + 1}
                </div>
                <span className="text-3xl block mb-3">{step.icon}</span>
                <h3 className="text-text-primary font-bold text-base mb-1.5">
                  {step.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Features preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mb-16"
          >
            <h2 className="text-center text-text-secondary text-sm font-semibold uppercase tracking-widest mb-6">
              Fonctionnalités disponibles
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-secondary/50 border border-border-default"
                >
                  <span className="text-2xl">{f.icon}</span>
                  <span className="text-text-primary text-sm font-medium text-center">
                    {f.label}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-violet/80 bg-accent-violet/10 px-2 py-0.5 rounded-full">
                    {f.plan}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="text-center"
          >
            {user ? (
              <div className="space-y-4">
                <p className="text-text-secondary">
                  Vous êtes connecté en tant que{" "}
                  <strong className="text-text-primary">
                    {user.username || user.email}
                  </strong>
                  .
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="px-8 py-3.5 bg-accent-primary text-gray-900 rounded-xl font-semibold shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Aller au Dashboard
                  </button>
                  <a
                    href="https://www.youtube.com"
                    target="_blank"
                    rel="noreferrer"
                    className="px-8 py-3.5 bg-bg-secondary text-text-primary rounded-xl font-semibold border border-border-default hover:border-border-strong hover:bg-bg-tertiary transition-all duration-200"
                  >
                    Ouvrir YouTube →
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-text-secondary text-base">
                  Créez un compte gratuit pour commencer à analyser vos vidéos.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/login"
                    className="px-8 py-3.5 bg-accent-primary text-gray-900 rounded-xl font-semibold shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40 hover:-translate-y-0.5 transition-all duration-200 text-center"
                  >
                    Créer un compte gratuit
                  </Link>
                  <a
                    href="https://www.youtube.com"
                    target="_blank"
                    rel="noreferrer"
                    className="px-8 py-3.5 bg-bg-secondary text-text-primary rounded-xl font-semibold border border-border-default hover:border-border-strong hover:bg-bg-tertiary transition-all duration-200 text-center"
                  >
                    Essayer sur YouTube →
                  </a>
                </div>
              </div>
            )}
          </motion.div>

          {/* EU badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-16 flex justify-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-secondary/50 border border-border-default text-text-tertiary text-xs">
              <span>{"\uD83C\uDDEB\uD83C\uDDF7\uD83C\uDDEA\uD83C\uDDFA"}</span>
              <span>
                IA 100% Fran\u00e7aise & Europ\u00e9enne — propuls\u00e9 par
                Mistral AI
              </span>
              <span className="opacity-40">|</span>
              <img
                src="/platforms/tournesol-logo.png"
                alt="Tournesol"
                className="h-4 inline"
              />
              <span>Qualit\u00e9 Tournesol</span>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ExtensionWelcomePage;
