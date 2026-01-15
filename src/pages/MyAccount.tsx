/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT v5.5 — My Account Page                                            ║
 * ║  Gestion du compte utilisateur: profil, mot de passe, API keys, sécurité      ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { billingApi } from '../services/api';
import { 
  User, Shield, Key, Trash2, LogOut, Check, 
  AlertCircle, Loader2, Eye, EyeOff, Copy, RefreshCw, Lock,
  Zap, ExternalLink, AlertTriangle, Mail, Calendar, Crown,
  CreditCard, BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

export const MyAccount: React.FC = () => {
  const { user, logout } = useAuth();
  const { t, language } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // 🔑 API Key State
  const [apiKey, setApiKey] = useState<ApiKeyState>({
    status: null,
    newKey: null,
    loading: false,
    error: null,
    showKey: false,
    copied: false,
    confirmAction: null,
  });

  // État pour suppression de compte
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isExpert = user?.plan === 'expert' || user?.plan === 'unlimited';
  
  // Helper pour les traductions inline
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
      } catch {
        setApiKey(prev => ({ 
          ...prev, 
          error: tr('Impossible de charger le statut API', 'Failed to load API status'),
          loading: false 
        }));
      }
    };
    
    setApiKey(prev => ({ ...prev, loading: true }));
    fetchStatus();
  }, [isExpert, tr]);

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : tr('Erreur lors de la génération', 'Generation failed');
      setApiKey(prev => ({
        ...prev,
        error: message,
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : tr('Erreur lors de la régénération', 'Regeneration failed');
      setApiKey(prev => ({
        ...prev,
        error: message,
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : tr('Erreur lors de la révocation', 'Revocation failed');
      setApiKey(prev => ({
        ...prev,
        error: message,
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

  const getPlanBadge = () => {
    const plan = user?.plan || 'free';
    const badges: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      free: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: null },
      starter: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Zap className="w-3 h-3" /> },
      pro: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: <Crown className="w-3 h-3" /> },
      expert: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: <Zap className="w-3 h-3" /> },
      unlimited: { bg: 'bg-gradient-to-r from-amber-500 to-orange-500', text: 'text-white', icon: <Crown className="w-3 h-3" /> },
    };
    return badges[plan] || badges.free;
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
              <h1 className="font-display text-2xl mb-2">{tr('Mon compte', 'My Account')}</h1>
              <p className="text-text-secondary text-sm">
                {tr('Gérez vos informations personnelles et la sécurité de votre compte.', 
                    'Manage your personal information and account security.')}
              </p>
            </header>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Profile Information */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <User className="w-5 h-5 text-accent-primary" />
                  {tr('Informations du profil', 'Profile Information')}
                </h2>
              </div>
              <div className="panel-body space-y-4">
                {/* Email */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-bg-tertiary">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="text-sm text-text-tertiary">{tr('Adresse email', 'Email address')}</p>
                      <p className="font-medium text-text-primary">{user?.email || 'Non défini'}</p>
                    </div>
                  </div>
                  <span className="badge badge-success text-xs">
                    <Check className="w-3 h-3" />
                    {tr('Vérifié', 'Verified')}
                  </span>
                </div>

                {/* Plan */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-bg-tertiary">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="text-sm text-text-tertiary">{tr('Abonnement', 'Subscription')}</p>
                      <p className="font-medium text-text-primary capitalize">{user?.plan || 'Free'}</p>
                    </div>
                  </div>
                  <span className={`badge ${getPlanBadge().bg} ${getPlanBadge().text} flex items-center gap-1`}>
                    {getPlanBadge().icon}
                    {(user?.plan || 'free').charAt(0).toUpperCase() + (user?.plan || 'free').slice(1)}
                  </span>
                </div>

                {/* Credits */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-bg-tertiary">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="text-sm text-text-tertiary">{tr('Crédits restants', 'Remaining credits')}</p>
                      <p className="font-medium text-text-primary">
                        {user?.analysis_count !== undefined 
                          ? `${user.analysis_count} / ${user.analysis_limit || '∞'}`
                          : tr('Non disponible', 'Not available')
                        }
                      </p>
                    </div>
                  </div>
                  <Link 
                    to="/usage"
                    className="text-sm text-accent-primary hover:underline"
                  >
                    {tr('Voir détails', 'View details')}
                  </Link>
                </div>

                {/* Member since */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-bg-tertiary">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="text-sm text-text-tertiary">{tr('Membre depuis', 'Member since')}</p>
                      <p className="font-medium text-text-primary">
                        {user?.created_at 
                          ? new Date(user.created_at).toLocaleDateString(language, { month: 'long', year: 'numeric' })
                          : tr('Inconnu', 'Unknown')
                        }
                      </p>
                    </div>
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
                      {tr("L'accès API REST est réservé au plan Expert.", 
                          'REST API access is exclusive to Expert plan.')}
                    </p>
                    <Link
                      to="/upgrade"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:opacity-90 transition-opacity"
                    >
                      <Zap className="w-4 h-4" />
                      {tr('Passer à Expert', 'Upgrade to Expert')}
                    </Link>
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

                    {/* New Key Display */}
                    {apiKey.newKey && (
                      <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Check className="w-5 h-5 text-success" />
                          <span className="font-medium text-success">
                            {tr('Clé générée avec succès !', 'Key generated successfully!')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 rounded bg-bg-tertiary font-mono text-sm overflow-x-auto">
                            {apiKey.showKey ? apiKey.newKey : '•'.repeat(40)}
                          </code>
                          <button
                            onClick={() => setApiKey(prev => ({ ...prev, showKey: !prev.showKey }))}
                            className="p-2 rounded-lg hover:bg-bg-hover transition-colors"
                            title={apiKey.showKey ? tr('Masquer', 'Hide') : tr('Afficher', 'Show')}
                          >
                            {apiKey.showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={copyToClipboard}
                            className="p-2 rounded-lg hover:bg-bg-hover transition-colors"
                            title={tr('Copier', 'Copy')}
                          >
                            {apiKey.copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="mt-3 text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {tr('Copiez cette clé maintenant. Elle ne sera plus affichée.',
                              'Copy this key now. It won\'t be shown again.')}
                        </p>
                      </div>
                    )}

                    {/* Key Status */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-bg-tertiary">
                      <div>
                        <p className="font-medium text-text-primary">
                          {tr('Statut de la clé', 'Key Status')}
                        </p>
                        <p className="text-sm text-text-tertiary">
                          {apiKey.status?.has_api_key 
                            ? tr(`Créée le ${formatDate(apiKey.status.created_at)}`,
                                `Created on ${formatDate(apiKey.status.created_at)}`)
                            : tr('Aucune clé active', 'No active key')}
                        </p>
                      </div>
                      <span className={`badge ${apiKey.status?.has_api_key ? 'badge-success' : 'badge-warning'}`}>
                        {apiKey.status?.has_api_key ? tr('Active', 'Active') : tr('Inactive', 'Inactive')}
                      </span>
                    </div>

                    {/* Confirmation Dialog */}
                    {apiKey.confirmAction && (
                      <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                        <p className="text-sm text-warning mb-3">
                          {apiKey.confirmAction === 'regenerate'
                            ? tr('⚠️ Régénérer la clé invalidera l\'ancienne. Continuer ?',
                                '⚠️ Regenerating will invalidate the old key. Continue?')
                            : tr('⚠️ Révoquer la clé désactivera l\'accès API. Continuer ?',
                                '⚠️ Revoking will disable API access. Continue?')}
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
                {/* Change Password - Désactivé car Google OAuth */}
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-bg-tertiary border border-border-subtle opacity-60">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">
                        {tr('Changer le mot de passe', 'Change password')}
                      </p>
                      <p className="text-sm text-text-tertiary">
                        {tr('Connexion via Google - pas de mot de passe', 'Google sign-in - no password')}
                      </p>
                    </div>
                  </div>
                  <Lock className="w-4 h-4 text-text-tertiary" />
                </div>

                {/* Sign out */}
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
                {!showDeleteConfirm ? (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-error-muted border border-error/20 hover:bg-error/20 transition-colors text-left"
                  >
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
                ) : (
                  <div className="p-4 rounded-lg bg-error/10 border border-error/30">
                    <p className="text-sm text-error mb-4">
                      {tr('⚠️ Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données seront perdues définitivement.',
                          '⚠️ Are you sure you want to delete your account? All your data will be permanently lost.')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 rounded-lg bg-error text-white text-sm font-medium"
                      >
                        {tr('Supprimer définitivement', 'Delete permanently')}
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 rounded-lg bg-bg-tertiary text-sm"
                      >
                        {tr('Annuler', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};

export default MyAccount;
