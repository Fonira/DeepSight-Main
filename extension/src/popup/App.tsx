import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { LoginView } from './components/LoginView';
import { MainView } from './components/MainView';

type ViewName = 'loading' | 'login' | 'main';

export const App: React.FC = () => {
  const [view, setView] = useState<ViewName>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function checkAuth(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'CHECK_AUTH' });
      if (response.authenticated && response.user) {
        setUser(response.user);
        setView('main');
      } else {
        setView('login');
      }
    } catch {
      setView('login');
    }
  }

  const handleLogin = useCallback(async (email: string, password: string): Promise<void> => {
    setError(null);
    const response = await chrome.runtime.sendMessage({
      action: 'LOGIN',
      data: { email, password },
    });

    if (response.success && response.user) {
      setUser(response.user);
      setView('main');
    } else {
      throw new Error(response.error || 'Login failed');
    }
  }, []);

  const handleGoogleLogin = useCallback(async (): Promise<void> => {
    setError(null);
    const response = await chrome.runtime.sendMessage({ action: 'GOOGLE_LOGIN' });

    if (response.success && response.user) {
      setUser(response.user);
      setView('main');
    } else {
      throw new Error(response.error || 'Google login failed');
    }
  }, []);

  const handleLogout = useCallback(async (): Promise<void> => {
    await chrome.runtime.sendMessage({ action: 'LOGOUT' });
    setUser(null);
    setView('login');
  }, []);

  const showError = useCallback((msg: string) => {
    setToast({ message: msg, type: 'error' });
  }, []);

  return (
    <div className="app-container">
      {/* Toast notification */}
      {toast && (
        <div
          className={`ds-toast ds-toast-${toast.type}`}
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}

      {view === 'loading' && (
        <div className="loading-view">
          <div className="loading-spinner" />
          <p className="loading-text">Loading...</p>
        </div>
      )}

      {view === 'login' && (
        <LoginView
          onLogin={handleLogin}
          onGoogleLogin={handleGoogleLogin}
          error={error}
        />
      )}

      {view === 'main' && user && (
        <MainView
          user={user}
          onLogout={handleLogout}
          onError={showError}
        />
      )}
    </div>
  );
};
