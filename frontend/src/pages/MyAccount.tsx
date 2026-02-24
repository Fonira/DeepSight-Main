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
import { billingApi, authApi, type ApiBillingMyPlan } from '../services/api';
import { PLANS_INFO, getMinPlanForFeature, type PlanId } from '../config/planPrivileges';
import { useToast } from '../components/Toast';
import {
  User, Shield, Key, Trash2, LogOut, Check,
  AlertCircle, Eye, EyeOff, Copy, RefreshCw, Lock,
  ExternalLink, Mail, Calendar, Crown, CreditCard, Sparkles,
  ChevronRight, Hash, AlertTriangle, Zap, Clock,
  MessageSquare, Search, FileText,
  Users, GraduationCap, Brain, BookOpen
} from 'lucide-react';
import { DeepSightSpinnerMicro } from '../components/ui';
import { Link, useNavigate } from 'react-router-dom';
import DoodleBackground from '../components/DoodleBackground';

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
  const { showToast, ToastComponent } = useToast();
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
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isTeamOrHigher = user?.plan === 'team' || user?.plan === 'expert' || user?.plan === 'unlimited';

  // Plan data from API
  const [myPlan, setMyPlan] = useState<ApiBillingMyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  // Helper pour les traductions inline
  const tr = useCallback((fr: string, en: string) => language === 'fr' ? fr : en, [language]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 🗑️ Delete Account
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDeleteAccount = async () => {
    const confirmWord = language === 'fr' ? 'SUPPRIMER' : 'DELETE';
    if (deleteConfirmText !== confirmWord) return;

    setDeleteLoading(true);
    try {
      // Le backend vérifie si un mot de passe est requis selon le type de compte
      await authApi.deleteAccount(deletePassword || undefined);
      showToast(tr('Compte supprimé', 'Account deleted'), 'success');
      logout();
      navigate('/');
    } catch (error: any) {
      const message = error?.message || error?.detail || tr('Erreur lors de la suppression', 'Error deleting account');
      showToast(message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 📡 Fetch API Key Status
  // ─────────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!isTeamOrHigher) return;
    
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
  }, [isTeamOrHigher, tr]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 📋 Fetch My Plan (billing/my-plan)
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    billingApi.getMyPlan('web')
      .then(setMyPlan)
      .catch(() => {})
      .finally(() => setPlanLoading(false));
  }, []);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { portal_url } = await billingApi.getPortalUrl();
      window.location.href = portal_url;
    } catch {
      showToast(tr('Erreur lors de l\'accès au portail', 'Error accessing portal'), 'error');
    } finally {
      setPortalLoading(false);
    }
  };

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

  // Plan info - v4.0 (Free, Student, Starter, Pro, Team)
  const planConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    free: { label: tr('Gratuit', 'Free'), color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: '🆓' },
    student: { label: tr('Étudiant', 'Student'), color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: '🎓' },
    starter: { label: 'Starter', color: 'text-blue-400', bgColor: 'bg-blue-500/10', icon: '⚡' },
    pro: { label: 'Pro', color: 'text-violet-400', bgColor: 'bg-violet-500/10', icon: '⭐' },
    team: { label: tr('Équipe', 'Team'), color: 'text-amber-400', bgColor: 'bg-amber-500/10', icon: '👥' },
    expert: { label: tr('Équipe', 'Team'), color: 'text-amber-400', bgColor: 'bg-amber-500/10', icon: '👥' }, // Rétrocompatibilité
    unlimited: { label: 'Admin', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', icon: '👑' },
  };

  const currentPlan = planConfig[user?.plan || 'free'];

  // Helpers pour lire les limites/features du plan depuis l'API
  const getLimitVal = (...keys: string[]): number => {
    if (!myPlan?.limits) return 0;
    const limits = myPlan.limits as Record<string, unknown>;
    for (const key of keys) {
      const val = limits[key];
      if (typeof val === 'number') return val;
    }
    return 0;
  };

  const hasPlanFeature = (...keys: string[]): boolean => {
    if (!myPlan?.platform_features) return false;
    for (const key of keys) {
      if (myPlan.platform_features[key] === true) return true;
    }
    return false;
  };

  // Plan prices — dynamiques depuis planPrivileges
  const planPrices: Record<string, number> = (() => {
    const prices: Record<string, number> = { unlimited: 0 };
    for (const [id, info] of Object.entries(PLANS_INFO)) {
      prices[id] = info.priceMonthly;
    }
    // Aliases rétrocompat
    prices.student = prices.etudiant;
    prices.team = prices.equipe;
    prices.expert = prices.equipe;
    return prices;
  })();

  // Min plan for locked features — dynamique
  const fmtPlan = (planId: PlanId) => {
    const info = PLANS_INFO[planId];
    const name = language === 'fr' ? info.name : info.nameEn;
    const price = (info.priceMonthly / 100).toFixed(2).replace('.', ',');
    const suffix = language === 'fr' ? 'mois' : 'mo';
    return `${name} (${price}€/${suffix})`;
  };
  const minPlanForFeature: Record<string, string> = {
    flashcards: fmtPlan(getMinPlanForFeature('flashcardsEnabled')),
    mindmap: fmtPlan(getMinPlanForFeature('mindmapEnabled')),
    web_search: fmtPlan(getMinPlanForFeature('webSearchEnabled')),
    playlists: fmtPlan(getMinPlanForFeature('playlistsEnabled')),
    export_pdf: fmtPlan(getMinPlanForFeature('exportPdf')),
  };

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
      <DoodleBackground variant="tech" />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main 
        id="main-content"
        className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'}`}
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
                  <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
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
                  value={<span className="font-mono text-xs bg-bg-tertiary px-2 py-1 rounded">{user?.id ? String(user.id).slice(0, 8) : '---'}...</span>} 
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

            {/* ═══════════════════════════════════════════════════════════════════════════
                🎯 PRIVILÈGES DU PLAN — Dynamic v5.0 (API-driven)
            ═══════════════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Crown className="w-5 h-5 text-accent-primary" />
                  {tr('Privilèges de votre plan', 'Your Plan Privileges')}
                  {myPlan && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${myPlan.plan_color}20`, color: myPlan.plan_color }}
                    >
                      {myPlan.plan_icon} {myPlan.plan_name}
                    </span>
                  )}
                </h2>
              </div>
              <div className="panel-body">
                {planLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="h-20 rounded-lg bg-bg-tertiary animate-pulse" />
                    ))}
                  </div>
                ) : myPlan ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Card: Analyses */}
                    {(() => {
                      const limit = getLimitVal('monthly_analyses', 'monthlyAnalyses');
                      const used = myPlan.usage.analyses_this_month;
                      const unlimited = limit === -1;
                      const pct = !unlimited && limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                      return (
                        <div className="p-3 rounded-lg bg-bg-tertiary border border-border-subtle">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-accent-primary/20 text-accent-primary flex items-center justify-center"><Zap className="w-4 h-4" /></div>
                            <p className="text-sm font-medium text-text-primary">{tr('Analyses', 'Analyses')}</p>
                          </div>
                          <p className="text-xs text-text-secondary mb-1.5">
                            {unlimited ? `${used} — ${tr('Illimité', 'Unlimited')}` : `${used} / ${limit} ${tr('utilisées', 'used')}`}
                          </p>
                          {!unlimited && limit > 0 && (
                            <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-accent-primary'}`} style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Card: Chat */}
                    {(() => {
                      const limit = getLimitVal('chat_daily_limit', 'chatDailyLimit');
                      const used = myPlan.usage.chat_today;
                      const unlimited = limit === -1;
                      return (
                        <div className="p-3 rounded-lg bg-bg-tertiary border border-border-subtle">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center"><MessageSquare className="w-4 h-4" /></div>
                            <p className="text-sm font-medium text-text-primary">Chat IA</p>
                          </div>
                          <p className="text-xs text-text-secondary">
                            {unlimited
                              ? `${used} — \u221e ${tr('illimité', 'unlimited')}`
                              : `${used} / ${limit} ${tr("aujourd'hui", 'today')}`
                            }
                          </p>
                        </div>
                      );
                    })()}

                    {/* Card: Flashcards */}
                    {(() => {
                      const enabled = hasPlanFeature('flashcards', 'flashcardsEnabled');
                      return (
                        <div className={`p-3 rounded-lg border ${enabled ? 'bg-bg-tertiary border-border-subtle' : 'bg-bg-secondary/50 border-dashed border-border-subtle'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-bg-tertiary text-text-tertiary'}`}>
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <p className={`text-sm font-medium ${enabled ? 'text-text-primary' : 'text-text-tertiary'}`}>Flashcards</p>
                          </div>
                          {enabled
                            ? <p className="text-xs text-emerald-400 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> {tr('Inclus', 'Included')}</p>
                            : <Link to="/upgrade" className="text-xs text-text-tertiary hover:text-accent-primary transition-colors flex items-center gap-1"><Lock className="w-3 h-3" /> {minPlanForFeature.flashcards}</Link>
                          }
                        </div>
                      );
                    })()}

                    {/* Card: Mind Maps */}
                    {(() => {
                      const enabled = hasPlanFeature('mindmap', 'mindmapEnabled', 'concept_maps', 'conceptMaps');
                      return (
                        <div className={`p-3 rounded-lg border ${enabled ? 'bg-bg-tertiary border-border-subtle' : 'bg-bg-secondary/50 border-dashed border-border-subtle'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-violet-500/20 text-violet-400' : 'bg-bg-tertiary text-text-tertiary'}`}>
                              <Brain className="w-4 h-4" />
                            </div>
                            <p className={`text-sm font-medium ${enabled ? 'text-text-primary' : 'text-text-tertiary'}`}>{tr('Cartes mentales', 'Mind maps')}</p>
                          </div>
                          {enabled
                            ? <p className="text-xs text-violet-400 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> {tr('Inclus', 'Included')}</p>
                            : <Link to="/upgrade" className="text-xs text-text-tertiary hover:text-accent-primary transition-colors flex items-center gap-1"><Lock className="w-3 h-3" /> {minPlanForFeature.mindmap}</Link>
                          }
                        </div>
                      );
                    })()}

                    {/* Card: Web Search */}
                    {(() => {
                      const enabled = hasPlanFeature('web_search', 'webSearchEnabled', 'chatWebSearch');
                      const limit = getLimitVal('web_search_monthly', 'webSearchMonthly');
                      const used = myPlan.usage.web_searches_this_month;
                      const unlimited = limit === -1;
                      return (
                        <div className={`p-3 rounded-lg border ${enabled ? 'bg-bg-tertiary border-border-subtle' : 'bg-bg-secondary/50 border-dashed border-border-subtle'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-bg-tertiary text-text-tertiary'}`}>
                              <Search className="w-4 h-4" />
                            </div>
                            <p className={`text-sm font-medium ${enabled ? 'text-text-primary' : 'text-text-tertiary'}`}>{tr('Recherche web', 'Web search')}</p>
                          </div>
                          {enabled
                            ? <p className="text-xs text-text-secondary">{unlimited ? `${used} — \u221e` : `${used} / ${limit} ${tr('ce mois', 'this month')}`}</p>
                            : <Link to="/upgrade" className="text-xs text-text-tertiary hover:text-accent-primary transition-colors flex items-center gap-1"><Lock className="w-3 h-3" /> {minPlanForFeature.web_search}</Link>
                          }
                        </div>
                      );
                    })()}

                    {/* Card: Playlists */}
                    {(() => {
                      const enabled = hasPlanFeature('playlists', 'playlistsEnabled');
                      const limit = getLimitVal('max_playlists', 'maxPlaylists');
                      const unlimited = limit === -1;
                      return (
                        <div className={`p-3 rounded-lg border ${enabled ? 'bg-bg-tertiary border-border-subtle' : 'bg-bg-secondary/50 border-dashed border-border-subtle'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-amber-500/20 text-amber-400' : 'bg-bg-tertiary text-text-tertiary'}`}>
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <p className={`text-sm font-medium ${enabled ? 'text-text-primary' : 'text-text-tertiary'}`}>Playlists</p>
                          </div>
                          {enabled
                            ? <p className="text-xs text-text-secondary">{unlimited ? `\u221e ${tr('illimité', 'unlimited')}` : `${limit} max`}</p>
                            : <Link to="/upgrade" className="text-xs text-text-tertiary hover:text-accent-primary transition-colors flex items-center gap-1"><Lock className="w-3 h-3" /> {minPlanForFeature.playlists}</Link>
                          }
                        </div>
                      );
                    })()}

                    {/* Card: Export */}
                    {(() => {
                      const hasPdf = hasPlanFeature('export_pdf', 'exportPdf');
                      const hasMd = hasPlanFeature('export_markdown', 'exportMarkdown');
                      const formats: string[] = ['TXT'];
                      if (hasMd) formats.push('MD');
                      if (hasPdf) formats.push('PDF');
                      return (
                        <div className="p-3 rounded-lg bg-bg-tertiary border border-border-subtle">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center"><FileText className="w-4 h-4" /></div>
                            <p className="text-sm font-medium text-text-primary">Export</p>
                          </div>
                          <p className="text-xs text-text-secondary">{formats.join(', ')}</p>
                        </div>
                      );
                    })()}

                    {/* Card: History */}
                    {(() => {
                      const days = getLimitVal('history_retention_days', 'historyRetentionDays');
                      const unlimited = days === -1;
                      return (
                        <div className="p-3 rounded-lg bg-bg-tertiary border border-border-subtle">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center"><Clock className="w-4 h-4" /></div>
                            <p className="text-sm font-medium text-text-primary">{tr('Historique', 'History')}</p>
                          </div>
                          <p className="text-xs text-text-secondary">
                            {unlimited ? `\u221e ${tr('Permanent', 'Permanent')}` : `${days} ${tr('jours', 'days')}`}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-text-tertiary text-sm text-center py-4">{tr('Impossible de charger les données du plan.', 'Unable to load plan data.')}</p>
                )}
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════════
                💳 MON ABONNEMENT — Dynamic v5.0 (API-driven)
            ═══════════════════════════════════════════════════════════════════════════ */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent-primary" />
                  {tr('Mon abonnement', 'My Subscription')}
                </h2>
              </div>
              <div className="panel-body space-y-4">
                {/* Plan badge + price */}
                <div className="p-4 rounded-xl" style={myPlan ? { backgroundColor: `${myPlan.plan_color}15` } : undefined}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold flex items-center gap-2" style={myPlan ? { color: myPlan.plan_color } : undefined}>
                        {myPlan ? `${myPlan.plan_icon} Plan ${myPlan.plan_name}` : `${currentPlan.icon} Plan ${currentPlan.label}`}
                      </p>
                      <p className="text-sm text-text-tertiary mt-1">
                        {(() => {
                          const price = planPrices[myPlan?.plan || user?.plan || 'free'] || 0;
                          return price > 0
                            ? `${(price / 100).toFixed(2)}€/${tr('mois', 'mo')}`
                            : tr('Gratuit', 'Free');
                        })()}
                      </p>
                    </div>
                    {/* Status badge */}
                    {myPlan?.subscription && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        myPlan.subscription.status === 'active'
                          ? 'bg-success/10 text-success'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {myPlan.subscription.status === 'active'
                          ? tr('Actif', 'Active')
                          : tr('Annulé', 'Cancelled')
                        }
                      </span>
                    )}
                  </div>

                  {/* Renewal date */}
                  {myPlan?.subscription?.current_period_end && (
                    <p className="text-xs text-text-tertiary mt-3 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {tr('Prochain renouvellement :', 'Next renewal:')} {formatDate(myPlan.subscription.current_period_end)}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {user?.plan !== 'free' && (
                    <button
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-bg-tertiary border border-border-subtle hover:bg-bg-hover transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {portalLoading ? <DeepSightSpinnerMicro /> : <CreditCard className="w-4 h-4 text-text-tertiary" />}
                      {tr('Gérer mon abonnement', 'Manage subscription')}
                      <ExternalLink className="w-3 h-3 text-text-muted" />
                    </button>
                  )}
                  <Link
                    to="/upgrade"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-accent-primary to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-4 h-4" />
                    {tr('Changer de plan', 'Change plan')}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </section>

            {/* API Keys */}
            <section className="card">
              <div className="panel-header">
                <h2 className="font-semibold text-text-primary flex items-center gap-2">
                  <Key className="w-5 h-5 text-accent-primary" />
                  {tr('Clés API', 'API Keys')}
                  {isTeamOrHigher && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">Team</span>}
                </h2>
              </div>
              <div className="panel-body">
                {!isTeamOrHigher ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                      <Lock className="w-6 h-6 text-amber-400" />
                    </div>
                    <p className="text-text-secondary mb-3">
                      {tr('L\'accès API est réservé aux abonnés Équipe (29.99€/mois).', 'API access is available for Team subscribers (€29.99/mo).')}
                    </p>
                    <Link to="/upgrade" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors">
                      <Users className="w-4 h-4" />
                      {tr('Passer à Équipe', 'Upgrade to Team')}
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
                            {apiKey.loading ? <DeepSightSpinnerMicro /> : <Key className="w-4 h-4" />}
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
                    <p className="text-sm text-text-tertiary mb-2">
                      {tr('Entrez votre mot de passe:', 'Enter your password:')}
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder={tr('Mot de passe', 'Password')}
                      className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-error/30 text-text-primary text-sm mb-3 focus:outline-none focus:border-error"
                    />
                    <p className="text-sm text-text-tertiary mb-2">
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
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== (language === 'fr' ? 'SUPPRIMER' : 'DELETE') || deleteLoading}
                        className="px-4 py-2 rounded-lg bg-error text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {deleteLoading && <DeepSightSpinnerMicro />}
                        {tr('Supprimer définitivement', 'Delete permanently')}
                      </button>
                      <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeletePassword(''); }} className="px-4 py-2 rounded-lg bg-bg-tertiary text-sm hover:bg-bg-hover transition-colors">
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
      {ToastComponent}
    </div>
  );
};

export default MyAccount;
