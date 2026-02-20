import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { PlanType } from '../constants/config';

/** Credit limits per plan (mirrors backend config) */
const PLAN_CREDITS: Record<string, number> = {
  free: 150,
  student: 2000,
  starter: 3000,
  pro: 15000,
  team: 50000,
};

export function useCredits() {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    if (!user) {
      return {
        used: 0,
        total: 150,
        remaining: 150,
        percent: 0,
        isLow: false,
        isCritical: false,
        plan: 'free' as PlanType,
      };
    }

    const total = PLAN_CREDITS[user.plan] || 150;
    const used = user.credits_monthly || 0;
    const remaining = Math.max(total - used, 0);
    const percent = total > 0 ? Math.round((used / total) * 100) : 0;

    return {
      used,
      total,
      remaining,
      percent,
      isLow: percent >= 80,
      isCritical: percent >= 95,
      plan: user.plan,
    };
  }, [user]);
}
