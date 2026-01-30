/**
 * DEEP SIGHT v6.1 — Payment Success Page
 * ✅ Utilise le système i18n centralisé
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { billingApi } from '../services/api';
import { CheckCircle, ArrowRight, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { DeepSightSpinner } from '../components/ui';
import DoodleBackground from '../components/DoodleBackground';

function clearUserCache() {
  try {
    localStorage.removeItem('cached_user');
  } catch (err) {
    console.error('Error clearing cache:', err);
  }
}

export const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const { t, language } = useTranslation();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [confirmedPlan, setConfirmedPlan] = useState<string | null>(null);
  const [creditsAdded, setCreditsAdded] = useState<number>(0);

  const sessionId = searchParams.get('session_id');
  const planFromUrl = searchParams.get('plan');

  useEffect(() => {
    const confirmPayment = async () => {
      clearUserCache();
      
      if (!sessionId) {
        await refreshUser(true);
        setStatus('success');
        setConfirmedPlan(planFromUrl);
        return;
      }

      try {
        const result = await billingApi.confirmCheckout(sessionId);

        if (result.success) {
          setStatus('success');
          setConfirmedPlan(result.plan || planFromUrl);
          setCreditsAdded(result.credits_added || 0);
          setMessage(result.message);
          await refreshUser(true);
        } else {
          setStatus('loading');
          setMessage(result.message || t.payment.processing);
          
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
                setMessage(t.errors.generic);
              }
            } catch {
              setStatus('error');
            }
          }, 3000);
        }
      } catch (err: any) {
        console.error('❌ Confirmation error:', err);
        setStatus('error');
        setMessage(err.message || t.errors.generic);
        if (planFromUrl) {
          setConfirmedPlan(planFromUrl);
        }
      }
    };

    confirmPayment();
  }, [sessionId]);

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

  const planLabels: Record<string, string> = {
    free: t.upgrade.plans.free.name,
    starter: t.upgrade.plans.starter.name,
    pro: t.upgrade.plans.pro.name,
    expert: t.upgrade.plans.expert.name,
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

  const displayPlan = confirmedPlan || user?.plan || planFromUrl;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 relative">
      <DoodleBackground variant="default" density={40} />
      <div className="max-w-md w-full text-center relative z-10">
        <div className="card p-10">
          
          {/* Loading State */}
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-6">
                <DeepSightSpinner size="lg" />
              </div>
              <h1 className="font-display text-2xl text-text-primary mb-3">
                {t.payment.processing}
              </h1>
              <p className="text-text-secondary">
                {t.payment.redirecting}
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
                {t.payment.success.title}
              </h1>

              {displayPlan && displayPlan !== 'free' && (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${planBgColors[displayPlan]} mb-4`}>
                  <span className="text-xl">{planEmojis[displayPlan] || '⭐'}</span>
                  <span className={`font-bold text-lg ${planColors[displayPlan]}`}>
                    Plan {planLabels[displayPlan] || displayPlan}
                  </span>
                </div>
              )}

              {creditsAdded > 0 && (
                <p className="text-emerald-400 font-medium mb-4">
                  +{creditsAdded} {t.success.creditsAdded}
                </p>
              )}

              <p className="text-text-secondary mb-8">
                {t.payment.success.subtitle}
              </p>

              <div className="bg-bg-tertiary rounded-xl p-4 mb-8 border border-border-subtle">
                <div className="flex items-center gap-2 text-accent-primary mb-3">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-medium">
                    {t.upgrade.features}
                  </span>
                </div>
                <ul className="text-sm text-text-secondary text-left space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {t.upgrade.features_list.unlimitedAnalyses}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {t.upgrade.features_list.allExports}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {t.upgrade.features_list.prioritySupport}
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {t.payment.success.backToDashboard}
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => navigate('/upgrade')}
                  className="btn btn-secondary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
                >
                  {t.settings.manageSubscription}
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
                {t.upgrade.processing}
              </h1>

              <p className="text-text-secondary mb-4">
                {message || t.errors.generic}
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {t.common.retry}
                </button>
                
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn btn-secondary w-full py-2.5 text-sm"
                >
                  {t.payment.success.backToDashboard}
                </button>
              </div>

              <p className="text-xs text-text-tertiary mt-4">
                {t.footer.contact}:{' '}
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
