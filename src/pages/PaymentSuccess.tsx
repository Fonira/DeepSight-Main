/**
 * DEEP SIGHT v5.0 — Payment Success Page
 * ✅ Clear le cache, force le refresh, affiche le nouveau plan
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { CheckCircle, ArrowRight, Sparkles, Loader2, Crown, RefreshCw } from 'lucide-react';
import DoodleBackground from '../components/DoodleBackground';

// Clear le cache utilisateur dans localStorage
function clearUserCache() {
  try {
    localStorage.removeItem('cached_user');
    console.log('🗑️ User cache cleared');
  } catch (err) {
    console.error('Error clearing cache:', err);
  }
}

export const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const { language } = useLanguage();
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(true);

  // Récupérer le plan depuis l'URL si disponible
  const planFromUrl = searchParams.get('plan');

  useEffect(() => {
    // ✅ IMPORTANT: Clear le cache immédiatement au montage
    clearUserCache();
    
    // Puis lancer le refresh
    const attemptRefresh = async () => {
      setIsRefreshing(true);
      try {
        // Attendre 2 secondes pour le webhook Stripe
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Forcer le refresh (bypass cache + debounce)
        await refreshUser(true);
        
        console.log('✅ User refreshed, plan:', user?.plan);
      } catch (err) {
        console.error('Refresh failed:', err);
      } finally {
        setIsRefreshing(false);
      }
    };

    attemptRefresh();
  }, []); // ✅ Ne dépend de rien, s'exécute une seule fois

  // Retry manuel si nécessaire
  const handleManualRefresh = async () => {
    clearUserCache();
    setIsRefreshing(true);
    try {
      await refreshUser(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Déterminer le plan affiché (priorité: user.plan si pas 'free' > URL)
  const planLabels: Record<string, string> = {
    free: 'Découverte',
    starter: 'Starter',
    pro: 'Pro',
    expert: 'Expert',
  };

  const planColors: Record<string, string> = {
    free: 'text-text-tertiary',
    starter: 'text-emerald-500',
    pro: 'text-amber-500',
    expert: 'text-purple-500',
  };

  const planEmojis: Record<string, string> = {
    free: '🆓',
    starter: '⚡',
    pro: '⭐',
    expert: '👑',
  };

  // Le plan à afficher : user.plan s'il n'est plus 'free', sinon URL, sinon null
  const displayPlan = (user?.plan && user.plan !== 'free') 
    ? user.plan 
    : planFromUrl || null;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 relative">
      <DoodleBackground variant="default" density={40} />
      <div className="max-w-md w-full text-center relative z-10">
        <div className="card p-10">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>

          {/* Title */}
          <h1 className="font-display text-2xl text-text-primary mb-3">
            {language === 'fr' ? 'Paiement réussi !' : 'Payment successful!'}
          </h1>

          {/* Plan Badge */}
          {displayPlan ? (
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-xl">{planEmojis[displayPlan] || '⭐'}</span>
              <span className={`font-semibold text-lg ${planColors[displayPlan] || 'text-amber-500'}`}>
                Plan {planLabels[displayPlan] || displayPlan}
              </span>
              {isRefreshing && (
                <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mb-4">
              {isRefreshing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span className="text-text-secondary">
                    {language === 'fr' ? 'Activation en cours...' : 'Activating...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span className="text-text-secondary">
                    {language === 'fr' ? 'Abonnement activé' : 'Subscription activated'}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Description */}
          <p className="text-text-secondary mb-8">
            {language === 'fr'
              ? 'Votre abonnement est maintenant actif. Profitez de toutes les fonctionnalités Deep Sight.'
              : 'Your subscription is now active. Enjoy all Deep Sight features.'}
          </p>

          {/* Features unlocked */}
          <div className="bg-bg-tertiary rounded-xl p-4 mb-8 border border-border-subtle">
            <div className="flex items-center gap-2 text-accent-primary mb-3">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">
                {language === 'fr' ? 'Fonctionnalités débloquées' : 'Features unlocked'}
              </span>
            </div>
            <ul className="text-sm text-text-secondary text-left space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                {language === 'fr' ? 'Crédits mensuels' : 'Monthly credits'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                {language === 'fr' ? 'Modèles IA avancés' : 'Advanced AI models'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                {language === 'fr' ? 'Export professionnel' : 'Professional export'}
              </li>
            </ul>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {language === 'fr' ? 'Commencer à analyser' : 'Start analyzing'}
              <ArrowRight className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => navigate('/usage')}
              className="btn btn-secondary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
            >
              {language === 'fr' ? 'Voir mon compte' : 'View my account'}
            </button>
          </div>

          {/* Refresh manuel si le plan n'est pas affiché après refresh */}
          {!displayPlan && !isRefreshing && (
            <button
              onClick={handleManualRefresh}
              className="mt-4 text-xs text-text-tertiary hover:text-text-secondary flex items-center gap-1 mx-auto"
            >
              <RefreshCw className="w-3 h-3" />
              {language === 'fr' ? 'Actualiser le statut' : 'Refresh status'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
