/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT v5.5 — Settings Page                                              ║
 * ║  Paramètres utilisateur avec gestion API Keys (Plan Expert)                   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { billingApi } from '../services/api';
import { 
  User, Globe, Moon, Sun, Shield, Key, Trash2, LogOut, Check, 
  AlertCircle, Loader2, Eye, EyeOff, Copy, RefreshCw, Lock,
  Zap, ExternalLink, AlertTriangle
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════════

interface ApiKeyStatus {
  has_api_key: boolean;
  created_at: string | null;
  last_used: string | null;
}

interface ApiKeyState {
  status: ApiKeyStatus | null;
  newKey: string | null;
  loading: boolean;
  error: string | null;
  showKey: boolean;
  copied: boolean;
  confirmAction: 'regenerate' | 'revoke' | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 Component
// ═══════════════════════════════════════════════════════════════════════════════

export const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { t, language } = useTranslation();
  const { setLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // 🔑 API Key State (optimisé avec un seul état)
  const [apiKey, setApiKey] = useState<ApiKeyState>({
    status: null,
    newKey: null,
    loading: false,
    error: null,
    showKey: false,
    copied: false,
    confirmAction: null,
  });

  const isExpert = user?.plan === 'expert' || user?.plan === 'unlimited';
  
  // Helper pour les traductions inline (utilisé pour les textes dynamiques)
  const tr = useCallback((fr: string, en: string) => language === 'fr' ? fr : en, [language]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 📡 Fetch API Key Status
  // ─────────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!isExpert) return;
    
    const fetchStatus = async () => {
      try {
        const status = await billingApi.getApiKeyStatus();
        setApiKey(prev => ({ ...prev, status, loading: false }));
      } catch (err) {
        setApiKey(prev => ({ 
          ...prev, 
          error: tr('Impossible de charger le statut API', 'Failed to load API status'),
          loading: false 
        }));
      }
    };
    
    setApiKey(prev => ({ ...prev, loading: true }));
    fetchStatus();
  }, [isExpert, t]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔧 API Key Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const handleGenerateKey = async () => {
    setApiKey(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await billingApi.generateApiKey();
      setApiKey(prev => ({
        ...prev,
        newKey: response.api_key,
        status: { has_api_key: true, created_at: new Date().toISOString(), last_used: null },
        loading: false,
        showKey: true,
      }));
    } catch (err: any) {
      setApiKey(prev => ({
        ...prev,
        error: err?.message || tr('Erreur lors de la génération', 'Generation failed'),
        loading: false,
      }));
    }
  };

  const handleRegenerateKey = async () => {
    if (apiKey.confirmAction !== 'regenerate') {
      setApiKey(prev => ({ ...prev, confirmAction: 'regenerate' }));
      return;
    }
    
    setApiKey(prev => ({ ...prev, loading: true, error: null, confirmAction: null }));
    try {
      const response = await billingApi.regenerateApiKey();
      setApiKey(prev => ({
        ...prev,
        newKey: response.api_key,
        status: { has_api_key: true, created_at: new Date().toISOString(), last_used: null },
        loading: false,
        showKey: true,
      }));
    } catch (err: any) {
      setApiKey(prev => ({
        ...prev,
        error: err?.message || tr('Erreur lors de la régénération', 'Regeneration failed'),
        loading: false,
      }));
    }
  };

  const handleRevokeKey = async () => {
    if (apiKey.confirmAction !== 'revoke') {
      setApiKey(prev => ({ ...prev, confirmAction: 'revoke' }));
      return;
    }
    
    setApiKey(prev => ({ ...prev, loading: true, error: null, confirmAction: null }));
    try {
      await billingApi.revokeApiKey();
      setApiKey(prev => ({
        ...prev,
        status: { has_api_key: false, created_at: null, last_used: null },
        newKey: null,
        loading: false,
      }));
    } catch (err: any) {
      setApiKey(prev => ({
        ...prev,
        error: err?.message || tr('Erreur lors de la révocation', 'Revocation failed'),
        loading: false,
      }));
    }
  };

  const copyToClipboard = async () => {
    if (!apiKey.newKey) return;
    await navigator.clipboard.writeText(apiKey.newKey);
    setApiKey(prev => ({ ...prev, copied: true }));
    setTimeout(() => setApiKey(prev => ({ ...prev, copied: false })), 2000);
  };

  const cancelConfirm = () => setApiKey(prev => ({ ...prev, confirmAction: null }));

  // ─────────────────────────────────────────────────────────────────────────────
  // 🎨 Render Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return tr('Jamais', 'Never');
    return new Date(dateStr).toLocaleDateString(language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
              <h1 className="font-display text-2xl mb-2">{tr('Paramètres', 'Settings')}</h1>
              <p className="text-text-secondary text-sm">
                {tr('Gérez votre compte et vos préférences.', 'Manage your account and preferences.')}
              </p>
            </header>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Profile Section */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <User className="w-5 h-5 text-accent-primary" />
                  {tr('Profil', 'Profile')}
                </h2>
              </div>
              <div className="panel-body space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border-subtle text-text-primary">
                      {user?.email || 'Non défini'}
                    </div>
                    <span className="badge badge-success">
                      <Check className="w-3 h-3" />
                      {tr('Vérifié', 'Verified')}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {tr('Abonnement', 'Subscription')}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border-subtle text-text-primary capitalize flex-1">
                      {user?.plan || 'Free'}
                    </div>
                    {isExpert && (
                      <span className="badge bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                        <Zap className="w-3 h-3" /> Expert
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🔑 API Access Section (Expert Only) */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card border-amber-500/30">
              <div className="panel-header border-amber-500/20">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-500" />
                  {tr('Accès API', 'API Access')}
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    Expert
                  </span>
                </h2>
              </div>
              <div className="panel-body">
                {!isExpert ? (
                  /* ─── Non-Expert: Upgrade Prompt ─── */
                  <div className="text-center py-6">
                    <Lock className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
                    <p className="text-text-secondary mb-4">
                      {t(
                        "L'accès API REST est réservé au plan Expert.",
                        'REST API access is exclusive to Expert plan.'
                      )}
                    </p>
                    <a
                      href="/upgrade"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:opacity-90 transition-opacity"
                    >
                      <Zap className="w-4 h-4" />
                      {tr('Passer à Expert', 'Upgrade to Expert')}
                    </a>
                  </div>
                ) : apiKey.loading && !apiKey.status ? (
                  /* ─── Loading ─── */
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
                  </div>
                ) : (
                  /* ─── Expert: API Key Management ─── */
                  <div className="space-y-4">
                    {/* Error Display */}
                    {apiKey.error && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {apiKey.error}
                      </div>
                    )}

                    {/* New Key Display (shown only once after generation) */}
                    {apiKey.newKey && (
                      <div className="p-4 rounded-lg bg-success/10 border border-success/30 space-y-3">
                        <div className="flex items-center gap-2 text-success font-medium">
                          <Check className="w-4 h-4" />
                          {tr('Nouvelle clé générée !', 'New key generated!')}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 rounded bg-bg-tertiary font-mono text-sm overflow-x-auto">
                            {apiKey.showKey ? apiKey.newKey : '•'.repeat(48)}
                          </code>
                          <button
                            onClick={() => setApiKey(prev => ({ ...prev, showKey: !prev.showKey }))}
                            className="p-2 rounded hover:bg-bg-hover transition-colors"
                            title={apiKey.showKey ? 'Hide' : 'Show'}
                          >
                            {apiKey.showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={copyToClipboard}
                            className="p-2 rounded hover:bg-bg-hover transition-colors"
                            title="Copy"
                          >
                            {apiKey.copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t(
                            'Copiez cette clé maintenant. Elle ne sera plus jamais affichée.',
                            'Copy this key now. It will never be shown again.'
                          )}
                        </p>
                      </div>
                    )}

                    {/* Status Info */}
                    {apiKey.status?.has_api_key && !apiKey.newKey && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                          <span className="text-sm">{tr('Clé API active', 'API Key active')}</span>
                        </div>
                        <span className="text-xs text-text-tertiary">
                          {tr('Créée le', 'Created')} {formatDate(apiKey.status.created_at)}
                        </span>
                      </div>
                    )}

                    {apiKey.status?.last_used && (
                      <p className="text-xs text-text-tertiary">
                        {tr('Dernière utilisation:', 'Last used:')} {formatDate(apiKey.status.last_used)}
                      </p>
                    )}

                    {/* Confirmation Dialogs */}
                    {apiKey.confirmAction && (
                      <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                        <p className="text-sm text-warning mb-3">
                          {apiKey.confirmAction === 'regenerate' 
                            ? tr('⚠️ La régénération révoquera votre clé actuelle. Continuer ?', '⚠️ Regenerating will revoke your current key. Continue?')
                            : tr('⚠️ Cette action est irréversible. Êtes-vous sûr ?', '⚠️ This action is irreversible. Are you sure?')
                          }
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={apiKey.confirmAction === 'regenerate' ? handleRegenerateKey : handleRevokeKey}
                            className="px-4 py-2 rounded-lg bg-warning text-white text-sm font-medium"
                          >
                            {tr('Confirmer', 'Confirm')}
                          </button>
                          <button onClick={cancelConfirm} className="px-4 py-2 rounded-lg bg-bg-tertiary text-sm">
                            {tr('Annuler', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!apiKey.confirmAction && (
                      <div className="flex flex-wrap gap-3">
                        {!apiKey.status?.has_api_key ? (
                          <button
                            onClick={handleGenerateKey}
                            disabled={apiKey.loading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {apiKey.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                            {tr('Générer une clé API', 'Generate API Key')}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={handleRegenerateKey}
                              disabled={apiKey.loading}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-tertiary border border-border-default hover:bg-bg-hover transition-colors text-sm disabled:opacity-50"
                            >
                              <RefreshCw className="w-4 h-4" />
                              {tr('Régénérer', 'Regenerate')}
                            </button>
                            <button
                              onClick={handleRevokeKey}
                              disabled={apiKey.loading}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg text-error hover:bg-error/10 transition-colors text-sm disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              {tr('Révoquer', 'Revoke')}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Documentation Link */}
                    <a
                      href="https://docs.deepsightsynthesis.com/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-accent-primary hover:underline"
                    >
                      {tr('Documentation API', 'API Documentation')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Preferences Section */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Globe className="w-5 h-5 text-accent-primary" />
                  {tr('Préférences', 'Preferences')}
                </h2>
              </div>
              <div className="panel-body space-y-6">
                {/* Theme */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{tr('Thème', 'Theme')}</p>
                    <p className="text-sm text-text-tertiary">
                      {tr('Choisissez entre clair et sombre', 'Choose between light and dark')}
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
                    <p className="font-medium text-text-primary">{tr('Langue', 'Language')}</p>
                    <p className="text-sm text-text-tertiary">{tr("Langue de l'interface", 'Interface language')}</p>
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

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Security Section */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accent-primary" />
                  {tr('Sécurité', 'Security')}
                </h2>
              </div>
              <div className="panel-body space-y-4">
                <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">
                        {tr('Changer le mot de passe', 'Change password')}
                      </p>
                      <p className="text-sm text-text-tertiary">
                        {tr('Modifiez votre mot de passe', 'Update your password')}
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
                      <p className="font-medium text-text-primary">{tr('Déconnexion', 'Sign out')}</p>
                      <p className="text-sm text-text-tertiary">
                        {tr('Se déconnecter de Deep Sight', 'Sign out of Deep Sight')}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Danger Zone */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card border-error/20">
              <div className="panel-header border-error/20">
                <h2 className="font-semibold text-error flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {tr('Zone dangereuse', 'Danger Zone')}
                </h2>
              </div>
              <div className="panel-body">
                <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-error-muted border border-error/20 hover:bg-error/20 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-5 h-5 text-error" />
                    <div>
                      <p className="font-medium text-error">{tr('Supprimer mon compte', 'Delete my account')}</p>
                      <p className="text-sm text-text-tertiary">
                        {tr('Cette action est irréversible', 'This action is irreversible')}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
