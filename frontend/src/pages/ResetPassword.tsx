/**
 * DEEP SIGHT — Reset Password Page
 * Reads ?code & ?email from URL (sent by Resend email).
 * User sets a new password (min 6 chars).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";

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

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useTranslation();

  const code = searchParams.get("code") ?? "";
  const email = searchParams.get("email") ?? "";
  const hasParams = !!code && !!email;

  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const strength = useMemo<PasswordStrength | null>(() => {
    if (!newPassword) return null;
    return evaluateStrength(newPassword);
  }, [newPassword]);

  // Redirect on success
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!hasParams) {
      setError(t.auth.passwordFlow.reset.missingParams);
      return;
    }

    if (newPassword.length < 6) {
      setError(t.auth.passwordFlow.reset.errorMinLength);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t.auth.passwordFlow.reset.errorMismatch);
      return;
    }

    setLoading(true);
    try {
      await api.auth.resetPassword(email, code, newPassword);
      setSuccess(true);
      setToast(t.auth.passwordFlow.reset.successToast);
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
        setError(error?.message || t.auth.passwordFlow.reset.errorInvalid);
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
    <div className="min-h-screen bg-bg-primary flex">
      <SEO
        title={t.auth.passwordFlow.reset.seoTitle}
        description={t.auth.passwordFlow.reset.seoDescription}
        path="/reset-password"
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
              {t.auth.passwordFlow.reset.heroTitle}
            </h1>
            <p className="text-text-secondary text-body-lg leading-relaxed max-w-md">
              {t.auth.passwordFlow.reset.heroSubtitle}
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
              {t.auth.passwordFlow.reset.title}
            </h2>
            <p className="text-text-tertiary text-sm">
              {hasParams
                ? t.auth.passwordFlow.reset.subtitle
                : t.auth.passwordFlow.reset.missingParams}
            </p>
          </div>

          {/* Missing params view */}
          {!hasParams && (
            <div
              className="p-4 rounded-md bg-error-muted border border-error/20 flex flex-col items-start gap-3"
              role="alert"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                <p className="text-sm text-text-primary">
                  {t.auth.passwordFlow.reset.missingParams}
                </p>
              </div>
              <Link
                to="/forgot-password"
                className="text-xs text-accent-primary hover:text-accent-primary-hover font-medium transition-colors"
              >
                {t.auth.passwordFlow.reset.requestNewLink}
              </Link>
            </div>
          )}

          {/* Error */}
          {hasParams && (
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4"
                >
                  <div
                    className="p-3 rounded-md bg-error-muted border border-error/20 flex flex-col gap-2"
                    role="alert"
                    aria-live="polite"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-text-primary">{error}</p>
                    </div>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-accent-primary hover:text-accent-primary-hover font-medium transition-colors ml-7"
                    >
                      {t.auth.passwordFlow.reset.requestNewLink}
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Success state */}
          {hasParams && success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4"
            >
              <div
                className="p-3 rounded-md bg-accent-success-muted border border-accent-success/20"
                role="status"
                aria-live="polite"
              >
                <p className="text-sm text-text-primary">
                  {t.auth.passwordFlow.reset.successDescription}
                </p>
              </div>
            </motion.div>
          )}

          {/* Form */}
          {hasParams && !success && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
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
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-10 pr-10"
                    disabled={loading}
                    autoFocus
                    autoComplete="new-password"
                    minLength={6}
                    aria-describedby="new-password-strength"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                    aria-label={
                      showPassword
                        ? language === "fr"
                          ? "Masquer le mot de passe"
                          : "Hide password"
                        : language === "fr"
                          ? "Afficher le mot de passe"
                          : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Strength meter */}
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
                  t.auth.passwordFlow.reset.submitButton
                )}
              </motion.button>
            </form>
          )}

          {/* Back to login */}
          <Link
            to="/login"
            className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.auth.passwordFlow.forgot.backToLogin}
          </Link>
        </motion.div>
      </div>

      {toast && (
        <Toast
          message={toast}
          type="success"
          duration={2000}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default ResetPassword;
