/**
 * DemoCTA — Call-to-action apres epuisement de la demo (analyses ou chat).
 */

import { motion } from "framer-motion";

interface DemoCTAProps {
  type: "analyses" | "chat" | "both";
}

export default function DemoCTA({ type }: DemoCTAProps) {
  const getMessage = () => {
    switch (type) {
      case "analyses":
        return "Vous avez utilise vos 3 analyses gratuites";
      case "chat":
        return "Vous avez utilise vos 3 questions demo";
      case "both":
      default:
        return "Votre demo est terminee";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl mx-auto mt-6"
    >
      <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-indigo-500/50 via-violet-500/50 to-cyan-500/50">
        <div className="relative bg-[#0c0c14] rounded-2xl p-6 text-center">
          {/* Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 rounded-2xl pointer-events-none" />

          <div className="relative">
            {/* Lock icon */}
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>

            <p className="text-white/50 text-sm mb-1">{getMessage()}</p>
            <h3 className="text-white font-semibold text-lg mb-2">
              Passez a l'experience complete
            </h3>
            <p className="text-white/40 text-xs mb-5 max-w-sm mx-auto">
              Analyses completes, chat IA illimite, flashcards, mind maps et
              plus encore. Gratuit pour commencer.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-500
                           hover:from-indigo-400 hover:to-violet-400 text-white font-medium rounded-xl
                           transition-all duration-200 shadow-lg shadow-indigo-500/25 text-sm"
              >
                Creer un compte gratuit
                <svg
                  className="w-4 h-4"
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
              </a>
              <a
                href="/login"
                className="text-white/40 hover:text-white/60 text-sm transition-colors duration-200"
              >
                Deja un compte ? Se connecter
              </a>
            </div>

            {/* Features list */}
            <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap justify-center gap-4 text-[11px] text-white/30">
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3 text-green-400/60"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                5 analyses gratuites/mois
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3 text-green-400/60"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Chat IA contextuel
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3 text-green-400/60"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Flashcards & Quiz
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3 text-green-400/60"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                IA 100% francaise
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
