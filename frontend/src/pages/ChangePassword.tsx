/**
 * DEEP SIGHT — Change Password Page
 * For authenticated users — change their existing password.
 */

import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import { SEO } from "../components/SEO";
import { DeepSightSpinnerMicro } from "../components/ui/DeepSightSpinner";
import { Toast } from "../components/Toast";
import api from "../services/api";

type PasswordStrength = "weak" | "medium" | "strong";

function evaluateStrength(password: string): PasswordStrength {
  if (password.length < 8) return "weak";
  let score = 0;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;
  if (score >= 4) return "strong";
  if (score >= 2) return "medium";
  return "weak";
}

export const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const strength = useMemo<PasswordStrength | null>(() => {
    if (!newPassword) return null;
    return evaluateStrength(newPassword);
  }, [newPassword]);

  // Auth gate
  if (!authLoading && !isAuthenticated) {
    navigate("/login", { replace: true });
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <motion.div
          className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError(t.auth.passwordFlow.change.errorCurrentRequired);
      return;
    }

    if (newPassword.length < 6) {
      setError(t.auth.passwordFlow.reset.errorMinLength);
      return;
    }

    if (newPassword === currentPassword) {
      setError(t.auth.passwordFlow.change.errorSameAsCurrent);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t.auth.passwordFlow.reset.errorMismatch);
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setToast({
        message: t.auth.passwordFlow.change.successToast,
        type: "success",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const error = err as {
        status?: number;
        message?: string;
        isRateLimited?: boolean;
      };
      if (error?.isRateLimited) {
        setError(
          language === "fr"
            ? "Trop de tentatives. Réessayez dans une minute."
            : "Too many attempts. Try again in a minute.",
        );
      } else {
        setError(error?.message || t.auth.passwordFlow.change.errorGeneric);
      }
    } finally {
      setLoading(false);
    }
  };

  const strengthLabel = strength ? t.auth.passwordFlow.strength[strength] : "";
  const strengthBarColor =
    strength === "strong"
      ? "bg-emerald-500"
      : strength === "medium"
        ? "bg-amber-500"
        : "bg-red-500";
  const strengthBarWidth =
    strength === "strong"
      ? "w-full"
      : strength === "medium"
        ? "w-2/3"
        : "w-1/3";

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 sm:p-8 relative">
      <SEO
        title={t.auth.passwordFlow.change.seoTitle}
        description={t.auth.passwordFlow.change.seoDescription}
        path="/change-password"
        noindex
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[420px]"
      >
        {/* Glassmorphism card */}
        <div className="rounded-lg backdrop-blur-xl bg-white/5 border border-white/10 p-6 sm:p-8 shadow-lg">
          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold tracking-tight mb-1.5">
              {t.auth.passwordFlow.change.title}
            </h2>
            <p className="text-text-tertiary text-sm">
              {t.auth.passwordFlow.change.subtitle}
            </p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
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
                  <p className="text-sm text-text-primary">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Current password */}
            <div>
              <label
                htmlFor="current-password"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                {t.auth.passwordFlow.change.currentPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                  aria-label={
                    showCurrent
                      ? language === "fr"
                        ? "Masquer le mot de passe"
                        : "Hide password"
                      : language === "fr"
                        ? "Afficher le mot de passe"
                        : "Show password"
                  }
                >
                  {showCurrent ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                {t.auth.passwordFlow.reset.newPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={6}
                  aria-describedby="new-password-strength"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                  aria-label={
                    showNew
                      ? language === "fr"
                        ? "Masquer le mot de passe"
                        : "Hide password"
                      : language === "fr"
                        ? "Afficher le mot de passe"
                        : "Show password"
                  }
                >
                  {showNew ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {strength && (
                <div
                  id="new-password-strength"
                  className="mt-2 flex items-center gap-2"
                  aria-live="polite"
                >
                  <div className="flex-1 h-1 rounded-full bg-border-subtle overflow-hidden">
                    <div
                      className={`h-full ${strengthBarColor} ${strengthBarWidth} transition-all duration-200`}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                {t.auth.passwordFlow.reset.confirmPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary py-2.5 mt-1"
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <DeepSightSpinnerMicro onLight />
              ) : (
                t.auth.passwordFlow.change.submitButton
              )}
            </motion.button>
          </form>

          <Link
            to="/account"
            className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.auth.passwordFlow.change.backToAccount}
          </Link>
        </div>
      </motion.div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default ChangePassword;
