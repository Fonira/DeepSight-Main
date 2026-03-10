import React, { useState } from 'react';
import { GoogleIcon } from './Icons';
import { useTranslation } from '../../i18n/useTranslation';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onGuestMode: () => void;
  error: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onGoogleLogin, onGuestMode, error }) => {
  const { t, language, setLanguage } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setLocalError(null);
    try {
      await onLogin(email, password);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(): Promise<void> {
    setGoogleLoading(true);
    setLocalError(null);
    try {
      await onGoogleLogin();
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="login-view">
      {/* Language toggle */}
      <div className="login-lang-toggle">
        <button
          className={`login-lang-btn ${language === 'fr' ? 'login-lang-active' : ''}`}
          onClick={() => setLanguage('fr')}
        >
          FR
        </button>
        <button
          className={`login-lang-btn ${language === 'en' ? 'login-lang-active' : ''}`}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
      </div>

      {/* Logo */}
      <div className="login-logo">
        <img
          src={chrome.runtime.getURL('assets/deepsight-logo-cosmic.png')}
          alt="DeepSight"
          className="login-logo-icon"
          width={56}
          height={56}
        />
        <h1>DeepSight</h1>
      </div>

      {/* Tagline — brand identity */}
      <p className="login-tagline">{t.login.tagline}</p>

      {/* Platform logos */}
      <div className="login-platforms">
        <img
          src={chrome.runtime.getURL('platforms/youtube-icon-red.png')}
          alt="YouTube"
          className="login-platform-logo"
          style={{ height: 20, width: 'auto' }}
        />
        <span className="login-platform-sep" />
        <img
          src={chrome.runtime.getURL('platforms/tiktok-note-white.png')}
          alt="TikTok"
          className="login-platform-logo"
          style={{ height: 18, width: 'auto' }}
        />
        <span className="login-platform-sep" />
        <img
          src={chrome.runtime.getURL('platforms/mistral-logo-white.png')}
          alt="Mistral AI"
          className="login-platform-logo login-platform-mistral"
          style={{ height: 15, width: 'auto', opacity: 0.7 }}
        />
      </div>

      {/* FR/EU trust badges */}
      <div className="login-badges">
        <span className="login-badge">
          <span className="login-badge-flag">{'\uD83C\uDDEB\uD83C\uDDF7'}</span> {t.login.badgeFr}
        </span>
        <span className="login-badge">
          <span className="login-badge-flag">{'\uD83C\uDDEA\uD83C\uDDFA'}</span> {t.login.badgeEu}
        </span>
      </div>

      {/* Google Login */}
      <button
        className="btn-google"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
      >
        {googleLoading ? t.login.googleLoading : <><GoogleIcon /> {t.login.googleButton}</>}
      </button>

      {/* Divider */}
      <div className="login-divider">{t.login.divider}</div>

      {/* Email/Password */}
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder={t.login.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <input
          type="password"
          placeholder={t.login.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        {displayError && <div className="login-error">{displayError}</div>}
        <button type="submit" className="btn-login" disabled={loading || !email || !password}>
          {loading ? t.login.loginLoading : t.common.login}
        </button>
      </form>

      {/* Guest mode */}
      <button className="btn-guest" onClick={onGuestMode}>
        {t.login.guestButton}
      </button>

      {/* Footer */}
      <div className="login-footer">
        <a href="https://www.deepsightsynthesis.com/register" target="_blank" rel="noreferrer">
          {t.common.createAccount}
        </a>
        <span>&middot;</span>
        <a href="https://www.deepsightsynthesis.com" target="_blank" rel="noreferrer">
          deepsightsynthesis.com
        </a>
      </div>

      {/* Legal links — Chrome Web Store requirement */}
      <div className="login-legal">
        <a href="https://www.deepsightsynthesis.com/legal/privacy" target="_blank" rel="noreferrer">
          {t.login.privacy}
        </a>
        <span>&middot;</span>
        <a href="https://www.deepsightsynthesis.com/legal/cgu" target="_blank" rel="noreferrer">
          {t.login.terms}
        </a>
      </div>
    </div>
  );
};
