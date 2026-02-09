/**
 * DEEP SIGHT v8.0 — Premium Login Page
 * Minimalist split-screen auth with gradient mesh background
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

import { Mail, Lock, AlertCircle, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';

// === Google Icon ===
const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// === Logo ===
const Logo: React.FC = () => (
  <div className="flex items-center gap-2.5">
    <div className="relative w-9 h-9 rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent-primary to-accent-violet opacity-15 rounded-xl" />
      <div className="absolute inset-[2px] rounded-[10px] bg-bg-primary flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-accent-primary" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </div>
    </div>
    <span className="font-semibold text-base tracking-tight text-text-primary">Deep Sight</span>
  </div>
);

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle, register, verifyEmail, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, language } = useTranslation();


  const [isRegister, setIsRegister] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // OAuth error from URL
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      const errorMessages: Record<string, string> = {
        database_error: language === 'fr' ? 'Service temporairement indisponible.' : 'Service temporarily unavailable.',
        access_denied: language === 'fr' ? 'Accès refusé.' : 'Access denied.',
        token_exchange_failed: language === 'fr' ? 'Échec de l\'authentification Google.' : 'Google authentication failed.',
        userinfo_failed: language === 'fr' ? 'Impossible de récupérer vos informations.' : 'Could not retrieve your info.',
        auth_failed: language === 'fr' ? 'Échec de la connexion.' : 'Login failed.',
        no_code: language === 'fr' ? 'Paramètres manquants.' : 'Missing parameters.',
      };
      setError(errorMessages[oauthError] || `Error: ${oauthError}`);
      navigate(location.pathname, { replace: true });
    }
  }, [searchParams, language, navigate, location.pathname]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError(language === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill all fields');
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError(language === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match');
      return;
    }
    if (isRegister && password.length < 6) {
      setError(language === 'fr' ? 'Minimum 6 caractères' : 'Minimum 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(email.split('@')[0], email, password);
        setVerificationEmail(email);
        setShowVerification(true);
        setSuccess(language === 'fr' ? 'Code envoyé ! Vérifiez votre email.' : 'Code sent! Check your email.');
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err?.message || err?.detail || t.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!verificationCode || verificationCode.length !== 6) {
      setError(language === 'fr' ? 'Code à 6 chiffres requis' : '6-digit code required');
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(verificationEmail, verificationCode);
      setSuccess(language === 'fr' ? 'Email vérifié ! Connectez-vous.' : 'Email verified! Sign in now.');
      setShowVerification(false);
      setIsRegister(false);
      setVerificationCode('');
    } catch (err: any) {
      setError(err?.message || (language === 'fr' ? 'Code invalide' : 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || t.errors.generic);
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Left Panel — Branding (desktop) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        {/* Gradient mesh background */}
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
              {t.landing.hero.title}{' '}
              <span className="text-gradient">{t.landing.hero.titleHighlight}</span>
            </h1>
            <p className="text-text-secondary text-body-lg leading-relaxed max-w-md">
              {t.auth.subtitle}
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              {['AI Analysis', 'Fact-checking', 'Study Tools', 'Contextual Chat'].map((feat) => (
                <span
                  key={feat}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-bg-tertiary/60 text-text-secondary border border-border-subtle backdrop-blur-sm"
                >
                  {feat}
                </span>
              ))}
            </div>
          </motion.div>

          <p className="text-text-muted text-xs">{t.footer.copyright}</p>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[380px]"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo />
          </div>

          {/* Title */}
          <div className="text-center mb-7">
            <h2 className="text-xl font-bold tracking-tight mb-1.5">
              {isRegister ? t.auth.createAccount : t.auth.welcomeBack}
            </h2>
            <p className="text-text-tertiary text-sm">
              {isRegister
                ? (language === 'fr' ? 'Créez votre compte' : 'Create your account')
                : (language === 'fr' ? 'Connectez-vous' : 'Sign in to continue')}
            </p>
          </div>

          {/* Google OAuth */}
          {!showVerification && (
            <>
              <motion.button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-md border border-border-default bg-bg-secondary text-text-primary text-sm font-medium hover:bg-bg-hover hover:border-border-strong transition-all disabled:opacity-40"
                whileTap={{ scale: 0.98 }}
              >
                <GoogleIcon className="w-4.5 h-4.5" />
                {t.auth.loginWithGoogle}
              </motion.button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-subtle" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-bg-primary px-3 text-xs text-text-muted">
                    {language === 'fr' ? 'ou' : 'or'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Error / Success */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="p-3 rounded-md bg-error-muted border border-error/20 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-primary">{error}</p>
                </div>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="p-3 rounded-md bg-accent-success-muted border border-accent-success/20">
                  <p className="text-sm text-text-primary">{success}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Verification Form */}
          <AnimatePresence mode="wait">
            {showVerification ? (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center p-5 bg-bg-secondary rounded-lg border border-border-subtle">
                  <div className="w-10 h-10 rounded-full bg-accent-primary-muted flex items-center justify-center mx-auto mb-3">
                    <Mail className="w-5 h-5 text-accent-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">
                    {language === 'fr' ? 'Vérifiez votre email' : 'Check your email'}
                  </h3>
                  <p className="text-text-tertiary text-xs">
                    {language === 'fr' ? `Code envoyé à ${verificationEmail}` : `Code sent to ${verificationEmail}`}
                  </p>
                </div>

                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="input text-center text-lg tracking-[0.3em] font-mono"
                    disabled={loading}
                    autoFocus
                    maxLength={6}
                  />
                  <button
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="w-full btn btn-primary py-2.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.common.confirm}
                  </button>
                </form>

                <button
                  onClick={() => { setShowVerification(false); setVerificationCode(''); setError(null); setSuccess(null); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.common.back}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="auth"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.auth.email}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="input pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.auth.password}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input pl-10 pr-10"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password (register) */}
                  <AnimatePresence>
                    {isRegister && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                          {language === 'fr' ? 'Confirmer' : 'Confirm password'}
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="input pl-10"
                            disabled={loading}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full btn btn-primary py-2.5 mt-1"
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isRegister ? (
                      t.auth.createAccount
                    ) : (
                      t.auth.signIn
                    )}
                  </motion.button>
                </form>

                {/* Toggle auth mode */}
                <p className="text-center text-xs text-text-tertiary mt-5">
                  {isRegister ? (
                    <>
                      {t.auth.hasAccount}{' '}
                      <button
                        onClick={() => { setIsRegister(false); setError(null); }}
                        className="text-accent-primary hover:text-accent-primary-hover font-medium transition-colors"
                      >
                        {t.auth.signIn}
                      </button>
                    </>
                  ) : (
                    <>
                      {t.auth.noAccount}{' '}
                      <button
                        onClick={() => { setIsRegister(true); setError(null); }}
                        className="text-accent-primary hover:text-accent-primary-hover font-medium transition-colors"
                      >
                        {t.auth.createAccount}
                      </button>
                    </>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
