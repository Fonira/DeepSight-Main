import React, { useState, FormEvent } from 'react';
import { WEBAPP_URL } from '../../utils/config';
import { DeepSightLogo } from './DeepSightLogo';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, error: externalError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(externalError);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="view login-view">
      <div className="login-logo">
        <div className="logo-icon">
          <DeepSightLogo size="lg" />
        </div>
        <h1>DeepSight</h1>
      </div>
      <p className="login-tagline">AI-Powered Video Analysis</p>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="error">{error}</div>}

        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? (
            <>
              <svg className="ds-spinner-sm" viewBox="0 0 48 48" fill="none" style={{ width: 18, height: 18 }}>
                <defs>
                  <linearGradient id="login-sp" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
                  </linearGradient>
                </defs>
                <circle cx="24" cy="24" r="18" fill="none" stroke="url(#login-sp)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 40" />
              </svg>
              Signing in...
            </>
          ) : 'Sign In'}
        </button>
      </form>

      <div className="login-divider">or</div>

      <button
        className="btn-google"
        onClick={() => window.open(`${WEBAPP_URL}/login`, '_blank')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </button>

      <div className="login-footer">
        <a href={`${WEBAPP_URL}/register`} target="_blank" rel="noreferrer">
          Create account
        </a>
        <span>&bull;</span>
        <a href={`${WEBAPP_URL}/forgot-password`} target="_blank" rel="noreferrer">
          Forgot password?
        </a>
      </div>

      <div className="login-site-link">
        <a href={WEBAPP_URL} target="_blank" rel="noreferrer">
          deepsightsynthesis.com
        </a>
      </div>
    </div>
  );
};
