import React, { useState, useEffect } from 'react';
import { 
  login, 
  logout, 
  getCurrentUser, 
  getHistory, 
  getStoredUser,
  User, 
  HistoryItem 
} from '../services/api';
import { isLoggedIn, getRecentAnalyses } from '../services/storage';

type View = 'loading' | 'login' | 'main' | 'history' | 'settings';

export const PopupApp: React.FC = () => {
  const [view, setView] = useState<View>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<Array<{
    videoId: string;
    summaryId: number;
    title: string;
    timestamp: number;
  }>>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        const storedUser = await getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          const recent = await getRecentAnalyses();
          setRecentAnalyses(recent);
          setView('main');
        } else {
          // Try to refresh user data
          const freshUser = await getCurrentUser();
          setUser(freshUser);
          const recent = await getRecentAnalyses();
          setRecentAnalyses(recent);
          setView('main');
        }
      } else {
        setView('login');
      }
    } catch {
      setView('login');
    }
  };

  const handleLogin = async (email: string, password: string) => {
    setError(null);
    try {
      const response = await login(email, password);
      setUser(response.user);
      setView('main');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setView('login');
  };

  const loadHistory = async () => {
    try {
      const response = await getHistory(1, 10);
      setHistory(response.items);
      setView('history');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="popup-container">
      {view === 'loading' && <LoadingView />}
      {view === 'login' && <LoginView onLogin={handleLogin} error={error} />}
      {view === 'main' && user && (
        <MainView 
          user={user} 
          recentAnalyses={recentAnalyses}
          onLogout={handleLogout}
          onShowHistory={loadHistory}
          onShowSettings={() => setView('settings')}
        />
      )}
      {view === 'history' && (
        <HistoryView 
          items={history} 
          onBack={() => setView('main')} 
        />
      )}
      {view === 'settings' && (
        <SettingsView onBack={() => setView('main')} />
      )}
    </div>
  );
};

// Loading View
const LoadingView: React.FC = () => (
  <div className="view loading-view">
    <div className="spinner" />
    <p>Loading...</p>
  </div>
);

// Login View
interface LoginViewProps {
  onLogin: (email: string, password: string) => void;
  error: string | null;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onLogin(email, password);
    setIsLoading(false);
  };

  return (
    <div className="view login-view">
      <div className="logo">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <h1>DeepSight</h1>
      </div>
      
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
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      
      <div className="login-footer">
        <a href="https://deepsight.vercel.app/register" target="_blank" rel="noreferrer">
          Create account
        </a>
        <span>•</span>
        <a href="https://deepsight.vercel.app/forgot-password" target="_blank" rel="noreferrer">
          Forgot password?
        </a>
      </div>
      
      <button 
        className="btn-google"
        onClick={() => window.open('https://deepsight.vercel.app/login', '_blank')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
};

// Main View
interface MainViewProps {
  user: User;
  recentAnalyses: Array<{ videoId: string; summaryId: number; title: string; timestamp: number }>;
  onLogout: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
}

const MainView: React.FC<MainViewProps> = ({ 
  user, 
  recentAnalyses, 
  onLogout, 
  onShowHistory,
  onShowSettings 
}) => {
  const creditPercentage = user.credits_monthly > 0 
    ? Math.round((user.credits / user.credits_monthly) * 100)
    : 0;

  return (
    <div className="view main-view">
      <header>
        <div className="user-info">
          <div className="avatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} />
            ) : (
              <span>{user.username.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="user-details">
            <strong>{user.username}</strong>
            <span className="plan-badge">{user.plan}</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onShowSettings} title="Settings">
          ⚙️
        </button>
      </header>

      <div className="credits-card">
        <div className="credits-header">
          <span>Credits</span>
          <span className="credits-count">{user.credits} / {user.credits_monthly}</span>
        </div>
        <div className="credits-bar">
          <div className="credits-fill" style={{ width: `${creditPercentage}%` }} />
        </div>
      </div>

      <div className="quick-actions">
        <a 
          href="https://deepsight.vercel.app/analyze" 
          target="_blank" 
          rel="noreferrer"
          className="action-card"
        >
          <span className="action-icon">🎬</span>
          <span>Analyze Video</span>
        </a>
        <button onClick={onShowHistory} className="action-card">
          <span className="action-icon">📚</span>
          <span>History</span>
        </button>
      </div>

      {recentAnalyses.length > 0 && (
        <div className="recent-section">
          <h3>Recent Analyses</h3>
          <div className="recent-list">
            {recentAnalyses.slice(0, 3).map((item) => (
              <a
                key={item.summaryId}
                href={`https://deepsight.vercel.app/summary/${item.summaryId}`}
                target="_blank"
                rel="noreferrer"
                className="recent-item"
              >
                <img 
                  src={`https://img.youtube.com/vi/${item.videoId}/default.jpg`} 
                  alt="" 
                />
                <span className="recent-title">{item.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="popup-footer">
        <a href="https://deepsight.vercel.app" target="_blank" rel="noreferrer">
          Open DeepSight
        </a>
        <button onClick={onLogout} className="logout-btn">
          Sign out
        </button>
      </div>
    </div>
  );
};

// History View
interface HistoryViewProps {
  items: HistoryItem[];
  onBack: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ items, onBack }) => (
  <div className="view history-view">
    <header>
      <button onClick={onBack} className="back-btn">← Back</button>
      <h2>History</h2>
    </header>

    <div className="history-list">
      {items.length === 0 ? (
        <div className="empty-state">
          <span>📭</span>
          <p>No analyses yet</p>
        </div>
      ) : (
        items.map((item) => (
          <a
            key={item.id}
            href={`https://deepsight.vercel.app/summary/${item.id}`}
            target="_blank"
            rel="noreferrer"
            className="history-item"
          >
            <img src={item.thumbnail_url} alt="" />
            <div className="history-item-content">
              <strong>{item.video_title}</strong>
              <span>{item.video_channel}</span>
              <span className="category">{item.category}</span>
            </div>
          </a>
        ))
      )}
    </div>
  </div>
);

// Settings View
interface SettingsViewProps {
  onBack: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const [settings, setSettings] = useState({
    defaultMode: 'standard',
    defaultLang: 'fr',
    showNotifications: true,
  });

  useEffect(() => {
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        setSettings(result.settings);
      }
    });
  }, []);

  const updateSetting = <K extends keyof typeof settings>(
    key: K, 
    value: typeof settings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    chrome.storage.local.set({ settings: newSettings });
  };

  return (
    <div className="view settings-view">
      <header>
        <button onClick={onBack} className="back-btn">← Back</button>
        <h2>Settings</h2>
      </header>

      <div className="settings-list">
        <div className="setting-item">
          <label>Default Mode</label>
          <select 
            value={settings.defaultMode}
            onChange={(e) => updateSetting('defaultMode', e.target.value)}
          >
            <option value="accessible">📖 Accessible</option>
            <option value="standard">📋 Standard</option>
            <option value="expert">🎓 Expert</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Default Language</label>
          <select 
            value={settings.defaultLang}
            onChange={(e) => updateSetting('defaultLang', e.target.value)}
          >
            <option value="fr">🇫🇷 French</option>
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Spanish</option>
            <option value="de">🇩🇪 German</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Notifications</label>
          <input
            type="checkbox"
            checked={settings.showNotifications}
            onChange={(e) => updateSetting('showNotifications', e.target.checked)}
          />
        </div>
      </div>

      <div className="settings-footer">
        <a href="https://deepsight.vercel.app/settings" target="_blank" rel="noreferrer">
          More settings on DeepSight →
        </a>
      </div>
    </div>
  );
};
