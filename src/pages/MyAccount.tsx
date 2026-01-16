/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT v6.2 — My Account Page (Simplified)                               ║
 * ║  Version sans sons pour debugging                                             ║
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
  ExternalLink, Mail, Calendar, Crown, CreditCard, Sparkles,
  ChevronRight, Hash, AlertTriangle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 Types
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
  const { language } = useTranslation();
  const navigate = useNavigate();
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

  // États UI
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
      setApiKey(prev => ({ ...prev, error: message, loading: false }));
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
      setApiKey(prev => ({ ...prev, error: message, loading: false }));
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
      setApiKey(prev => ({ ...prev, error: message, loading: false }));
    }
  };

  const copyToClipboard = async () => {
    if (!apiKey.newKey) return;
    await navigator.clipboard.writeText(apiKey.newKey);
    setApiKey(prev => ({ ...prev, copied: true }));
    setTimeout(() => setApiKey(prev => ({ ...prev, copied: false })), 2000);
  };

  const cancelConfirm = () => {
    setApiKey(prev => ({ ...prev, confirmAction: null }));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 🎨 Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return tr('Non disponible', 'Not available');
    return new Date(dateStr).toLocaleDateString(language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Plan info
  const planConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    free: { label: tr('Gratuit', 'Free'), color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: '🆓' },
    starter: { label: 'Starter', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: '⚡' },
    pro: { label: 'Pro', color: 'text-amber-400', bgColor: 'bg-amber-500/10', icon: '⭐' },
    expert: { label: 'Expert', color: 'text-purple-400', bgColor: 'bg-purple-500/10', icon: '👑' },
    unlimited: { label: 'Admin', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', icon: '👑' },
  };

  const currentPlan = planConfig[user?.plan || 'free'];

  // ─────────────────────────────────────────────────────────────────────────────
  // 🎨 Info Row Component
  // ─────────────────────────────────────────────────────────────────────────────

  const InfoRow: React.FC<{
    icon: React.ElementType;
    label: string;
    value: string | React.ReactNode;
    iconColor?: string;
  }> = ({ icon: Icon, label, value, iconColor = 'text-text-tertiary' }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-text-secondary text-sm">{label}</span>
      </div>
      <span className="text-text-primary font-medium text-sm">{value}</span>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🖼️ Render
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="default" density={50} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main 
        id="main-content"
        className={`transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}
      >
        <div className="min-h-screen p-6 lg:p-8">
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* Header */}
            <header className="mb-8">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl ${currentPlan.bgColor} flex items-center justify-center ${currentPlan.color} text-2xl font-bold shadow-lg`}>
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h1 className="font-display text-2xl text-text-primary flex items-center gap-2">
                    {tr('Mon compte', 'My Account')}
                  </h1>
                  <p className="text-text-secondary text-sm flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${currentPlan.bgColor} ${currentPlan.color}`}>
                      {currentPlan.icon} {currentPlan.label}
                    </span>
                    <span className="text-text-tertiary">•</span>
                    <span>{user?.email}</span>
                  </p>
                </div>
              </div>
            </header>

            {/* Informations du compte */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <User className="w-5 h-5 text-accent-primary" />
                  {tr('Informations du compte', 'Account Information')}
                </h2>
              </div>
              <div className="panel-body divide-y divide-border-subtle">
                <InfoRow icon={Mail} label={tr('Email', 'Email')} value={user?.email || '-'} />
                <InfoRow 
                  icon={Hash} 
                  label={tr('Identifiant', 'User ID')} 
                  value={<span className="font-mono text-xs bg-bg-tertiary px-2 py-1 rounded">{user?.id?.slice(0, 8) || '---'}...</span>} 
                />
                <InfoRow icon={Calendar} label={tr('Membre depuis', 'Member since')} value={formatDate(user?.created_at)} />
                <InfoRow 
                  icon={Crown} 
                  iconColor={currentPlan.color}
                  label={tr('Abonnement', 'Subscription')} 
                  value={<span className={`font-semibold ${currentPlan.color}`}>{currentPlan.icon} {currentPlan.label}</span>} 
                />
                {user?.credits !== undefined && (
                  <InfoRow 
                    icon={Sparkles} 
                    iconColor="text-amber-400"
                    label={tr('Crédits restants', 'Remaining credits')} 
                    value={<span className="font-bold text-amber-400">{user.credits.toLocaleString()}</span>} 
                  />
                )}
              </div>
            </section>

            {/* Abonnement */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent-primary" />
                  {tr('Abonnement & Facturation', 'Subscription & Billing')}
                </h2>
              </div>
              <div className="panel-body space-y-4">
                <div className={`p-4 rounded-xl ${currentPlan.bgColor}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-semibold ${currentPlan.color} flex items-center gap-2`}>
                        {currentPlan.icon} Plan {currentPlan.label}
                      </p>
                      <p className="text-sm text-text-tertiary mt-1">
                        {user?.plan === 'free' 
                          ? tr('Fonctionnalités de base', 'Basic features')
                          : tr('Toutes les fonctionnalités incluses', 'All features included')
                        }
                      </p>
                    </div>
                    {user?.plan !== 'expert' && user?.plan !== 'unlimited' && (
                      <Link to="/upgrade" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors">
                        <Sparkles className="w-4 h-4" />
                        {tr('Améliorer', 'Upgrade')}
                      </Link>
                    )}
                  </div>
                </div>

                <Link to="/upgrade" className="flex items-center justify-between p-4 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover transition-colors">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Gérer l\'abonnement', 'Manage subscription')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Voir les plans et options', 'View plans and options')}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-tertiary" />
                </Link>
              </div>
            </section>

            {/* API Keys */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Key className="w-5 h-5 text-accent-primary" />
                  {tr('Clés API', 'API Keys')}
                  {isExpert && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">Expert</span>}
                </h2>
              </div>
              <div className="panel-body">
                {!isExpert ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                      <Lock className="w-6 h-6 text-purple-400" />
                    </div>
                    <p className="text-text-secondary mb-3">
                      {tr('L\'accès API est réservé aux abonnés Expert.', 'API access is available for Expert subscribers.')}
                    </p>
                    <Link to="/upgrade" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-sm font-medium hover:bg-purple-500/20 transition-colors">
                      <Crown className="w-4 h-4" />
                      {tr('Passer à Expert', 'Upgrade to Expert')}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiKey.error && (
                      <div className="p-3 rounded-lg bg-error/10 border border-error/30 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
                        <p className="text-sm text-error">{apiKey.error}</p>
                      </div>
                    )}

                    {apiKey.newKey && (
                      <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                        <p className="text-sm text-success mb-2 font-medium">
                          {tr('🎉 Votre nouvelle clé API:', '🎉 Your new API key:')}
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 rounded bg-bg-primary border border-border-default font-mono text-sm break-all text-text-primary">
                            {apiKey.showKey ? apiKey.newKey : '•'.repeat(40)}
                          </code>
                          <button onClick={() => setApiKey(prev => ({ ...prev, showKey: !prev.showKey }))} className="p-2 rounded-lg hover:bg-bg-hover transition-colors">
                            {apiKey.showKey ? <EyeOff className="w-4 h-4 text-text-tertiary" /> : <Eye className="w-4 h-4 text-text-tertiary" />}
                          </button>
                          <button onClick={copyToClipboard} className="p-2 rounded-lg hover:bg-bg-hover transition-colors">
                            {apiKey.copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-text-tertiary" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 rounded-lg bg-bg-tertiary">
                      <div className="flex items-center gap-3">
                        <Key className="w-5 h-5 text-text-tertiary" />
                        <div>
                          <p className="font-medium text-text-primary">{tr('Clé API', 'API Key')}</p>
                          <p className="text-sm text-text-tertiary">
                            {apiKey.status?.has_api_key
                              ? tr(`Créée le ${formatDate(apiKey.status.created_at)}`, `Created on ${formatDate(apiKey.status.created_at)}`)
                              : tr('Aucune clé active', 'No active key')}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${apiKey.status?.has_api_key ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {apiKey.status?.has_api_key ? tr('Active', 'Active') : tr('Inactive', 'Inactive')}
                      </span>
                    </div>

                    {apiKey.confirmAction && (
                      <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                        <p className="text-sm text-warning mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          {apiKey.confirmAction === 'regenerate'
                            ? tr('Régénérer la clé invalidera l\'ancienne. Continuer ?', 'Regenerating will invalidate the old key. Continue?')
                            : tr('Révoquer la clé désactivera l\'accès API. Continuer ?', 'Revoking will disable API access. Continue?')}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={apiKey.confirmAction === 'regenerate' ? handleRegenerateKey : handleRevokeKey} className="px-4 py-2 rounded-lg bg-warning text-white text-sm font-medium">
                            {tr('Confirmer', 'Confirm')}
                          </button>
                          <button onClick={cancelConfirm} className="px-4 py-2 rounded-lg bg-bg-tertiary text-sm hover:bg-bg-hover transition-colors">
                            {tr('Annuler', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {!apiKey.confirmAction && (
                      <div className="flex flex-wrap gap-3">
                        {!apiKey.status?.has_api_key ? (
                          <button onClick={handleGenerateKey} disabled={apiKey.loading} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-primary text-white font-medium hover:opacity-90 disabled:opacity-50">
                            {apiKey.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                            {tr('Générer une clé API', 'Generate API Key')}
                          </button>
                        ) : (
                          <>
                            <button onClick={handleRegenerateKey} disabled={apiKey.loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-tertiary border border-border-default hover:bg-bg-hover text-sm disabled:opacity-50">
                              <RefreshCw className="w-4 h-4" />
                              {tr('Régénérer', 'Regenerate')}
                            </button>
                            <button onClick={handleRevokeKey} disabled={apiKey.loading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-error hover:bg-error/10 text-sm disabled:opacity-50">
                              <Trash2 className="w-4 h-4" />
                              {tr('Révoquer', 'Revoke')}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    <a href="https://docs.deepsightsynthesis.com/api" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent-primary hover:underline">
                      {tr('Documentation API', 'API Documentation')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </section>

            {/* Sécurité */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accent-primary" />
                  {tr('Sécurité', 'Security')}
                </h2>
              </div>
              <div className="panel-body space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg bg-bg-tertiary border border-border-subtle opacity-60">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Mot de passe', 'Password')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Connexion via Google - pas de mot de passe', 'Google sign-in - no password')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-text-tertiary">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <Lock className="w-4 h-4" />
                  </div>
                </div>

                <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="font-medium text-text-primary">{tr('Déconnexion', 'Sign out')}</p>
                      <p className="text-sm text-text-tertiary">{tr('Se déconnecter de Deep Sight', 'Sign out of Deep Sight')}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>
            </section>

            {/* Zone dangereuse */}
            <section className="card border-error/20">
              <div className="panel-header border-error/20">
                <h2 className="font-semibold text-error flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {tr('Zone dangereuse', 'Danger Zone')}
                </h2>
              </div>
              <div className="panel-body">
                {!showDeleteConfirm ? (
                  <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-between p-4 rounded-lg bg-error/5 border border-error/20 hover:bg-error/10 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <Trash2 className="w-5 h-5 text-error" />
                      <div>
                        <p className="font-medium text-error">{tr('Supprimer mon compte', 'Delete my account')}</p>
                        <p className="text-sm text-text-tertiary">{tr('Cette action est irréversible', 'This action is irreversible')}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-error/50" />
                  </button>
                ) : (
                  <div className="p-4 rounded-lg bg-error/10 border border-error/30">
                    <p className="text-sm text-error mb-4 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {tr('⚠️ Êtes-vous sûr ? Toutes vos données seront perdues.', '⚠️ Are you sure? All your data will be permanently lost.')}
                    </p>
                    <p className="text-sm text-text-tertiary mb-3">
                      {tr('Tapez "SUPPRIMER" pour confirmer:', 'Type "DELETE" to confirm:')}
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={language === 'fr' ? 'SUPPRIMER' : 'DELETE'}
                      className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-error/30 text-text-primary text-sm mb-3 focus:outline-none focus:border-error"
                    />
                    <div className="flex gap-2">
                      <button disabled={deleteConfirmText !== (language === 'fr' ? 'SUPPRIMER' : 'DELETE')} className="px-4 py-2 rounded-lg bg-error text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                        {tr('Supprimer définitivement', 'Delete permanently')}
                      </button>
                      <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} className="px-4 py-2 rounded-lg bg-bg-tertiary text-sm hover:bg-bg-hover transition-colors">
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
