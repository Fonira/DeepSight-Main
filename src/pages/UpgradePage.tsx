/**
 * DEEP SIGHT v6.0 — Upgrade Page
 * Page d'abonnement avec UPGRADE et DOWNGRADE
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { 
  Check, X, Sparkles, Zap, Star, Crown, Loader2, 
  ArrowRight, ArrowDown, ArrowUp, AlertCircle, RefreshCw,
  CreditCard, Calendar
} from 'lucide-react';
import { billingApi } from '../services/api';

const getPlans = (language: string) => [
  {
    id: "free",
    name: "Découverte",
    price: "0",
    period: language === 'fr' ? '/mois' : '/month',
    description: language === 'fr' ? 'Pour explorer' : 'To explore',
    features: [
      { text: language === 'fr' ? '5 analyses/mois' : '5 analyses/month', included: true },
      { text: language === 'fr' ? 'Résumés structurés' : 'Structured summaries', included: true },
      { text: language === 'fr' ? 'Chat limité' : 'Limited chat', included: true },
      { text: 'Fact-checking', included: false },
      { text: language === 'fr' ? 'Recherche web' : 'Web search', included: false },
      { text: 'Export PDF', included: false },
    ],
    icon: Zap,
    canSubscribe: false,
    order: 0,
  },
  {
    id: "starter",
    name: "Starter",
    price: "4.99",
    period: "€",
    description: language === 'fr' ? 'Pour les réguliers' : 'For regular users',
    features: [
      { text: language === 'fr' ? '50 analyses/mois' : '50 analyses/month', included: true },
      { text: language === 'fr' ? 'Résumés avancés' : 'Advanced summaries', included: true },
      { text: language === 'fr' ? 'Chat illimité' : 'Unlimited chat', included: true },
      { text: 'Fact-checking', included: true },
      { text: language === 'fr' ? 'Recherche web' : 'Web search', included: false },
      { text: 'Export PDF & Markdown', included: true },
    ],
    icon: Star,
    canSubscribe: true,
    order: 1,
  },
  {
    id: "pro",
    name: "Pro",
    price: "9.99",
    period: "€",
    description: language === 'fr' ? 'Pour les power users' : 'For power users',
    popular: true,
    features: [
      { text: language === 'fr' ? '200 analyses/mois' : '200 analyses/month', included: true },
      { text: language === 'fr' ? 'Playlists & corpus' : 'Playlists & corpus', included: true },
      { text: language === 'fr' ? 'Recherche web (Perplexity)' : 'Web search (Perplexity)', included: true },
      { text: language === 'fr' ? 'Fact-checking avancé' : 'Advanced fact-checking', included: true },
      { text: language === 'fr' ? 'Tous les exports' : 'All exports', included: true },
      { text: language === 'fr' ? 'Support prioritaire' : 'Priority support', included: true },
    ],
    icon: Crown,
    canSubscribe: true,
    order: 2,
  },
  {
    id: "expert",
    name: "Expert",
    price: "14.99",
    period: "€",
    description: language === 'fr' ? 'Pour les organisations' : 'For organizations',
    features: [
      { text: language === 'fr' ? 'Analyses illimitées' : 'Unlimited analyses', included: true },
      { text: 'API access', included: true },
      { text: language === 'fr' ? 'Corpus personnalisés' : 'Custom corpus', included: true },
      { text: language === 'fr' ? 'Intégrations avancées' : 'Advanced integrations', included: true },
      { text: language === 'fr' ? 'Support dédié' : 'Dedicated support', included: true },
      { text: language === 'fr' ? 'Formation incluse' : 'Training included', included: true },
    ],
    icon: Sparkles,
    canSubscribe: true,
    order: 3,
  },
];

interface SubscriptionStatus {
  plan: string;
  has_subscription: boolean;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  next_plan: string | null;
}

export const UpgradePage: React.FC = () => {
  const { user, refreshUser, isLoading: authLoading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{ plan: string; action: 'upgrade' | 'downgrade' } | null>(null);

  // Charger les données au montage
  useEffect(() => {
    const loadData = async () => {
      setRefreshing(true);
      try {
        await refreshUser(true);
        // Charger le statut d'abonnement
        const status = await billingApi.getSubscriptionStatus();
        setSubscriptionStatus(status);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setRefreshing(false);
      }
    };
    
    loadData();
  }, []);

  const plans = getPlans(language);
  const currentPlan = user?.plan || 'free';
  const currentPlanOrder = plans.find(p => p.id === currentPlan)?.order || 0;

  const handleChangePlan = async (newPlanId: string) => {
    const newPlan = plans.find(p => p.id === newPlanId);
    if (!newPlan || newPlanId === currentPlan) return;
    
    const isUpgrade = newPlan.order > currentPlanOrder;
    
    // Afficher la modal de confirmation pour downgrade
    if (!isUpgrade && currentPlan !== 'free') {
      setShowConfirmModal({ plan: newPlanId, action: 'downgrade' });
      return;
    }
    
    await executeChangePlan(newPlanId, isUpgrade ? 'upgrade' : 'downgrade');
  };

  const executeChangePlan = async (newPlanId: string, action: 'upgrade' | 'downgrade') => {
    setLoading(newPlanId);
    setError(null);
    setSuccess(null);
    setShowConfirmModal(null);
    
    try {
      console.log(`🔄 Changing plan to: ${newPlanId} (${action})`);
      
      const response = await billingApi.changePlan(newPlanId);
      
      console.log('📦 Change plan response:', response);
      
      if (response.action === 'checkout_required' && response.checkout_url) {
        // Redirection vers Stripe Checkout
        window.location.href = response.checkout_url;
        return;
      }
      
      // Succès
      setSuccess(response.message);
      
      // Refresh user data
      await refreshUser(true);
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
      
    } catch (err: any) {
      console.error('❌ Change plan error:', err);
      setError(err.message || (language === 'fr' ? 'Une erreur est survenue.' : 'An error occurred.'));
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    setLoading('cancel');
    setError(null);
    
    try {
      const response = await billingApi.cancelSubscription();
      setSuccess(response.message);
      await refreshUser(true);
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleReactivateSubscription = async () => {
    setLoading('reactivate');
    setError(null);
    
    try {
      const response = await billingApi.reactivateSubscription();
      setSuccess(response.message);
      await refreshUser(true);
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading('portal');
    try {
      const response = await billingApi.getPortalUrl();
      if (response.portal_url) {
        window.location.href = response.portal_url;
      }
    } catch (err: any) {
      console.error('Portal error:', err);
      setError(language === 'fr' ? 'Erreur lors de l\'accès au portail.' : 'Error accessing portal.');
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="default" density={50} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className={`transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}>
        <div className="min-h-screen p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            
            {/* Header */}
            <header className="text-center mb-8">
              <h1 className="font-display text-display-sm mb-4">
                {language === 'fr' ? 'Gérer votre abonnement' : 'Manage your subscription'}
              </h1>
              <p className="text-text-secondary max-w-xl mx-auto">
                {language === 'fr' 
                  ? 'Choisissez le plan qui correspond à vos besoins. Vous pouvez changer à tout moment.'
                  : 'Choose the plan that fits your needs. You can change anytime.'}
              </p>
            </header>

            {/* Current Subscription Status */}
            {subscriptionStatus && currentPlan !== 'free' && (
              <div className="card p-4 mb-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-accent-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">
                      {language === 'fr' ? 'Plan actuel' : 'Current plan'}
                    </p>
                    <p className="font-semibold text-text-primary capitalize flex items-center gap-2">
                      {currentPlan}
                      {subscriptionStatus.cancel_at_period_end && (
                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                          {language === 'fr' ? 'Annulation prévue' : 'Cancellation scheduled'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                {subscriptionStatus.current_period_end && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Calendar className="w-4 h-4" />
                    {subscriptionStatus.cancel_at_period_end 
                      ? (language === 'fr' ? 'Fin le' : 'Ends on')
                      : (language === 'fr' ? 'Prochain renouvellement' : 'Next renewal')}
                    : {formatDate(subscriptionStatus.current_period_end)}
                  </div>
                )}
                
                <div className="flex gap-2">
                  {subscriptionStatus.cancel_at_period_end ? (
                    <button
                      onClick={handleReactivateSubscription}
                      disabled={loading === 'reactivate'}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      {loading === 'reactivate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {language === 'fr' ? 'Réactiver' : 'Reactivate'}
                    </button>
                  ) : (
                    <button
                      onClick={handleManageBilling}
                      disabled={loading === 'portal'}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      {loading === 'portal' && <Loader2 className="w-4 h-4 animate-spin" />}
                      {language === 'fr' ? 'Gérer la facturation' : 'Manage billing'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-start gap-3">
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                {success}
              </div>
            )}

            {/* Plans Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isCurrent = plan.id === currentPlan;
                const isHigher = plan.order > currentPlanOrder;
                const isLower = plan.order < currentPlanOrder;
                const canChange = plan.canSubscribe && !isCurrent;

                return (
                  <div
                    key={plan.id}
                    className={`card p-6 relative transition-all ${
                      plan.popular ? 'border-accent-primary ring-1 ring-accent-primary/20' : ''
                    } ${isCurrent ? 'border-accent-success ring-1 ring-accent-success/20' : ''}`}
                  >
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent-primary text-white text-xs font-medium">
                        {language === 'fr' ? 'Recommandé' : 'Recommended'}
                      </div>
                    )}

                    {isCurrent && (
                      <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-accent-success text-white text-xs font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {language === 'fr' ? 'Actuel' : 'Current'}
                      </div>
                    )}

                    <div className="w-12 h-12 rounded-xl bg-accent-primary-muted flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-accent-primary" />
                    </div>

                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-text-tertiary mb-4">
                      {plan.description}
                    </p>

                    <div className="mb-6">
                      <span className="text-3xl font-display font-semibold text-text-primary">
                        {plan.price}
                      </span>
                      <span className="text-text-tertiary text-sm ml-1">
                        {plan.period}
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-3 text-sm ${
                            feature.included ? 'text-text-secondary' : 'text-text-muted line-through'
                          }`}
                        >
                          {feature.included ? (
                            <Check className="w-4 h-4 text-accent-success mt-0.5 flex-shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                          )}
                          <span>{feature.text}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleChangePlan(plan.id)}
                      disabled={isCurrent || loading === plan.id || !canChange}
                      className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-accent-success/20 text-accent-success cursor-default'
                          : isHigher && canChange
                          ? 'btn-primary'
                          : isLower && canChange
                          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                          : 'btn-secondary opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {loading === plan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrent ? (
                        <>
                          <Check className="w-4 h-4" />
                          {language === 'fr' ? 'Plan actuel' : 'Current plan'}
                        </>
                      ) : isHigher && canChange ? (
                        <>
                          <ArrowUp className="w-4 h-4" />
                          {language === 'fr' ? 'Passer à' : 'Upgrade to'} {plan.name}
                        </>
                      ) : isLower && canChange ? (
                        <>
                          <ArrowDown className="w-4 h-4" />
                          {language === 'fr' ? 'Rétrograder vers' : 'Downgrade to'} {plan.name}
                        </>
                      ) : (
                        plan.id === 'free' ? (language === 'fr' ? 'Plan gratuit' : 'Free plan') : '-'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Cancel Subscription */}
            {currentPlan !== 'free' && !subscriptionStatus?.cancel_at_period_end && (
              <div className="mt-12 text-center">
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading === 'cancel'}
                  className="text-sm text-text-tertiary hover:text-red-400 transition-colors flex items-center gap-2 mx-auto"
                >
                  {loading === 'cancel' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {language === 'fr' ? 'Annuler mon abonnement' : 'Cancel my subscription'}
                </button>
              </div>
            )}

            {/* FAQ */}
            <div className="mt-12 card p-6">
              <h3 className="font-semibold text-text-primary mb-4">
                {language === 'fr' ? 'Questions fréquentes' : 'Frequently asked questions'}
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-text-primary font-medium">
                    {language === 'fr' ? 'Comment fonctionne l\'upgrade ?' : 'How does upgrade work?'}
                  </p>
                  <p className="text-text-secondary mt-1">
                    {language === 'fr' 
                      ? 'Lors d\'un upgrade, vous êtes facturé immédiatement de la différence au prorata. Vos nouveaux avantages sont disponibles instantanément.'
                      : 'When you upgrade, you are immediately charged the prorated difference. Your new benefits are available instantly.'}
                  </p>
                </div>
                <div>
                  <p className="text-text-primary font-medium">
                    {language === 'fr' ? 'Comment fonctionne le downgrade ?' : 'How does downgrade work?'}
                  </p>
                  <p className="text-text-secondary mt-1">
                    {language === 'fr' 
                      ? 'Lors d\'un downgrade, vous conservez vos avantages actuels jusqu\'à la fin de votre période de facturation. Le nouveau plan prendra effet au prochain renouvellement.'
                      : 'When you downgrade, you keep your current benefits until the end of your billing period. The new plan will take effect at the next renewal.'}
                  </p>
                </div>
                <div>
                  <p className="text-text-primary font-medium">
                    {language === 'fr' ? 'Puis-je annuler à tout moment ?' : 'Can I cancel anytime?'}
                  </p>
                  <p className="text-text-secondary mt-1">
                    {language === 'fr' 
                      ? 'Oui, vous pouvez annuler à tout moment. Vous conserverez l\'accès jusqu\'à la fin de votre période payée.'
                      : 'Yes, you can cancel anytime. You will keep access until the end of your paid period.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="mt-8 text-center">
              <p className="text-text-tertiary text-sm">
                {language === 'fr' 
                  ? 'Des questions ? Contactez-nous à '
                  : 'Questions? Contact us at '}
                <a href="mailto:contact@deepsightsynthesis.com" className="text-accent-primary hover:underline">
                  contact@deepsightsynthesis.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de confirmation pour downgrade */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {language === 'fr' ? 'Confirmer le changement' : 'Confirm change'}
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              {language === 'fr' 
                ? `Êtes-vous sûr de vouloir passer au plan ${plans.find(p => p.id === showConfirmModal.plan)?.name} ? Vous conserverez vos avantages actuels jusqu'à la fin de votre période de facturation.`
                : `Are you sure you want to switch to the ${plans.find(p => p.id === showConfirmModal.plan)?.name} plan? You will keep your current benefits until the end of your billing period.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="btn-secondary"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={() => executeChangePlan(showConfirmModal.plan, showConfirmModal.action)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {language === 'fr' ? 'Confirmer' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradePage;
