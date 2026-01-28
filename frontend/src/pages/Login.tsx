/**
 * DEEP SIGHT v5.1 — Login Page
 * Authentification sobre et professionnelle
 * ✅ Utilise le système i18n centralisé
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import DoodleBackground from '../components/DoodleBackground';
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

// === Logo ===
const Logo: React.FC = () => (
  <div className="flex items-center gap-3">
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent-primary to-purple-500 opacity-20" />
      <div className="absolute inset-[3px] rounded-lg bg-bg-primary flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </div>
    </div>
    <span className="font-display text-xl font-semibold tracking-tight text-text-primary">Deep Sight</span>
  </div>
);

// === Google Icon ===
const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle, register, verifyEmail, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, language } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

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

  // Lire les erreurs OAuth depuis les paramètres URL (redirect du backend)
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      const errorMessages: Record<string, string> = {
        access_denied: language === 'fr'
          ? 'Accès refusé. Veuillez autoriser l\'application.'
          : 'Access denied. Please authorize the application.',
        token_exchange_failed: language === 'fr'
          ? 'Échec de l\'authentification Google. Veuillez réessayer.'
          : 'Google authentication failed. Please try again.',
        userinfo_failed: language === 'fr'
          ? 'Impossible de récupérer vos informations Google.'
          : 'Could not retrieve your Google information.',
        auth_failed: language === 'fr'
          ? 'Échec de la connexion. Veuillez réessayer.'
          : 'Login failed. Please try again.',
        no_code: language === 'fr'
          ? 'Paramètres d\'authentification manquants.'
          : 'Missing authentication parameters.',
      };
      setError(errorMessages[oauthError] || (language === 'fr'
        ? `Erreur d'authentification: ${oauthError}`
        : `Authentication error: ${oauthError}`));
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams, language]);

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
      setError(language === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const username = email.split('@')[0];
        await register(username, email, password);
        setVerificationEmail(email);
        setShowVerification(true);
        setSuccess(language === 'fr' 
          ? 'Code envoyé ! Vérifiez votre email (pensez aux spams).' 
          : 'Code sent! Check your email (including spam folder).');
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      let errorMessage = t.errors.generic;
      
      if (err?.message && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err?.detail && typeof err.detail === 'string') {
        errorMessage = err.detail;
      } else if (err?.detail && Array.isArray(err.detail)) {
        errorMessage = err.detail.map((e: any) => e.msg || e.message || String(e)).join(', ');
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!verificationCode || verificationCode.length !== 6) {
      setError(language === 'fr' ? 'Veuillez entrer le code à 6 chiffres' : 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);

    try {
      await verifyEmail(verificationEmail, verificationCode);
      setSuccess(language === 'fr' 
        ? 'Email vérifié ! Vous pouvez maintenant vous connecter.' 
        : 'Email verified! You can now sign in.');
      setShowVerification(false);
      setIsRegister(false);
      setVerificationCode('');
    } catch (err: any) {
      let errorMessage = language === 'fr' ? 'Code invalide ou expiré' : 'Invalid or expired code';
      
      if (err?.message && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err?.detail && typeof err.detail === 'string') {
        errorMessage = err.detail;
      }
      
      setError(errorMessage);
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
      <div className="min-h-screen bg-bg-primary flex items-center justify-center relative">
        <DoodleBackground variant="default" density={50} />
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin relative z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex relative">
      <DoodleBackground variant="default" density={50} />
      
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 bg-bg-secondary border-r border-border-subtle flex-col justify-between p-12 relative z-10">
        <div>
          <Logo />
        </div>
        
        <div className="space-y-6">
          <h1 className="font-display text-display-sm">
            {t.landing.hero.title} <span className="text-accent-primary">{t.landing.hero.titleHighlight}</span>
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed">
            {t.auth.subtitle}
          </p>
        </div>

        <div className="text-text-muted text-sm">
          {t.footer.copyright}
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Logo />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl mb-2">
              {isRegister ? t.auth.createAccount : t.auth.welcomeBack}
            </h2>
            <p className="text-text-secondary">
              {isRegister 
                ? (language === 'fr' ? 'Créez votre compte Deep Sight' : 'Create your Deep Sight account')
                : (language === 'fr' ? 'Connectez-vous à votre compte' : 'Sign in to your account')}
            </p>
          </div>

          {/* Google Auth */}
          {!showVerification && (
          <>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full btn btn-secondary py-3 text-base flex items-center justify-center gap-3 mb-6"
          >
            <GoogleIcon className="w-5 h-5" />
            {t.auth.loginWithGoogle}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-primary px-4 text-sm text-text-muted">
                {language === 'fr' ? 'ou par email' : 'or with email'}
              </span>
            </div>
          </div>
          </>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="p-4 rounded-xl bg-error-muted border border-error/20 flex items-start gap-3 mb-6 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-text-primary">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-accent-success-muted border border-accent-success/20 mb-6 animate-fadeIn">
              <p className="text-sm text-text-primary">{success}</p>
            </div>
          )}

          {/* Verification Form */}
          {showVerification ? (
            <div className="space-y-6">
              <div className="text-center p-6 bg-bg-secondary rounded-xl border border-border-subtle">
                <div className="text-4xl mb-4">📧</div>
                <h3 className="font-semibold text-lg mb-2">
                  {language === 'fr' ? 'Vérifiez votre email' : 'Check your email'}
                </h3>
                <p className="text-text-secondary text-sm mb-4">
                  {language === 'fr' 
                    ? `Un code à 6 chiffres a été envoyé à ${verificationEmail}`
                    : `A 6-digit code has been sent to ${verificationEmail}`}
                </p>
                <p className="text-text-muted text-xs">
                  {language === 'fr' ? '(Vérifiez vos spams si nécessaire)' : '(Check your spam folder if needed)'}
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {language === 'fr' ? 'Code de vérification' : 'Verification code'}
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="input text-center text-2xl tracking-[0.5em] font-mono"
                    disabled={loading}
                    autoFocus
                    maxLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full btn btn-accent py-3 text-base"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    t.common.confirm
                  )}
                </button>
              </form>

              <button
                onClick={() => {
                  setShowVerification(false);
                  setVerificationCode('');
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full text-center text-sm text-text-tertiary hover:text-text-primary transition-colors"
              >
                ← {t.common.back}
              </button>
            </div>
          ) : (
          /* Login/Register Form */
          <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t.auth.email}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="input pl-12"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t.auth.password}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-12 pr-12"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-12"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-accent py-3 text-base"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRegister ? (
                t.auth.createAccount
              ) : (
                t.auth.signIn
              )}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-text-tertiary mt-6">
            {isRegister ? (
              <>
                {t.auth.hasAccount}{' '}
                <button
                  onClick={() => { setIsRegister(false); setError(null); }}
                  className="text-accent-primary hover:text-accent-primary-hover font-medium"
                >
                  {t.auth.signIn}
                </button>
              </>
            ) : (
              <>
                {t.auth.noAccount}{' '}
                <button
                  onClick={() => { setIsRegister(true); setError(null); }}
                  className="text-accent-primary hover:text-accent-primary-hover font-medium"
                >
                  {t.auth.createAccount}
                </button>
              </>
            )}
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
