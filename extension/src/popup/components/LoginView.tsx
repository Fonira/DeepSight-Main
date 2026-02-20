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
      <p className="login-tagline">AI-Powered Video Analysis</p>

      {/* Google Login */}
      <button
        className="btn-google"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
      >
        {googleLoading ? 'Connecting...' : <><GoogleIcon /> Sign in with Google</>}
      </button>

      {/* Divider */}
      <div className="login-divider">or</div>

      {/* Email/Password */}
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        {displayError && <div className="login-error">{displayError}</div>}
        <button type="submit" className="btn-login" disabled={loading || !email || !password}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Guest mode */}
      <button className="btn-guest" onClick={onGuestMode}>
        Essayer sans compte (1 analyse gratuite)
      </button>

      {/* Footer */}
      <div className="login-footer">
        <a href="https://www.deepsightsynthesis.com/register" target="_blank" rel="noreferrer">
          Create account
        </a>
        <span>&middot;</span>
        <a href="https://www.deepsightsynthesis.com" target="_blank" rel="noreferrer">
          deepsightsynthesis.com
        </a>
      </div>
    </div>
  );
};
