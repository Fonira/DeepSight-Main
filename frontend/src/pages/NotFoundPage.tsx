/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  404 Not Found Page — DeepSight Premium Design              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const NotFoundPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(15);

  // Auto-redirect après 15s
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/", { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent-violet/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="text-center max-w-lg relative z-10"
      >
        {/* 404 Number */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          className="mb-6"
        >
          <span className="text-[120px] sm:text-[160px] font-black leading-none bg-gradient-to-br from-accent-primary via-accent-violet to-accent-cyan bg-clip-text text-transparent select-none">
            404
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl sm:text-3xl font-bold text-text-primary mb-3"
        >
          Page introuvable
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-text-secondary mb-2 text-base sm:text-lg"
        >
          L'URL <code className="px-2 py-0.5 bg-bg-tertiary rounded text-text-primary text-sm font-mono">{location.pathname}</code> n'existe pas.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-text-tertiary text-sm mb-8"
        >
          Redirection automatique dans {countdown}s...
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-bg-secondary text-text-primary rounded-xl border border-border-default hover:bg-bg-tertiary hover:border-border-strong transition-all duration-200 font-medium"
          >
            Retour en arrière
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-accent-primary text-white rounded-xl hover:bg-accent-primary-hover shadow-lg shadow-accent-primary/20 transition-all duration-200 font-medium"
          >
            Aller au Dashboard
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
