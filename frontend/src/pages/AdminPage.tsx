/**
 * DEEP SIGHT v5.0 — Admin Page
 * Interface d'administration complète et fonctionnelle
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { 
  Shield, Users, BarChart3, Lock, 
  AlertCircle, TrendingUp, Activity, Search, ChevronLeft,
  ChevronRight, Edit2, Trash2, Plus, X, RefreshCw,
  FileText, Crown, CreditCard, Mail, Check
} from 'lucide-react';
import { DeepSightSpinner, DeepSightSpinnerMicro } from '../components/ui';
import { API_URL } from '../services/api';
import { useToast } from '../components/Toast';

// Types
interface AdminStats {
  total_users: number;
  total_videos: number;
  total_words: number;
  active_subscriptions: number;
  new_users_today: number;
  new_users_week: number;
  revenue_estimate: number;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  plan: string;
  credits: number;
  is_admin: boolean;
  email_verified: boolean;
  total_videos: number;
  total_words: number;
  created_at: string;
  last_login: string | null;
}

interface AdminLog {
  id: number;
  admin_id: number;
  action: string;
  target_user_id: number | null;
  details: string;
  created_at: string;
}

type TabType = 'dashboard' | 'users' | 'stats' | 'logs';

const ADMIN_EMAIL = "maximeleparc3@gmail.com";

// Plan colors and labels - v4.0 (Free, Student, Starter, Pro, Team)
const PLAN_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  free: { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Free' },
  student: { color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Student (€2.99)' },
  starter: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Starter (€5.99)' },
  pro: { color: 'text-violet-600', bg: 'bg-violet-100', label: 'Pro (€12.99)' },
  team: { color: 'text-amber-600', bg: 'bg-amber-100', label: 'Team (€29.99)' },
  // Rétrocompatibilité
  expert: { color: 'text-amber-600', bg: 'bg-amber-100', label: 'Team (€29.99)' },
  unlimited: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Unlimited' },
};

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  // Récupérer le token depuis localStorage
  const getToken = () => localStorage.getItem('access_token');
  
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersPlanFilter, setUsersPlanFilter] = useState('');
  const [logs, setLogs] = useState<AdminLog[]>([]);
  
  // Modal State
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [creditsAmount, setCreditsAmount] = useState(10);
  const [creditsReason, setCreditsReason] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isUserAdmin = user?.is_admin || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // API Helper
  const adminFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const accessToken = getToken();
    
    if (!accessToken) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Erreur serveur' }));
      throw new Error(error.detail || 'Erreur');
    }
    
    return response.json();
  }, []);

  // Load Stats
  const loadStats = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/stats');
      setStats(data);
    } catch (err: any) {
      console.error('Stats error:', err);
    }
  }, [adminFetch]);

  // Load Users
  const loadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: usersPage.toString(),
        per_page: '20',
      });
      if (usersSearch) params.append('search', usersSearch);
      if (usersPlanFilter) params.append('plan', usersPlanFilter);
      
      const data = await adminFetch(`/api/admin/users?${params}`);
      setUsers(data.users);
      setUsersTotal(data.total);
    } catch (err: any) {
      console.error('Users error:', err);
    }
  }, [adminFetch, usersPage, usersSearch, usersPlanFilter]);

  // Load Logs
  const loadLogs = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/logs');
      setLogs(data.logs);
    } catch (err: any) {
      console.error('Logs error:', err);
    }
  }, [adminFetch]);

  // Initial Load
  useEffect(() => {
    if (isUserAdmin) {
      setLoading(true);
      Promise.all([loadStats(), loadUsers(), loadLogs()])
        .finally(() => setLoading(false));
    }
  }, [isUserAdmin, loadStats, loadUsers, loadLogs]);

  // Reload users on filter change
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [usersPage, usersSearch, usersPlanFilter, activeTab, loadUsers]);

  // Update User Plan
  const handleUpdatePlan = async () => {
    if (!selectedUser || !editPlan) return;
    setActionLoading(true);
    
    try {
      await adminFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ plan: editPlan }),
      });
      
      await loadUsers();
      await loadStats();
      setShowUserModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Add Credits
  const handleAddCredits = async () => {
    if (!selectedUser || creditsAmount <= 0) return;
    setActionLoading(true);
    
    try {
      await adminFetch(`/api/admin/users/${selectedUser.id}/credits`, {
        method: 'POST',
        body: JSON.stringify({ 
          amount: creditsAmount, 
          reason: creditsReason || 'Admin bonus' 
        }),
      });
      
      await loadUsers();
      setShowCreditsModal(false);
      setSelectedUser(null);
      setCreditsAmount(10);
      setCreditsReason('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: number) => {
    if (!confirm(language === 'fr'
      ? 'Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.'
      : 'Are you sure you want to delete this user? This action is irreversible.')) {
      return;
    }

    setActionLoading(true);
    try {
      await adminFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      showToast(language === 'fr' ? 'Utilisateur supprimé' : 'User deleted', 'success');
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      showToast(err.message || (language === 'fr' ? 'Erreur lors de la suppression' : 'Error deleting user'), 'error');
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Access Denied
  if (!isUserAdmin) {
    return (
      <div className="min-h-screen bg-bg-primary relative">
        {/* Background handled by CSS design system v8.0 */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'}`}>
          <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="font-semibold text-2xl mb-4">
                {language === 'fr' ? 'Accès refusé' : 'Access denied'}
              </h1>
              <p className="text-text-secondary mb-8">
                {language === 'fr'
                  ? 'Vous n\'avez pas les droits nécessaires pour accéder à cette page.'
                  : 'You do not have the necessary rights to access this page.'}
              </p>
              <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
                {language === 'fr' ? 'Retour au tableau de bord' : 'Back to dashboard'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(usersTotal / 20);

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="tech" />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'}`}>
        <div className="min-h-screen p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Header */}
            <header className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-6 h-6 text-accent-primary" />
                <h1 className="font-semibold text-2xl">Administration</h1>
              </div>
              <p className="text-text-secondary text-sm">
                {language === 'fr' 
                  ? 'Gérez les utilisateurs et consultez les statistiques.'
                  : 'Manage users and view statistics.'}
              </p>
            </header>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700">{error}</span>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-border-subtle">
              {[
                { id: 'dashboard', label: language === 'fr' ? 'Tableau de bord' : 'Dashboard', icon: BarChart3 },
                { id: 'users', label: language === 'fr' ? 'Utilisateurs' : 'Users', icon: Users },
                { id: 'stats', label: language === 'fr' ? 'Statistiques' : 'Statistics', icon: TrendingUp },
                { id: 'logs', label: 'Logs', icon: FileText },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-accent-primary text-accent-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="card p-12 text-center">
                <DeepSightSpinner size="md" />
                <p className="text-text-tertiary">{language === 'fr' ? 'Chargement...' : 'Loading...'}</p>
              </div>
            ) : (
              <>
                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && stats && (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="card p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <p className="text-2xl font-semibold font-semibold">{stats.total_users}</p>
                        <p className="text-sm text-text-tertiary">
                          {language === 'fr' ? 'Utilisateurs' : 'Users'}
                        </p>
                      </div>

                      <div className="card p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-green-600" />
                          </div>
                        </div>
                        <p className="text-2xl font-semibold font-semibold">{stats.new_users_today}</p>
                        <p className="text-sm text-text-tertiary">
                          {language === 'fr' ? 'Nouveaux aujourd\'hui' : 'New today'}
                        </p>
                      </div>

                      <div className="card p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-purple-600" />
                          </div>
                        </div>
                        <p className="text-2xl font-semibold font-semibold">{stats.total_videos}</p>
                        <p className="text-sm text-text-tertiary">
                          {language === 'fr' ? 'Vidéos analysées' : 'Videos analyzed'}
                        </p>
                      </div>

                      <div className="card p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-amber-600" />
                          </div>
                        </div>
                        <p className="text-2xl font-semibold font-semibold">€{stats.revenue_estimate.toFixed(0)}</p>
                        <p className="text-sm text-text-tertiary">
                          {language === 'fr' ? 'Revenus (mois)' : 'Revenue (month)'}
                        </p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="card p-5">
                        <h3 className="font-semibold mb-4">{language === 'fr' ? 'Activité récente' : 'Recent activity'}</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary">{language === 'fr' ? 'Nouveaux cette semaine' : 'New this week'}</span>
                            <span className="font-medium text-green-600">+{stats.new_users_week}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary">{language === 'fr' ? 'Abonnements actifs' : 'Active subscriptions'}</span>
                            <span className="font-medium">{stats.active_subscriptions}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary">{language === 'fr' ? 'Mots générés' : 'Words generated'}</span>
                            <span className="font-medium">{stats.total_words.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="card p-5">
                        <h3 className="font-semibold mb-4">{language === 'fr' ? 'Actions rapides' : 'Quick actions'}</h3>
                        <div className="space-y-2">
                          <button 
                            onClick={() => setActiveTab('users')}
                            className="w-full p-3 rounded-lg bg-bg-tertiary hover:bg-bg-hover transition-colors text-left flex items-center gap-3"
                          >
                            <Users className="w-5 h-5 text-accent-primary" />
                            <span>{language === 'fr' ? 'Gérer les utilisateurs' : 'Manage users'}</span>
                          </button>
                          <button 
                            onClick={() => { loadStats(); loadUsers(); loadLogs(); }}
                            className="w-full p-3 rounded-lg bg-bg-tertiary hover:bg-bg-hover transition-colors text-left flex items-center gap-3"
                          >
                            <RefreshCw className="w-5 h-5 text-accent-primary" />
                            <span>{language === 'fr' ? 'Rafraîchir les données' : 'Refresh data'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                  <div className="space-y-4">
                    {/* Search & Filters */}
                    <div className="card p-4">
                      <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px] relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                          <input
                            type="text"
                            placeholder={language === 'fr' ? 'Rechercher par email ou nom...' : 'Search by email or name...'}
                            value={usersSearch}
                            onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(1); }}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border-subtle bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
                          />
                        </div>
                        <select
                          value={usersPlanFilter}
                          onChange={(e) => { setUsersPlanFilter(e.target.value); setUsersPage(1); }}
                          className="px-4 py-2 rounded-lg border border-border-subtle bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
                        >
                          <option value="">{language === 'fr' ? 'Tous les plans' : 'All plans'}</option>
                          <option value="free">Free</option>
                          <option value="student">Student (€2.99)</option>
                          <option value="starter">Starter (€5.99)</option>
                          <option value="pro">Pro (€12.99)</option>
                          <option value="team">Team (€29.99)</option>
                        </select>
                        <span className="text-text-secondary self-center">
                          {usersTotal} {language === 'fr' ? 'utilisateurs' : 'users'}
                        </span>
                      </div>
                    </div>

                    {/* Users Table */}
                    <div className="card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-bg-tertiary">
                            <tr>
                              <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">
                                {language === 'fr' ? 'Utilisateur' : 'User'}
                              </th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Plan</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">
                                {language === 'fr' ? 'Crédits' : 'Credits'}
                              </th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">
                                {language === 'fr' ? 'Vidéos' : 'Videos'}
                              </th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">
                                {language === 'fr' ? 'Inscription' : 'Joined'}
                              </th>
                              <th className="text-right px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-subtle">
                            {users.map((u) => {
                              const planConfig = PLAN_CONFIG[u.plan] || PLAN_CONFIG.free;
                              return (
                                <tr key={u.id} className="hover:bg-bg-hover transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-accent-primary-muted flex items-center justify-center text-accent-primary font-medium text-sm">
                                        {u.email.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="font-medium text-text-primary flex items-center gap-2">
                                          {u.username}
                                          {u.is_admin && <Crown className="w-3 h-3 text-amber-500" />}
                                        </p>
                                        <p className="text-xs text-text-tertiary flex items-center gap-1">
                                          <Mail className="w-3 h-3" />
                                          {u.email}
                                          {u.email_verified && <Check className="w-3 h-3 text-green-500" />}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${planConfig.bg} ${planConfig.color}`}>
                                      {planConfig.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="font-medium">{u.credits}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span>{u.total_videos}</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-text-secondary">
                                    {formatDate(u.created_at)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => { setSelectedUser(u); setEditPlan(u.plan); setShowUserModal(true); }}
                                        className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
                                        title={language === 'fr' ? 'Modifier le plan' : 'Edit plan'}
                                      >
                                        <Edit2 className="w-4 h-4 text-text-secondary" />
                                      </button>
                                      <button
                                        onClick={() => { setSelectedUser(u); setShowCreditsModal(true); }}
                                        className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
                                        title={language === 'fr' ? 'Ajouter des crédits' : 'Add credits'}
                                      >
                                        <Plus className="w-4 h-4 text-green-600" />
                                      </button>
                                      {!u.is_admin && (
                                        <button
                                          onClick={() => handleDeleteUser(u.id)}
                                          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                          title={language === 'fr' ? 'Supprimer' : 'Delete'}
                                        >
                                          <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
                          <button
                            onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                            disabled={usersPage === 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            {language === 'fr' ? 'Précédent' : 'Previous'}
                          </button>
                          <span className="text-sm text-text-secondary">
                            Page {usersPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setUsersPage(p => Math.min(totalPages, p + 1))}
                            disabled={usersPage === totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {language === 'fr' ? 'Suivant' : 'Next'}
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && stats && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="card p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="font-semibold">{language === 'fr' ? 'Utilisateurs' : 'Users'}</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-text-secondary">Total</span><span className="font-medium">{stats.total_users}</span></div>
                        <div className="flex justify-between"><span className="text-text-secondary">{language === 'fr' ? 'Aujourd\'hui' : 'Today'}</span><span className="font-medium text-green-600">+{stats.new_users_today}</span></div>
                        <div className="flex justify-between"><span className="text-text-secondary">{language === 'fr' ? 'Cette semaine' : 'This week'}</span><span className="font-medium text-green-600">+{stats.new_users_week}</span></div>
                      </div>
                    </div>

                    <div className="card p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-purple-600" />
                        </div>
                        <h3 className="font-semibold">{language === 'fr' ? 'Contenu' : 'Content'}</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-text-secondary">{language === 'fr' ? 'Vidéos' : 'Videos'}</span><span className="font-medium">{stats.total_videos}</span></div>
                        <div className="flex justify-between"><span className="text-text-secondary">{language === 'fr' ? 'Mots' : 'Words'}</span><span className="font-medium">{stats.total_words.toLocaleString()}</span></div>
                      </div>
                    </div>

                    <div className="card p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="font-semibold">{language === 'fr' ? 'Revenus' : 'Revenue'}</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-text-secondary">{language === 'fr' ? 'Abonnements' : 'Subscriptions'}</span><span className="font-medium">{stats.active_subscriptions}</span></div>
                        <div className="flex justify-between"><span className="text-text-secondary">{language === 'fr' ? 'Estimé/mois' : 'Est./month'}</span><span className="font-medium text-green-600">€{stats.revenue_estimate.toFixed(2)}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Logs Tab */}
                {activeTab === 'logs' && (
                  <div className="card overflow-hidden">
                    <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                      <h3 className="font-semibold">{language === 'fr' ? 'Logs d\'administration' : 'Admin Logs'}</h3>
                      <button onClick={loadLogs} className="p-2 rounded-lg hover:bg-bg-hover">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="divide-y divide-border-subtle max-h-[500px] overflow-y-auto">
                      {logs.length === 0 ? (
                        <p className="p-6 text-center text-text-tertiary">
                          {language === 'fr' ? 'Aucun log disponible' : 'No logs available'}
                        </p>
                      ) : (
                        logs.map((log) => (
                          <div key={log.id} className="p-4 hover:bg-bg-hover">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center">
                                <FileText className="w-4 h-4 text-text-tertiary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{log.action}</p>
                                <p className="text-xs text-text-tertiary">{log.details}</p>
                              </div>
                              <span className="text-xs text-text-tertiary">{formatDate(log.created_at)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Edit Plan Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-primary rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">{language === 'fr' ? 'Modifier le plan' : 'Edit Plan'}</h3>
              <button onClick={() => setShowUserModal(false)} className="p-2 rounded-lg hover:bg-bg-hover">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-text-secondary mb-1">{language === 'fr' ? 'Utilisateur' : 'User'}</p>
              <p className="font-medium">{selectedUser.email}</p>
            </div>
            
            <div className="mb-6">
              <label className="text-sm text-text-secondary mb-2 block">
                {language === 'fr' ? 'Nouveau plan' : 'New plan'}
              </label>
              <select
                value={editPlan}
                onChange={(e) => setEditPlan(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border-subtle bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
              >
                <option value="free">Free (€0)</option>
                <option value="student">Student (€2.99/mois)</option>
                <option value="starter">Starter (€5.99/mois)</option>
                <option value="pro">Pro (€12.99/mois)</option>
                <option value="team">Team (€29.99/mois)</option>
                <option value="unlimited">Unlimited (Admin)</option>
              </select>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowUserModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border-subtle hover:bg-bg-hover transition-colors"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleUpdatePlan}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-accent-primary text-white hover:bg-accent-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <DeepSightSpinnerMicro />}
                {language === 'fr' ? 'Enregistrer' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credits Modal */}
      {showCreditsModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-primary rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">{language === 'fr' ? 'Ajouter des crédits' : 'Add Credits'}</h3>
              <button onClick={() => setShowCreditsModal(false)} className="p-2 rounded-lg hover:bg-bg-hover">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-text-secondary mb-1">{language === 'fr' ? 'Utilisateur' : 'User'}</p>
              <p className="font-medium">{selectedUser.email}</p>
              <p className="text-sm text-text-tertiary">
                {language === 'fr' ? 'Crédits actuels' : 'Current credits'}: {selectedUser.credits}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="text-sm text-text-secondary mb-2 block">
                {language === 'fr' ? 'Nombre de crédits' : 'Number of credits'}
              </label>
              <input
                type="number"
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(parseInt(e.target.value) || 0)}
                min="1"
                className="w-full px-4 py-2 rounded-lg border border-border-subtle bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
              />
            </div>
            
            <div className="mb-6">
              <label className="text-sm text-text-secondary mb-2 block">
                {language === 'fr' ? 'Raison (optionnel)' : 'Reason (optional)'}
              </label>
              <input
                type="text"
                value={creditsReason}
                onChange={(e) => setCreditsReason(e.target.value)}
                placeholder={language === 'fr' ? 'Ex: Bonus de bienvenue' : 'Ex: Welcome bonus'}
                className="w-full px-4 py-2 rounded-lg border border-border-subtle bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreditsModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border-subtle hover:bg-bg-hover transition-colors"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleAddCredits}
                disabled={actionLoading || creditsAmount <= 0}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <DeepSightSpinnerMicro />}
                {language === 'fr' ? 'Ajouter' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
      {ToastComponent}
    </div>
  );
};

export default AdminPage;
