/**
 * DEEP SIGHT v6.0 — Payment Success Page
 * ✅ Confirme le paiement via API + Affiche le nouveau plan
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { billingApi } from '../services/api';
import { CheckCircle, ArrowRight, Sparkles, Loader2, Crown, RefreshCw, AlertCircle, XCircle } from 'lucide-react';
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
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [confirmedPlan, setConfirmedPlan] = useState<string | null>(null);
  const [creditsAdded, setCreditsAdded] = useState<number>(0);

  // Récupérer les params de l'URL
  const sessionId = searchParams.get('session_id');
  const planFromUrl = searchParams.get('plan');

  useEffect(() => {
    const confirmPayment = async () => {
      // Clear le cache immédiatement
      clearUserCache();
      
      if (!sessionId) {
        console.log('⚠️ No session_id in URL, skipping confirmation');
        // Pas de session_id, juste refresh l'utilisateur
        await refreshUser(true);
        setStatus('success');
        setConfirmedPlan(planFromUrl);
        return;
      }

      console.log('🔍 Confirming checkout session:', sessionId);

      try {
        // Appeler l'API pour confirmer le checkout
        const result = await billingApi.confirmCheckout(sessionId);
        
        console.log('✅ Confirmation result:', result);

        if (result.success) {
          setStatus('success');
          setConfirmedPlan(result.plan || planFromUrl);
          setCreditsAdded(result.credits_added || 0);
          setMessage(result.message);
          
          // Refresh l'utilisateur pour avoir les données à jour
          await refreshUser(true);
        } else {
          // Paiement pas encore complété
          setStatus('loading');
          setMessage(result.message || 'Paiement en cours de traitement...');
          
          // Réessayer après 3 secondes
          setTimeout(async () => {
            try {
              const retryResult = await billingApi.confirmCheckout(sessionId);
              if (retryResult.success) {
                setStatus('success');
                setConfirmedPlan(retryResult.plan || planFromUrl);
                setCreditsAdded(retryResult.credits_added || 0);
                await refreshUser(true);
              } else {
                setStatus('error');
                setMessage('Le paiement n\'a pas pu être confirmé. Contactez le support.');
              }
            } catch {
              setStatus('error');
            }
          }, 3000);
        }
      } catch (err: any) {
        console.error('❌ Confirmation error:', err);
        setStatus('error');
        setMessage(err.message || 'Erreur lors de la confirmation');
        
        // En cas d'erreur, on affiche quand même le plan de l'URL
        if (planFromUrl) {
          setConfirmedPlan(planFromUrl);
        }
      }
    };

    confirmPayment();
  }, [sessionId]);

  // Retry manuel
  const handleRetry = async () => {
    setStatus('loading');
    clearUserCache();
    
    if (sessionId) {
      try {
        const result = await billingApi.confirmCheckout(sessionId);
        if (result.success) {
          setStatus('success');
          setConfirmedPlan(result.plan || planFromUrl);
          setCreditsAdded(result.credits_added || 0);
          await refreshUser(true);
        } else {
          setStatus('error');
          setMessage(result.message);
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message);
      }
    } else {
      await refreshUser(true);
      setStatus('success');
    }
  };

  // Labels et couleurs des plans
  const planLabels: Record<string, string> = {
    free: 'Découverte',
    starter: 'Starter',
    pro: 'Pro',
    expert: 'Expert',
  };

  const planColors: Record<string, string> = {
    free: 'text-text-tertiary',
    starter: 'text-blue-500',
    pro: 'text-violet-500',
    expert: 'text-amber-500',
  };

  const planEmojis: Record<string, string> = {
    free: '🆓',
    starter: '⭐',
    pro: '👑',
    expert: '💎',
  };

  const planBgColors: Record<string, string> = {
    free: 'bg-gray-500/10',
    starter: 'bg-blue-500/10',
    pro: 'bg-violet-500/10',
    expert: 'bg-amber-500/10',
  };

  // Plan à afficher
  const displayPlan = confirmedPlan || user?.plan || planFromUrl;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 relative">
      <DoodleBackground variant="default" density={40} />
      <div className="max-w-md w-full text-center relative z-10">
        <div className="card p-10">
          
          {/* Loading State */}
          {status === 'loading' && (
            <>
              <div className="w-20 h-20 rounded-full bg-accent-primary/10 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-accent-primary animate-spin" />
              </div>
              <h1 className="font-display text-2xl text-text-primary mb-3">
                {language === 'fr' ? 'Confirmation en cours...' : 'Confirming payment...'}
              </h1>
              <p className="text-text-secondary">
                {language === 'fr' 
                  ? 'Veuillez patienter pendant que nous activons votre abonnement.'
                  : 'Please wait while we activate your subscription.'}
              </p>
            </>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>

              <h1 className="font-display text-2xl text-text-primary mb-3">
                {language === 'fr' ? 'Paiement réussi !' : 'Payment successful!'}
              </h1>

              {/* Plan Badge */}
              {displayPlan && displayPlan !== 'free' && (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${planBgColors[displayPlan]} mb-4`}>
                  <span className="text-xl">{planEmojis[displayPlan] || '⭐'}</span>
                  <span className={`font-bold text-lg ${planColors[displayPlan]}`}>
                    Plan {planLabels[displayPlan] || displayPlan}
                  </span>
                </div>
              )}

              {/* Credits Added */}
              {creditsAdded > 0 && (
                <p className="text-emerald-400 font-medium mb-4">
                  +{creditsAdded} crédits ajoutés à votre compte !
                </p>
              )}

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
                    {language === 'fr' ? 'Analyses supplémentaires' : 'Additional analyses'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {language === 'fr' ? 'Fonctionnalités premium' : 'Premium features'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {language === 'fr' ? 'Support prioritaire' : 'Priority support'}
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
                  onClick={() => navigate('/upgrade')}
                  className="btn btn-secondary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
                >
                  {language === 'fr' ? 'Voir mon abonnement' : 'View my subscription'}
                </button>
              </div>
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <>
              <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-amber-500" />
              </div>

              <h1 className="font-display text-2xl text-text-primary mb-3">
                {language === 'fr' ? 'Confirmation en attente' : 'Confirmation pending'}
              </h1>

              <p className="text-text-secondary mb-4">
                {message || (language === 'fr' 
                  ? 'La confirmation du paiement prend plus de temps que prévu.'
                  : 'Payment confirmation is taking longer than expected.')}
              </p>

              <p className="text-sm text-text-tertiary mb-6">
                {language === 'fr' 
                  ? 'Votre paiement a été reçu. L\'activation peut prendre quelques minutes.'
                  : 'Your payment was received. Activation may take a few minutes.'}
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {language === 'fr' ? 'Réessayer' : 'Try again'}
                </button>
                
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn btn-secondary w-full py-2.5 text-sm"
                >
                  {language === 'fr' ? 'Aller au dashboard' : 'Go to dashboard'}
                </button>
              </div>

              <p className="text-xs text-text-tertiary mt-4">
                {language === 'fr' 
                  ? 'Problème ? Contactez '
                  : 'Issue? Contact '}
                <a href="mailto:contact@deepsightsynthesis.com" className="text-accent-primary hover:underline">
                  contact@deepsightsynthesis.com
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
