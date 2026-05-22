/**
 * 🔐 PasswordReauthModal — Auth V2 Wave 1 Step 1
 *
 * Modal réutilisable pour la re-authentification scopée avant action sensible
 * (billing, delete, change-email, change-password). Demande le mot de passe
 * utilisateur, appelle POST /api/auth/reauth, et resolve avec un
 * `reauth_token` à passer en header `X-Reauth-Token` sur l'endpoint cible.
 *
 * Réutilise les patterns Modal/Input/Button DeepSight (Framer Motion,
 * focus trap, Escape close, glassmorphism). Voir Modal.tsx pour réference.
 */

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, X, Eye, EyeOff } from "lucide-react";
import { authApi, ApiError } from "../../services/api";
import { useTranslation } from "../../hooks/useTranslation";
import type { ReauthAudience } from "../../types/auth";

interface PasswordReauthModalProps {
  open: boolean;
  audience: ReauthAudience;
  onSuccess: (reauthToken: string) => void;
  onCancel: () => void;
}

/**
 * Libellés FR/EN par audience pour expliciter pourquoi on redemande
 * le mot de passe (UX trust signal).
 */
const AUDIENCE_LABELS: Record<
  ReauthAudience,
  { fr: string; en: string }
> = {
  billing: {
    fr: "Pour modifier votre abonnement, confirmez votre mot de passe.",
    en: "To update your subscription, please confirm your password.",
  },
  delete: {
    fr: "Pour supprimer votre compte, confirmez votre mot de passe.",
    en: "To delete your account, please confirm your password.",
  },
  "change-email": {
    fr: "Pour changer votre email, confirmez votre mot de passe.",
    en: "To change your email, please confirm your password.",
  },
  "change-password": {
    fr: "Pour changer votre mot de passe, confirmez l'actuel.",
    en: "To change your password, please confirm the current one.",
  },
};

export const PasswordReauthModal: React.FC<PasswordReauthModalProps> = ({
  open,
  audience,
  onSuccess,
  onCancel,
}) => {
  const { language } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);

  // Reset state à chaque ouverture
  useEffect(() => {
    if (open) {
      setPassword("");
      setError(null);
      setLoading(false);
      setShowPassword(false);
      // Focus l'input après animation
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Body scroll lock + Escape handler
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.requestReauth(password, audience);
      onSuccess(res.reauth_token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(
          tr("Mot de passe incorrect", "Incorrect password"),
        );
      } else if (err instanceof ApiError && err.status === 429) {
        setError(
          tr(
            "Trop de tentatives. Réessayez plus tard.",
            "Too many attempts. Try again later.",
          ),
        );
      } else {
        setError(
          tr(
            "Erreur lors de la vérification. Réessayez.",
            "Verification failed. Please try again.",
          ),
        );
      }
      setLoading(false);
    }
  };

  if (!open) return null;

  const audienceLabel = AUDIENCE_LABELS[audience][language === "fr" ? "fr" : "en"];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4"
          role="presentation"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !loading && onCancel()}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            className="relative z-10 bg-bg-secondary border border-border-subtle w-full sm:w-auto sm:max-w-md sm:rounded-xl sm:max-h-[90vh] overflow-hidden flex flex-col focus:outline-none shadow-xl"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-subtle">
              <div className="flex items-center gap-3 pr-4">
                <div className="w-9 h-9 rounded-md bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                  <Lock
                    className="w-4 h-4 text-accent-primary"
                    aria-hidden="true"
                  />
                </div>
                <h2
                  id={titleId}
                  className="text-base sm:text-lg font-semibold text-text-primary"
                >
                  {tr(
                    "Confirmation requise",
                    "Confirmation required",
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !loading && onCancel()}
                disabled={loading}
                className="w-8 h-8 rounded-md bg-bg-tertiary text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all flex items-center justify-center flex-shrink-0 focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={tr("Annuler", "Cancel")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              <p id={descId} className="text-sm text-text-secondary">
                {audienceLabel}
              </p>

              <div className="space-y-1.5">
                <label
                  htmlFor="reauth-password"
                  className="block text-sm font-medium text-text-secondary"
                >
                  {tr("Mot de passe", "Password")}
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="reauth-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={!!error}
                    aria-describedby={error ? "reauth-error" : undefined}
                    className={`w-full py-2.5 px-3.5 pr-10 text-sm bg-bg-tertiary border rounded-md text-text-primary placeholder:text-text-muted transition-all duration-200 ease-out hover:border-border-strong focus:outline-none focus:ring-2 focus:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed ${
                      error
                        ? "border-error focus:border-error focus:ring-error/20"
                        : "border-border-default focus:border-accent-primary focus:ring-accent-primary-muted"
                    }`}
                    placeholder={tr(
                      "Votre mot de passe",
                      "Your password",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:ring-2 focus-visible:ring-accent-primary"
                    aria-label={
                      showPassword
                        ? tr("Cacher le mot de passe", "Hide password")
                        : tr("Afficher le mot de passe", "Show password")
                    }
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {error && (
                  <p
                    id="reauth-error"
                    className="text-xs text-error flex items-center gap-1.5 pt-1"
                    role="alert"
                    aria-live="polite"
                  >
                    <span className="w-1 h-1 rounded-full bg-error flex-shrink-0" />
                    {error}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  {tr("Annuler", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-accent-primary text-gray-900 hover:bg-accent-primary-hover transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  {loading
                    ? tr("Vérification…", "Verifying…")
                    : tr("Confirmer", "Confirm")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

PasswordReauthModal.displayName = "PasswordReauthModal";

export default PasswordReauthModal;
