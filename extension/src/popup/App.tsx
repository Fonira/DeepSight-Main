import React, { useState, useEffect, useCallback } from 'react';
import type { User, RecentAnalysis } from '../types';
import { LoginView } from './components/LoginView';
import { MainView } from './components/MainView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { DeepSightSpinner } from './components/DeepSightSpinner';

type ViewName = 'loading' | 'login' | 'main' | 'history' | 'settings';

export const App: React.FC = () => {
  const [view, setView] = useState<ViewName>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-dismiss toast after 3s
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
        loadRecentAnalyses();
      } else {
        setView('login');
      }
    } catch {
      /* auth check failed */
      setView('login');
    }
  }

  async function loadRecentAnalyses(): Promise<void> {
    const data = await chrome.storage.local.get(['recentAnalyses']);
    setRecentAnalyses(data.recentAnalyses || []);
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
      loadRecentAnalyses();
    } else {
      throw new Error(response.error || 'Login failed');
    }
  }, []);

  const handleLogout = useCallback(async (): Promise<void> => {
    await chrome.runtime.sendMessage({ action: 'LOGOUT' });
    setUser(null);
    setRecentAnalyses([]);
    setView('login');
  }, []);

  const showError = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  return (
    <div className="popup-container">
      {/* Toast notification */}
      {toast && (
        <div className="ds-toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      {view === 'loading' && (
        <div className="view loading-view">
          <DeepSightSpinner size="md" text="Loading..." />
        </div>
      )}

      {view === 'login' && (
        <LoginView onLogin={handleLogin} error={error} />
      )}

      {view === 'main' && user && (
        <MainView
          user={user}
          recentAnalyses={recentAnalyses}
          onLogout={handleLogout}
          onShowHistory={() => setView('history')}
          onShowSettings={() => setView('settings')}
          onError={showError}
        />
      )}

      {view === 'history' && (
        <HistoryView
          items={recentAnalyses}
          onBack={() => setView('main')}
        />
      )}

      {view === 'settings' && (
        <SettingsView onBack={() => setView('main')} />
      )}
    </div>
  );
};
