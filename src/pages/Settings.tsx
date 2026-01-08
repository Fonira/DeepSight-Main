/**
 * DEEP SIGHT v5.0 — Settings Page
 * Paramètres utilisateur sobre et fonctionnel
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { 
  User, Mail, Globe, Moon, Sun, Bell, Shield, 
  Key, Trash2, LogOut, Check, AlertCircle, Loader2
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise(r => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="default" density={50} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className={`transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}>
        <div className="min-h-screen p-6 lg:p-8">
          <div className="max-w-2xl mx-auto">
            
            {/* Header */}
            <header className="mb-8">
              <h1 className="font-display text-2xl mb-2">
                {language === 'fr' ? 'Paramètres' : 'Settings'}
              </h1>
              <p className="text-text-secondary text-sm">
                {language === 'fr' 
                  ? 'Gérez votre compte et vos préférences.'
                  : 'Manage your account and preferences.'}
              </p>
            </header>

            <div className="space-y-6">
              {/* Profile Section */}
              <section className="card">
                <div className="panel-header">
                  <h2 className="font-semibold text-text-primary flex items-center gap-2">
                    <User className="w-5 h-5 text-accent-primary" />
                    {language === 'fr' ? 'Profil' : 'Profile'}
                  </h2>
                </div>
                <div className="panel-body space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Email
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border-subtle text-text-primary">
                        {user?.email || 'Non défini'}
                      </div>
                      <span className="badge badge-success">
                        <Check className="w-3 h-3" />
                        {language === 'fr' ? 'Vérifié' : 'Verified'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      {language === 'fr' ? 'Abonnement' : 'Subscription'}
                    </label>
                    <div className="px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border-subtle text-text-primary capitalize">
                      {user?.plan || 'Free'}
                    </div>
                  </div>
                </div>
              </section>

              {/* Preferences Section */}
              <section className="card">
                <div className="panel-header">
                  <h2 className="font-semibold text-text-primary flex items-center gap-2">
                    <Globe className="w-5 h-5 text-accent-primary" />
                    {language === 'fr' ? 'Préférences' : 'Preferences'}
                  </h2>
                </div>
                <div className="panel-body space-y-6">
                  {/* Theme */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">
                        {language === 'fr' ? 'Thème' : 'Theme'}
                      </p>
                      <p className="text-sm text-text-tertiary">
                        {language === 'fr' ? 'Choisissez entre clair et sombre' : 'Choose between light and dark'}
                      </p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-tertiary border border-border-default hover:bg-bg-hover transition-colors"
                    >
                      {isDark ? (
                        <>
                          <Moon className="w-4 h-4 text-accent-primary" />
                          <span className="text-sm">Dark</span>
                        </>
                      ) : (
                        <>
                          <Sun className="w-4 h-4 text-accent-secondary" />
                          <span className="text-sm">Light</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Language */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">
                        {language === 'fr' ? 'Langue' : 'Language'}
                      </p>
                      <p className="text-sm text-text-tertiary">
                        {language === 'fr' ? 'Langue de l\'interface' : 'Interface language'}
                      </p>
                    </div>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
                      className="px-4 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm"
                    >
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Security Section */}
              <section className="card">
                <div className="panel-header">
                  <h2 className="font-semibold text-text-primary flex items-center gap-2">
                    <Shield className="w-5 h-5 text-accent-primary" />
                    {language === 'fr' ? 'Sécurité' : 'Security'}
                  </h2>
                </div>
                <div className="panel-body space-y-4">
                  <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <Key className="w-5 h-5 text-text-tertiary" />
                      <div>
                        <p className="font-medium text-text-primary">
                          {language === 'fr' ? 'Changer le mot de passe' : 'Change password'}
                        </p>
                        <p className="text-sm text-text-tertiary">
                          {language === 'fr' ? 'Modifiez votre mot de passe' : 'Update your password'}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-5 h-5 text-text-tertiary" />
                      <div>
                        <p className="font-medium text-text-primary">
                          {language === 'fr' ? 'Déconnexion' : 'Sign out'}
                        </p>
                        <p className="text-sm text-text-tertiary">
                          {language === 'fr' ? 'Se déconnecter de Deep Sight' : 'Sign out of Deep Sight'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </section>

              {/* Danger Zone */}
              <section className="card border-error/20">
                <div className="panel-header border-error/20">
                  <h2 className="font-semibold text-error flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {language === 'fr' ? 'Zone dangereuse' : 'Danger Zone'}
                  </h2>
                </div>
                <div className="panel-body">
                  <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-error-muted border border-error/20 hover:bg-error/20 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <Trash2 className="w-5 h-5 text-error" />
                      <div>
                        <p className="font-medium text-error">
                          {language === 'fr' ? 'Supprimer mon compte' : 'Delete my account'}
                        </p>
                        <p className="text-sm text-text-tertiary">
                          {language === 'fr' ? 'Cette action est irréversible' : 'This action is irreversible'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
