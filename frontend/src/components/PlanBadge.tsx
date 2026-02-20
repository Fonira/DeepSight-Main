/**
 * PlanBadge — Sidebar plan status with usage mini-bar
 * Fetches GET /api/billing/my-plan and shows plan + analyses progress
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { billingApi, type ApiBillingMyPlan } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';

interface PlanBadgeProps {
  collapsed?: boolean;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({ collapsed }) => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const [plan, setPlan] = useState<ApiBillingMyPlan | null>(null);

  const tr = (fr: string, en: string) => language === 'fr' ? fr : en;

  useEffect(() => {
    billingApi.getMyPlan('web').then(setPlan).catch(() => {});
  }, []);

  if (!plan) return null;

  const usage = plan.usage.analyses_this_month;
  const limits = plan.limits as Record<string, unknown>;
  const limit = Number(limits?.monthly_analyses ?? limits?.monthlyAnalyses ?? 0);
  const isUnlimited = limit === -1;
  const progress = isUnlimited ? 0 : limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;

  if (collapsed) {
    return (
      <div className="px-2 py-1.5">
        <button
          onClick={() => navigate('/upgrade')}
          className="w-full flex justify-center"
          title={plan.plan_name}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ backgroundColor: `${plan.plan_color}20`, color: plan.plan_color }}
          >
            {plan.plan_icon}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => navigate('/upgrade')}
        className="w-full p-2.5 rounded-lg bg-bg-tertiary/50 border border-border-subtle hover:bg-bg-hover transition-all text-left group"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-semibold"
            style={{ backgroundColor: `${plan.plan_color}20`, color: plan.plan_color }}
          >
            {plan.plan_icon} {plan.plan_name}
          </span>
        </div>
        <div className="flex items-center justify-between text-[0.625rem] mb-1">
          <span className="text-text-tertiary flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {tr('Analyses', 'Analyses')}
          </span>
          <span className="font-bold tabular-nums text-text-secondary">
            {isUnlimited ? `${usage} / \u221e` : `${usage} / ${limit}`}
          </span>
        </div>
        {!isUnlimited && limit > 0 && (
          <div className="h-1 rounded-full bg-bg-hover overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: plan.plan_color }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        )}
      </button>
    </div>
  );
};

export default PlanBadge;
