import React, { useState } from 'react';
import { GoogleIcon } from './Icons';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onGuestMode: () => void;
  error: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onGoogleLogin, onGuestMode, error }) => {
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
      <p className="login-tagline">Ne regardez plus vos vidéos. Analysez-les.</p>

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
          <span className="login-badge-flag">🇫🇷</span> IA Française
        </span>
        <span className="login-badge">
          <span className="login-badge-flag">🇪🇺</span> Données en Europe
        </span>
      </div>

      {/* Google Login */}
      <button
        className="btn-google"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
      >
        {googleLoading ? 'Connexion Google...' : <><GoogleIcon /> Continuer avec Google</>}
      </button>

      {/* Divider */}
      <div className="login-divider">ou</div>

      {/* Email/Password */}
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Adresse e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        {displayError && <div className="login-error">{displayError}</div>}
        <button type="submit" className="btn-login" disabled={loading || !email || !password}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      {/* Guest mode */}
      <button className="btn-guest" onClick={onGuestMode}>
        Essayer sans compte (1 analyse gratuite)
      </button>

      {/* Footer */}
      <div className="login-footer">
        <a href="https://www.deepsightsynthesis.com/register" target="_blank" rel="noreferrer">
          Créer un compte
        </a>
        <span>&middot;</span>
        <a href="https://www.deepsightsynthesis.com" target="_blank" rel="noreferrer">
          deepsightsynthesis.com
        </a>
      </div>

      {/* Legal links — Chrome Web Store requirement */}
      <div className="login-legal">
        <a href="https://www.deepsightsynthesis.com/legal/privacy" target="_blank" rel="noreferrer">
          Confidentialité
        </a>
        <span>&middot;</span>
        <a href="https://www.deepsightsynthesis.com/legal/cgu" target="_blank" rel="noreferrer">
          CGU
        </a>
      </div>
    </div>
  );
};
