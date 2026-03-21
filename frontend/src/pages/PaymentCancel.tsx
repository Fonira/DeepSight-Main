/**
 * DEEP SIGHT v6.0 — Payment Cancel Page (Conversion-Optimized)
 *
 * Objectif : Récupérer les prospects qui abandonnent le checkout.
 * - Réassurance (sécurité, garantie, essai gratuit)
 * - CTA vers essai Pro 7j
 * - Tracking analytics de la raison d'abandon
 * - Lien retour plans + contact support
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { XCircle, ArrowRight, Shield, Clock, CreditCard, MessageCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import DoodleBackground from '../components/DoodleBackground';

export const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showReasons, setShowReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const trackCancelReason = (reason: string) => {
    setSelectedReason(reason);
    // Fire analytics event (non-blocking)
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://api.deepsightsynthesis.com';
      fetch(`${API_URL}/api/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment_cancel_reason',
          properties: { reason },
          platform: 'web',
        }),
      }).catch(() => {}); // Silently fail
    } catch {
      // Analytics should never break UX
    }
  };

  const reassuranceItems = [
    {
      icon: Clock,
      text: t.payment.cancel.reassurance.trial,
      color: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
    },
    {
      icon: Shield,
      text: t.payment.cancel.reassurance.guarantee,
      color: 'text-accent-green',
      bgColor: 'bg-accent-green/10',
    },
    {
      icon: CreditCard,
      text: t.payment.cancel.reassurance.security,
      color: 'text-accent-violet',
      bgColor: 'bg-accent-violet/10',
    },
  ];

  const reasons = [
    { key: 'price', label: t.payment.cancel.reasons.price },
    { key: 'features', label: t.payment.cancel.reasons.features },
    { key: 'trial', label: t.payment.cancel.reasons.trial },
    { key: 'other', label: t.payment.cancel.reasons.other },
  ];

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 relative">
      <DoodleBackground variant="creative" />
      <div className="max-w-lg w-full relative z-10 space-y-6">

        {/* Main Card */}
        <div className="card-elevated p-10 rounded-2xl text-center">
          {/* Cancel Icon */}
          <div className="w-20 h-20 rounded-full bg-error-muted flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-error" />
          </div>

          {/* Title */}
          <h1 className="font-semibold text-2xl mb-3">
            {t.payment.cancel.title}
          </h1>

          {/* Description */}
          <p className="text-text-secondary mb-8">
            {t.payment.cancel.subtitle}
          </p>

          {/* Primary CTA — Essai gratuit */}
          <button
            onClick={() => navigate('/upgrade?trial=true')}
            className="btn btn-primary w-full py-3.5 text-base font-medium mb-3 group"
          >
            <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
            {t.payment.cancel.startTrial}
          </button>

          {/* Secondary CTA — Revoir les offres */}
          <button
            onClick={() => navigate('/upgrade')}
            className="btn btn-ghost w-full py-3"
          >
            <ArrowRight className="w-4 h-4" />
            {t.payment.cancel.backToPlans}
          </button>
        </div>

        {/* Reassurance Section */}
        <div className="card-elevated p-6 rounded-2xl space-y-4">
          {reassuranceItems.map((item, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className="text-text-secondary text-sm leading-relaxed pt-2">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* Optional Feedback — Collapsible */}
        <div className="card-elevated rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowReasons(!showReasons)}
            className="w-full flex items-center justify-between p-5 text-text-secondary hover:text-text-primary transition-colors"
          >
            <span className="text-sm font-medium">{t.payment.cancel.whySection}</span>
            {showReasons ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showReasons && (
            <div className="px-5 pb-5 space-y-2">
              {reasons.map((reason) => (
                <button
                  key={reason.key}
                  onClick={() => trackCancelReason(reason.key)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                    selectedReason === reason.key
                      ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                      : 'bg-white/5 hover:bg-white/10 text-text-secondary border border-transparent'
                  }`}
                >
                  {reason.label}
                </button>
              ))}

              {selectedReason && (
                <p className="text-xs text-text-tertiary pt-2 text-center">
                  Merci pour votre retour !
                </p>
              )}
            </div>
          )}
        </div>

        {/* Contact Support */}
        <div className="text-center">
          <a
            href="mailto:contact@deepsightsynthesis.com"
            className="inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {t.payment.cancel.needHelp}
          </a>
        </div>

        {/* Continue Free — Subtle link */}
        <div className="text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-text-tertiary hover:text-text-secondary underline underline-offset-4 transition-colors"
          >
            {t.payment.cancel.tryFree}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
