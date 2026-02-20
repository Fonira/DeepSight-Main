/**
 * DEEP SIGHT v7 — Payment Success Celebration Page
 * Confetti, stagger reveal, glassmorphism, auto-redirect
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { billingApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowRight, User, RefreshCw, Wifi, WifiOff } from 'lucide-react';

// ─── Plan metadata ────────────────────────────────────────────
interface PlanInfo {
  name: string;
  icon: string;
  color: string;
  price_monthly_cents: number;
  features: { text: string; highlight?: boolean }[];
}

const PLAN_DATA: Record<string, PlanInfo> = {
  starter: {
    name: 'Starter',
    icon: '⭐',
    color: '#3b82f6',
    price_monthly_cents: 599,
    features: [
      { text: '60 analyses par mois' },
      { text: '3 000 crédits IA' },
      { text: 'Vidéos jusqu\'à 2h' },
      { text: 'Export PDF & Markdown', highlight: true },
      { text: '60 jours d\'historique' },
    ],
  },
  pro: {
    name: 'Pro',
    icon: '👑',
    color: '#8b5cf6',
    price_monthly_cents: 1299,
    features: [
      { text: '300 analyses par mois' },
      { text: '15 000 crédits IA' },
      { text: 'Chat illimité', highlight: true },
      { text: 'Playlists complètes', highlight: true },
      { text: 'Lecture audio TTS' },
      { text: 'Tous les exports' },
    ],
  },
  expert: {
    name: 'Expert',
    icon: '💎',
    color: '#f59e0b',
    price_monthly_cents: 2999,
    features: [
      { text: '1 000 analyses par mois' },
      { text: '50 000 crédits IA' },
      { text: 'Accès API complet', highlight: true },
      { text: '5 utilisateurs', highlight: true },
      { text: 'Support prioritaire' },
      { text: 'Tout Pro inclus' },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €/mois';
}

function fireConfetti(planColor: string) {
  const end = Date.now() + 3000;
  const colors = [planColor, '#ffffff', '#8b5cf6', '#3b82f6'];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// ─── Skeleton loader ──────────────────────────────────────────
const SkeletonLoader: React.FC = () => (
  <div className="animate-pulse space-y-6 p-10">
    <div className="mx-auto w-20 h-20 rounded-full bg-white/5" />
    <div className="mx-auto w-64 h-8 rounded-lg bg-white/5" />
    <div className="mx-auto w-48 h-5 rounded bg-white/5" />
    <div className="mx-auto w-32 h-6 rounded bg-white/5" />
    <div className="space-y-3 mt-8">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-white/5" />
          <div className="flex-1 h-4 rounded bg-white/5" />
        </div>
      ))}
    </div>
    <div className="mx-auto w-full h-12 rounded-xl bg-white/5 mt-6" />
  </div>
);

// ─── Main component ───────────────────────────────────────────
type Status = 'loading' | 'success' | 'processing' | 'error';

export const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [confirmedPlan, setConfirmedPlan] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(30);
  const retriesRef = useRef(0);
  const confettiFired = useRef(false);

  const sessionId = searchParams.get('session_id');
  const planFromUrl = searchParams.get('plan');

  // Clear cached user on mount
  useEffect(() => {
    try { localStorage.removeItem('cached_user'); } catch { /* noop */ }
  }, []);

  // ── Confirm payment logic ──
  const confirm = useCallback(async (): Promise<{ success: boolean; plan?: string }> => {
    if (sessionId) {
      const result = await billingApi.confirmCheckout(sessionId);
      if (result.success && result.plan && result.plan !== 'free') {
        return { success: true, plan: result.plan };
      }
      // Webhook might not have fired yet — plan still free
      if (result.plan === 'free' || !result.plan) {
        return { success: false };
      }
      return { success: true, plan: result.plan };
    }
    // No session_id — refresh user and check plan
    await refreshUser(true);
    const currentPlan = user?.plan || planFromUrl;
    if (currentPlan && currentPlan !== 'free') {
      return { success: true, plan: currentPlan };
    }
    return { success: false };
  }, [sessionId, refreshUser, user?.plan, planFromUrl]);

  // ── Initial load + retry loop ──
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const run = async () => {
      try {
        const result = await confirm();
        if (cancelled) return;

        if (result.success && result.plan) {
          setConfirmedPlan(result.plan);
          setStatus('success');
          await refreshUser(true);
          return;
        }

        // Plan still free — enter retry mode
        setStatus('processing');
        const retryLoop = async () => {
          if (cancelled) return;
          retriesRef.current += 1;
          try {
            const retryResult = await confirm();
            if (cancelled) return;
            if (retryResult.success && retryResult.plan) {
              setConfirmedPlan(retryResult.plan);
              setStatus('success');
              await refreshUser(true);
              return;
            }
          } catch { /* continue retrying */ }

          if (retriesRef.current < 5) {
            retryTimer = setTimeout(retryLoop, 2000);
          } else {
            // All retries exhausted
            if (!cancelled) setStatus('processing');
          }
        };
        retryTimer = setTimeout(retryLoop, 2000);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
        setErrorMessage(msg);
        setStatus('error');
      }
    };

    run();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [confirm, refreshUser]);

  // ── Confetti on success ──
  useEffect(() => {
    if (status !== 'success' || confettiFired.current) return;
    confettiFired.current = true;
    const plan = PLAN_DATA[confirmedPlan || ''];
    const color = plan?.color || '#8b5cf6';
    const timer = setTimeout(() => fireConfetti(color), 500);
    return () => clearTimeout(timer);
  }, [status, confirmedPlan]);

  // ── Auto-redirect countdown ──
  useEffect(() => {
    if (status !== 'success') return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          navigate('/');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status, navigate]);

  // ── Retry handler (error state) ──
  const handleRetry = async () => {
    setStatus('loading');
    setErrorMessage('');
    retriesRef.current = 0;
    try {
      localStorage.removeItem('cached_user');
    } catch { /* noop */ }
    try {
      const result = await confirm();
      if (result.success && result.plan) {
        setConfirmedPlan(result.plan);
        setStatus('success');
        await refreshUser(true);
      } else {
        setStatus('error');
        setErrorMessage('Le paiement n\'a pas encore été traité. Réessayez dans quelques instants.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
      setErrorMessage(msg);
      setStatus('error');
    }
  };

  const plan = PLAN_DATA[confirmedPlan || ''] || null;
  const planColor = plan?.color || '#8b5cf6';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        background: status === 'success' && plan
          ? `radial-gradient(ellipse at 50% 0%, ${planColor}18 0%, #0a0a0f 60%)`
          : '#0a0a0f',
      }}
    >
      {/* Ambient glow */}
      {status === 'success' && plan && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{ backgroundColor: planColor }}
        />
      )}

      <div className="max-w-lg w-full relative z-10">
        {/* Glass card */}
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            {/* ═══ LOADING ═══ */}
            {status === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SkeletonLoader />
              </motion.div>
            )}

            {/* ═══ SUCCESS ═══ */}
            {status === 'success' && plan && (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-10 text-center"
              >
                {/* Icon + Title */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="mb-2"
                >
                  <span className="text-5xl block mb-4">{plan.icon}</span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    Bienvenue dans le plan {plan.name} !
                  </h1>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-white/50 mt-2 mb-1"
                >
                  Votre abonnement est maintenant actif
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg font-semibold mb-8"
                  style={{ color: planColor }}
                >
                  {formatPrice(plan.price_monthly_cents)}
                </motion.p>

                {/* Features list */}
                <div className="text-left space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.15 }}
                      className="flex items-center gap-3"
                    >
                      <span className="text-base flex-shrink-0">
                        {f.highlight ? '⭐' : '✅'}
                      </span>
                      <span className={`text-sm ${f.highlight ? 'text-white font-medium' : 'text-white/70'}`}>
                        {f.text}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Thank you */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + plan.features.length * 0.15 }}
                  className="text-white/40 text-sm mb-8 italic"
                >
                  Merci pour votre confiance !
                </motion.p>

                {/* CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + plan.features.length * 0.15 }}
                  className="space-y-3"
                >
                  {/* Primary CTA — glow button */}
                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-3.5 px-6 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(135deg, ${planColor}, ${planColor}cc)`,
                      boxShadow: `0 0 20px ${planColor}40, 0 4px 12px ${planColor}30`,
                    }}
                  >
                    Commencer à analyser
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  {/* Secondary CTA */}
                  <button
                    onClick={() => navigate('/account')}
                    className="w-full py-3 px-6 rounded-xl font-medium text-white/60 border border-white/10 hover:border-white/20 hover:text-white/80 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Voir mon compte
                  </button>
                </motion.div>

                {/* Countdown */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  className="text-white/20 text-xs mt-6"
                >
                  Redirection automatique dans {countdown}s
                </motion.p>
              </motion.div>
            )}

            {/* ═══ PROCESSING (webhook slow) ═══ */}
            {status === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-10 text-center"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
                  <Wifi className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-3">
                  Paiement en cours de traitement
                </h2>
                <p className="text-white/50 text-sm mb-6 leading-relaxed">
                  Votre paiement est en cours de traitement.<br />
                  Vos avantages seront activés sous quelques minutes.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-3 px-6 rounded-xl font-medium text-white/70 border border-white/10 hover:border-white/20 hover:text-white transition-all duration-200"
                >
                  Retour à l'accueil
                </button>
              </motion.div>
            )}

            {/* ═══ ERROR ═══ */}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-10 text-center"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                  <WifiOff className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-3">
                  Oups, un problème est survenu
                </h2>
                <p className="text-white/50 text-sm mb-6">
                  {errorMessage || 'Impossible de confirmer votre paiement. Veuillez réessayer.'}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleRetry}
                    className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-white/10 hover:bg-white/15 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Réessayer
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-3 px-6 rounded-xl font-medium text-white/50 hover:text-white/70 transition-all duration-200"
                  >
                    Retour à l'accueil
                  </button>
                </div>
                <p className="text-xs text-white/20 mt-6">
                  Besoin d'aide ?{' '}
                  <a
                    href="mailto:contact@deepsightsynthesis.com"
                    className="text-blue-400 hover:underline"
                  >
                    contact@deepsightsynthesis.com
                  </a>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
