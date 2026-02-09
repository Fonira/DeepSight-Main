import React, { useState, useEffect, useCallback } from 'react';
import type { User, RecentAnalysis } from '../types';
import { LoginView } from './components/LoginView';
import { MainView } from './components/MainView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';

type ViewName = 'loading' | 'login' | 'main' | 'history' | 'settings';

export const App: React.FC = () => {
  const [view, setView] = useState<ViewName>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

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

  return (
    <div className="popup-container">
      {view === 'loading' && (
        <div className="view loading-view">
          <div className="spinner" />
          <p>Loading...</p>
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
