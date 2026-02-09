/**
 * DEEP SIGHT v5.1 — Payment Cancel Page
 * ✅ Utilise le système i18n centralisé
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { XCircle, ArrowLeft, MessageCircle } from 'lucide-react';
import DoodleBackground from '../components/DoodleBackground';

export const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 relative">
      <DoodleBackground variant="creative" />
      <div className="max-w-md w-full text-center relative z-10">
        <div className="card-elevated p-10 rounded-2xl">
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

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/upgrade')}
              className="btn btn-primary w-full py-3"
            >
              <ArrowLeft className="w-5 h-5" />
              {t.payment.cancel.backToPlans}
            </button>

            <a
              href="mailto:contact@deepsightsynthesis.com"
              className="btn btn-ghost w-full py-3"
            >
              <MessageCircle className="w-5 h-5" />
              {t.footer.help}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
