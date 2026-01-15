/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT v5.5 — Settings Page                                              ║
 * ║  Paramètres de l'application: thème, langue, notifications, affichage         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { 
  Settings as SettingsIcon, Globe, Moon, Sun, Monitor, Bell, BellOff,
  Type, Palette, Volume2, VolumeX, Keyboard, Info, Check, RotateCcw,
  Sparkles, BookOpen
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 Component
// ═══════════════════════════════════════════════════════════════════════════════

export const Settings: React.FC = () => {
  const { language } = useTranslation();
  const { setLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Préférences locales (stockées dans localStorage)
  const [preferences, setPreferences] = useState(() => ({
    notifications: localStorage.getItem('deepsight_notifications') !== 'false',
    autoPlay: localStorage.getItem('deepsight_autoplay') !== 'false',
    defaultMode: localStorage.getItem('deepsight_default_mode') || 'standard',
    soundEffects: localStorage.getItem('deepsight_sounds') !== 'false',
    compactView: localStorage.getItem('deepsight_compact') === 'true',
    showTournesol: localStorage.getItem('deepsight_tournesol') !== 'false',
  }));

  // Saved state for feedback
  const [saved, setSaved] = useState<string | null>(null);
  
  // Helper pour les traductions inline
  const tr = useCallback((fr: string, en: string) => language === 'fr' ? fr : en, [language]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 💾 Save Preference
  // ─────────────────────────────────────────────────────────────────────────────
  
  const savePreference = (key: string, value: boolean | string) => {
    localStorage.setItem(`deepsight_${key}`, String(value));
    setPreferences(prev => ({ ...prev, [key]: value }));
    setSaved(key);
    setTimeout(() => setSaved(null), 1500);
  };

  const resetToDefaults = () => {
    const defaults = {
      notifications: true,
      autoPlay: true,
      defaultMode: 'standard',
      soundEffects: true,
      compactView: false,
      showTournesol: true,
    };
    Object.entries(defaults).forEach(([key, value]) => {
      localStorage.setItem(`deepsight_${key}`, String(value));
    });
    setPreferences(defaults);
    setSaved('all');
    setTimeout(() => setSaved(null), 1500);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🖼️ Render
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="default" density={50} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className={`transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}>
        <div className="min-h-screen p-6 lg:p-8">
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Header */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <header className="mb-8">
              <h1 className="font-display text-2xl mb-2 flex items-center gap-3">
                <SettingsIcon className="w-7 h-7 text-accent-primary" />
                {tr('Paramètres', 'Settings')}
              </h1>
              <p className="text-text-secondary text-sm">
                {tr("Personnalisez l'apparence et le comportement de Deep Sight.", 
                    'Customize the appearance and behavior of Deep Sight.')}
              </p>
            </header>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Appearance Section */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Palette className="w-5 h-5 text-accent-primary" />
                  {tr('Apparence', 'Appearance')}
                </h2>
              </div>
              <div className="panel-body space-y-5">
                
                {/* Theme Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isDark ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                    <div>
                      <p className="font-medium text-text-primary">{tr('Thème', 'Theme')}</p>
                      <p className="text-sm text-text-tertiary">
                        {isDark ? tr('Mode sombre activé', 'Dark mode enabled') : tr('Mode clair activé', 'Light mode enabled')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      isDark ? 'bg-indigo-600' : 'bg-amber-400'
                    }`}
                  >
                    <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      isDark ? 'left-7' : 'left-1'
                    }`}>
                      {isDark ? <Moon className="w-4 h-4 m-1 text-indigo-600" /> : <Sun className="w-4 h-4 m-1 text-amber-500" />}
                    </span>
                  </button>
                </div>

                {/* Language Selector */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Langue', 'Language')}</p>
                      <p className="text-sm text-text-tertiary">{tr("Langue de l'interface et des résumés", 'Interface and summaries language')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLanguage('fr')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        language === 'fr' 
                          ? 'bg-accent-primary text-white' 
                          : 'bg-bg-tertiary hover:bg-bg-hover text-text-secondary'
                      }`}
                    >
                      🇫🇷 FR
                    </button>
                    <button
                      onClick={() => setLanguage('en')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        language === 'en' 
                          ? 'bg-accent-primary text-white' 
                          : 'bg-bg-tertiary hover:bg-bg-hover text-text-secondary'
                      }`}
                    >
                      🇬🇧 EN
                    </button>
                  </div>
                </div>

                {/* Compact View */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Type className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Vue compacte', 'Compact view')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Réduire les espacements', 'Reduce spacing')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => savePreference('compactView', !preferences.compactView)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      preferences.compactView ? 'bg-accent-primary' : 'bg-bg-tertiary border border-border-default'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      preferences.compactView ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Analysis Preferences */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-primary" />
                  {tr('Analyse', 'Analysis')}
                </h2>
              </div>
              <div className="panel-body space-y-5">
                
                {/* Default Analysis Mode */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Mode par défaut', 'Default mode')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Mode de résumé préféré', 'Preferred summary mode')}</p>
                    </div>
                  </div>
                  <select
                    value={preferences.defaultMode}
                    onChange={(e) => savePreference('defaultMode', e.target.value)}
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm"
                  >
                    <option value="accessible">{tr('Express (30s)', 'Express (30s)')}</option>
                    <option value="standard">{tr('Standard (2-4 min)', 'Standard (2-4 min)')}</option>
                    <option value="expert">{tr('Approfondi (5-10 min)', 'Deep (5-10 min)')}</option>
                  </select>
                </div>

                {/* Auto-play videos */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Lecture automatique', 'Auto-play')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Lire les vidéos automatiquement', 'Play videos automatically')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => savePreference('autoPlay', !preferences.autoPlay)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      preferences.autoPlay ? 'bg-accent-primary' : 'bg-bg-tertiary border border-border-default'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      preferences.autoPlay ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {/* Show Tournesol scores */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Score Tournesol', 'Tournesol Score')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Afficher les scores éthiques', 'Show ethical scores')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => savePreference('showTournesol', !preferences.showTournesol)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      preferences.showTournesol ? 'bg-yellow-500' : 'bg-bg-tertiary border border-border-default'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      preferences.showTournesol ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Notifications & Sounds */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Bell className="w-5 h-5 text-accent-primary" />
                  {tr('Notifications', 'Notifications')}
                </h2>
              </div>
              <div className="panel-body space-y-5">
                
                {/* Browser Notifications */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {preferences.notifications ? <Bell className="w-5 h-5 text-text-tertiary" /> : <BellOff className="w-5 h-5 text-text-tertiary" />}
                    <div>
                      <p className="font-medium text-text-primary">{tr('Notifications navigateur', 'Browser notifications')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Alertes quand une analyse est prête', 'Alerts when analysis is ready')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => savePreference('notifications', !preferences.notifications)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      preferences.notifications ? 'bg-accent-primary' : 'bg-bg-tertiary border border-border-default'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      preferences.notifications ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {/* Sound Effects */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {preferences.soundEffects ? <Volume2 className="w-5 h-5 text-text-tertiary" /> : <VolumeX className="w-5 h-5 text-text-tertiary" />}
                    <div>
                      <p className="font-medium text-text-primary">{tr('Effets sonores', 'Sound effects')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Sons de notification', 'Notification sounds')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => savePreference('soundEffects', !preferences.soundEffects)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      preferences.soundEffects ? 'bg-accent-primary' : 'bg-bg-tertiary border border-border-default'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      preferences.soundEffects ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Keyboard Shortcuts Info */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-accent-primary" />
                  {tr('Raccourcis clavier', 'Keyboard Shortcuts')}
                </h2>
              </div>
              <div className="panel-body">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center justify-between p-2 rounded bg-bg-tertiary">
                    <span className="text-text-secondary">{tr('Nouvelle analyse', 'New analysis')}</span>
                    <kbd className="px-2 py-1 rounded bg-bg-primary border border-border-default text-xs">Ctrl+N</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-bg-tertiary">
                    <span className="text-text-secondary">{tr('Recherche', 'Search')}</span>
                    <kbd className="px-2 py-1 rounded bg-bg-primary border border-border-default text-xs">Ctrl+K</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-bg-tertiary">
                    <span className="text-text-secondary">{tr('Copier résumé', 'Copy summary')}</span>
                    <kbd className="px-2 py-1 rounded bg-bg-primary border border-border-default text-xs">Ctrl+C</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-bg-tertiary">
                    <span className="text-text-secondary">{tr('Exporter', 'Export')}</span>
                    <kbd className="px-2 py-1 rounded bg-bg-primary border border-border-default text-xs">Ctrl+E</kbd>
                  </div>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Reset to Defaults */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card border-border-subtle">
              <div className="panel-body">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RotateCcw className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Réinitialiser', 'Reset to defaults')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Restaurer les paramètres par défaut', 'Restore default settings')}</p>
                    </div>
                  </div>
                  <button
                    onClick={resetToDefaults}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-tertiary border border-border-default hover:bg-bg-hover transition-colors text-sm"
                  >
                    {saved === 'all' ? <Check className="w-4 h-4 text-success" /> : <RotateCcw className="w-4 h-4" />}
                    {saved === 'all' ? tr('Réinitialisé !', 'Reset!') : tr('Réinitialiser', 'Reset')}
                  </button>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* App Info */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card bg-bg-tertiary/50">
              <div className="panel-body">
                <div className="flex items-center justify-between text-sm text-text-tertiary">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span>Deep Sight v5.5.0</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <a href="https://deepsightsynthesis.com/changelog" className="hover:text-accent-primary transition-colors">
                      {tr('Nouveautés', 'Changelog')}
                    </a>
                    <a href="https://deepsightsynthesis.com/help" className="hover:text-accent-primary transition-colors">
                      {tr('Aide', 'Help')}
                    </a>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
