/**
 * DEEP SIGHT — Forgot Password Page
 * Email input -> sends reset link via Resend.
 * Always shows success message (anti-enumeration), even if email doesn't exist.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";

import { useTranslation } from "../hooks/useTranslation";
import { SEO } from "../components/SEO";
import { DeepSightSpinnerMicro } from "../components/ui/DeepSightSpinner";
import api from "../services/api";

const Logo: React.FC = () => (
  <div className="flex items-center gap-2.5">
    <div className="relative w-10 h-10 rounded-full overflow-hidden">
      <img
        src="/deepsight-logo-cosmic.png"
        alt="Deep Sight"
        className="w-full h-full object-cover"
      />
    </div>
    <span className="font-semibold text-base tracking-tight text-text-primary">
      Deep Sight
    </span>
  </div>
);

export const ForgotPassword: React.FC = () => {
  const { t, language } = useTranslation();

  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setNetworkError(null);

    if (!email.trim()) {
      setNetworkError(
        language === "fr"
          ? "Veuillez saisir votre adresse email"
          : "Please enter your email address",
      );
      return;
    }

    setLoading(true);
    try {
      await api.auth.forgotPassword(email.trim());
      // Always success — anti-enumeration
      setSubmitted(true);
    } catch (err: unknown) {
      // Network/server failure: show real error so user can retry.
      // For 4xx (e.g. rate limit), still show generic success to avoid enumeration.
      const error = err as {
        status?: number;
        message?: string;
        isRateLimited?: boolean;
      };
      if (error?.status && error.status >= 500) {
        setNetworkError(
          language === "fr"
            ? "Erreur serveur. Veuillez réessayer."
            : "Server error. Please try again.",
        );
      } else if (error?.isRateLimited) {
        setNetworkError(
          language === "fr"
            ? "Trop de tentatives. Réessayez dans une minute."
            : "Too many attempts. Try again in a minute.",
        );
      } else if (error?.status === undefined) {
        // Network error (no response)
        setNetworkError(
          language === "fr"
            ? "Erreur réseau. Vérifiez votre connexion."
            : "Network error. Check your connection.",
        );
      } else {
        // 4xx (other than 429): still show success for anti-enumeration
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <SEO
        title={t.auth.passwordFlow.forgot.seoTitle}
        description={t.auth.passwordFlow.forgot.seoDescription}
        path="/forgot-password"
        noindex
      />

      {/* Left Panel — Branding (desktop) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh" />
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 60%)
            `,
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <Logo />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-5"
          >
            <h1 className="text-display-sm font-bold tracking-tight">
              {t.auth.passwordFlow.forgot.heroTitle}
            </h1>
            <p className="text-text-secondary text-body-lg leading-relaxed max-w-md">
              {t.auth.passwordFlow.forgot.heroSubtitle}
            </p>
          </motion.div>
          <p className="text-text-muted text-xs">{t.footer.copyright}</p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[380px]"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden mb-4 flex justify-center">
            <Logo />
          </div>

          {/* Title */}
          <div className="text-center mb-7">
            <h2 className="text-xl font-bold tracking-tight mb-1.5">
              {t.auth.passwordFlow.forgot.title}
            </h2>
            <p className="text-text-tertiary text-sm">
              {t.auth.passwordFlow.forgot.subtitle}
            </p>
          </div>

          {/* Network error */}
          <AnimatePresence>
            {networkError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div
                  className="p-3 rounded-md bg-error-muted border border-error/20 flex items-start gap-2.5"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-primary">{networkError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div
                  className="text-center p-5 bg-bg-secondary rounded-lg border border-border-subtle"
                  role="status"
                  aria-live="polite"
                >
                  <div className="w-10 h-10 rounded-full bg-accent-success-muted flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-5 h-5 text-accent-success" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">
                    {t.auth.passwordFlow.forgot.successTitle}
                  </h3>
                  <p className="text-text-tertiary text-xs">
                    {t.auth.passwordFlow.forgot.successDescription}
                  </p>
                </div>

                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.auth.passwordFlow.forgot.backToLogin}
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="block text-xs font-medium text-text-secondary mb-1.5"
                    >
                      {t.auth.email}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="input pl-10"
                        disabled={loading}
                        autoFocus
                        autoComplete="email"
                        aria-describedby={
                          networkError ? "forgot-email-error" : undefined
                        }
                      />
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full btn btn-primary py-2.5 mt-1"
                    whileTap={{ scale: 0.98 }}
                    aria-label={t.auth.passwordFlow.forgot.submitButton}
                  >
                    {loading ? (
                      <DeepSightSpinnerMicro onLight />
                    ) : (
                      t.auth.passwordFlow.forgot.submitButton
                    )}
                  </motion.button>
                </form>

                <Link
                  to="/login"
                  className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.auth.passwordFlow.forgot.backToLogin}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;
