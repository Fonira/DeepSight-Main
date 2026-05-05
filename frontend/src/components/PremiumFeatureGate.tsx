/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🔒 PREMIUM FEATURE GATE — Contrôle d'accès aux fonctionnalités premium           ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Masque les fonctionnalités non disponibles pour le plan de l'utilisateur       ║
 * ║  - Affiche un placeholder upgrade pour les features bloquées                       ║
 * ║  - Intégration avec UpgradePromptModal                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, ReactNode } from "react";
import { Lock, Crown, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import {
  PlanId,
  PlanLimits,
  hasFeature,
  getLimit,
  isUnlimited,
  getPlanInfo,
  getMinPlanForFeature,
  normalizePlanId,
} from "../config/planPrivileges";
import { UpgradePromptModal } from "./UpgradePromptModal";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 PLAN VISUAL HELPERS — gradients + ordre + price formatting
// (Le PlanInfo simplifié n'expose plus directement ces champs : on les dérive ici.)
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_GRADIENTS: Record<PlanId, string> = {
  free: "from-gray-500 to-gray-600",
  pro: "from-blue-500 to-cyan-500",
  expert: "from-violet-500 to-purple-600",
};

const PLAN_ORDER: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  expert: 2,
};

const formatMonthlyPrice = (
  priceCents: number,
  lang: "fr" | "en",
): string => {
  if (priceCents === 0) return lang === "fr" ? "0 €" : "$0";
  const eur = (priceCents / 100).toFixed(2);
  return lang === "fr" ? `${eur} €/mois` : `€${eur}/mo`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PremiumFeatureGateProps {
  /** Feature/limit key to check access for (matches PlanLimits keys) */
  feature?: keyof PlanLimits;
  /** Limit to check (alternative to feature) */
  limit?: keyof PlanLimits;
  /** Current usage (for limit-based gating) */
  currentUsage?: number;
  /** Required plan (alternative to feature/limit) */
  requiredPlan?: PlanId;
  /** Children to render when feature is available */
  children: ReactNode;
  /** What to show when feature is locked */
  fallback?: "hide" | "blur" | "placeholder" | "modal" | "custom";
  /** Custom fallback component */
  customFallback?: ReactNode;
  /** Title for the upgrade placeholder */
  title?: string;
  /** Description for the upgrade placeholder */
  description?: string;
  /** Size of the placeholder */
  size?: "sm" | "md" | "lg";
  /** Whether to show inline or as overlay */
  variant?: "inline" | "overlay";
  /** Callback when upgrade is clicked */
  onUpgrade?: () => void;
  /** Callback when the gate blocks access */
  onBlocked?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 PREMIUM FEATURE GATE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const PremiumFeatureGate: React.FC<PremiumFeatureGateProps> = ({
  feature,
  limit,
  currentUsage = 0,
  requiredPlan,
  children,
  fallback = "placeholder",
  customFallback,
  title,
  description,
  size = "md",
  variant = "inline",
  onUpgrade,
  onBlocked,
}) => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const userPlan = normalizePlanId(user?.plan);
  const t = (fr: string, en: string) => (language === "fr" ? fr : en);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔍 CHECK ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  const checkAccess = (): boolean => {
    if (feature) {
      return hasFeature(userPlan, feature);
    }
    if (limit) {
      const maxLimit = getLimit(userPlan, limit);
      if (maxLimit === 0) return false;
      if (isUnlimited(userPlan, limit)) return true;
      return currentUsage < maxLimit;
    }
    if (requiredPlan) {
      return PLAN_ORDER[userPlan] >= PLAN_ORDER[requiredPlan];
    }
    return true;
  };

  const hasAccess = checkAccess();

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 GET REQUIRED PLAN INFO
  // ═══════════════════════════════════════════════════════════════════════════

  const getRequiredPlanInfo = () => {
    if (feature) {
      const minPlan = getMinPlanForFeature(feature);
      return getPlanInfo(minPlan);
    }
    if (requiredPlan) {
      return getPlanInfo(requiredPlan);
    }
    const planOrder: PlanId[] = ["free", "pro", "expert"];
    const currentIndex = planOrder.indexOf(userPlan);
    const nextPlan =
      planOrder[Math.min(currentIndex + 1, planOrder.length - 1)];
    return getPlanInfo(nextPlan);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚀 HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleUpgradeClick = () => {
    onUpgrade?.();
    if (fallback === "modal") {
      setShowUpgradeModal(true);
    } else {
      navigate("/upgrade");
    }
  };

  React.useEffect(() => {
    if (!hasAccess) {
      onBlocked?.();
    }
  }, [hasAccess, onBlocked]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ✅ RENDER: ACCESS GRANTED
  // ═══════════════════════════════════════════════════════════════════════════

  if (hasAccess) {
    return <>{children}</>;
  }

  // Hide completely
  if (fallback === "hide") {
    return null;
  }

  // Custom fallback
  if (fallback === "custom" && customFallback) {
    return <>{customFallback}</>;
  }

  // Modal fallback
  if (fallback === "modal") {
    return (
      <>
        <div
          className="relative cursor-pointer"
          onClick={() => setShowUpgradeModal(true)}
        >
          <div className="blur-sm pointer-events-none select-none opacity-50">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/50 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 border border-accent-primary/20 rounded-full text-accent-primary">
              <Lock className="w-4 h-4" />
              <span className="text-sm font-medium">
                {t("Fonctionnalité Premium", "Premium Feature")}
              </span>
            </div>
          </div>
        </div>
        <UpgradePromptModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          limitType={
            feature === "playlistsEnabled"
              ? "playlist"
              : feature === "exportPdf"
                ? "export"
                : "credits"
          }
        />
      </>
    );
  }

  // Blur fallback
  if (fallback === "blur") {
    return (
      <div className="relative">
        <div className="blur-md pointer-events-none select-none">{children}</div>
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={handleUpgradeClick}
        >
          <div className="p-4 bg-bg-elevated/90 backdrop-blur rounded-xl shadow-lg border border-border-default">
            <Lock className="w-6 h-6 text-accent-primary mx-auto mb-2" />
            <p className="text-sm text-text-primary text-center">
              {t("Cliquez pour débloquer", "Click to unlock")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📦 PLACEHOLDER FALLBACK (default)
  // ═══════════════════════════════════════════════════════════════════════════

  const requiredPlanInfo = getRequiredPlanInfo();
  const requiredGradient = PLAN_GRADIENTS[requiredPlanInfo.id];
  const requiredName =
    language === "fr" ? requiredPlanInfo.name : requiredPlanInfo.nameEn;
  const requiredDescription =
    language === "fr"
      ? requiredPlanInfo.description
      : requiredPlanInfo.descriptionEn;
  const requiredPrice = formatMonthlyPrice(
    requiredPlanInfo.priceMonthly,
    language === "fr" ? "fr" : "en",
  );

  const sizeClasses = {
    sm: {
      container: "p-4",
      icon: "w-10 h-10",
      iconInner: "w-5 h-5",
      title: "text-sm",
      description: "text-xs",
      button: "px-3 py-1.5 text-xs",
    },
    md: {
      container: "p-6",
      icon: "w-14 h-14",
      iconInner: "w-7 h-7",
      title: "text-base",
      description: "text-sm",
      button: "px-4 py-2 text-sm",
    },
    lg: {
      container: "p-8",
      icon: "w-16 h-16",
      iconInner: "w-8 h-8",
      title: "text-lg",
      description: "text-base",
      button: "px-5 py-2.5 text-base",
    },
  };

  const classes = sizeClasses[size];
  const defaultTitle = t(
    `Fonctionnalité ${requiredName}`,
    `${requiredName} Feature`,
  );
  const defaultDescription = t(
    `Cette fonctionnalité est disponible à partir du plan ${requiredName}.`,
    `This feature is available from the ${requiredName} plan.`,
  );
  const displayTitle = title || defaultTitle;
  const displayDescription = description || defaultDescription;

  // Overlay variant
  if (variant === "overlay") {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            className={`bg-bg-elevated border border-border-default rounded-2xl shadow-xl ${classes.container} max-w-sm text-center`}
          >
            <div
              className={`${classes.icon} mx-auto mb-4 rounded-2xl bg-gradient-to-br ${requiredGradient} flex items-center justify-center`}
            >
              <Crown className={`${classes.iconInner} text-white`} />
            </div>
            <h3 className={`${classes.title} font-bold text-text-primary mb-2`}>
              {displayTitle}
            </h3>
            <p className={`${classes.description} text-text-secondary mb-4`}>
              {displayDescription}
            </p>
            <button
              onClick={handleUpgradeClick}
              className={`${classes.button} w-full flex items-center justify-center gap-2 bg-gradient-to-r ${requiredGradient} text-white font-medium rounded-xl hover:opacity-90 transition-opacity`}
            >
              <Sparkles className="w-4 h-4" />
              {t("Passer au plan", "Upgrade to")} {requiredName}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant (default)
  return (
    <div
      className={`bg-bg-secondary/50 border border-border-default rounded-2xl ${classes.container}`}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={`${classes.icon} mb-4 rounded-2xl bg-gradient-to-br ${requiredGradient} bg-opacity-10 flex items-center justify-center relative overflow-hidden`}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${requiredGradient} opacity-20`}
          />
          <Lock className={`${classes.iconInner} text-white relative z-10`} />
        </div>

        <h3 className={`${classes.title} font-bold text-text-primary mb-2`}>
          {displayTitle}
        </h3>

        <p
          className={`${classes.description} text-text-secondary mb-4 max-w-sm`}
        >
          {displayDescription}
        </p>

        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${requiredGradient} bg-opacity-10 mb-4`}
        >
          <span
            className={`text-xs font-medium bg-gradient-to-r ${requiredGradient} bg-clip-text text-transparent`}
          >
            {requiredDescription}
          </span>
        </div>

        <button
          onClick={handleUpgradeClick}
          className={`${classes.button} flex items-center gap-2 bg-gradient-to-r ${requiredGradient} text-white font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg`}
        >
          <Sparkles className="w-4 h-4" />
          {t("Débloquer avec", "Unlock with")} {requiredName}
        </button>

        <p className="mt-3 text-xs text-text-tertiary">
          {t("À partir de", "From")} {requiredPrice}
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎣 HOOK: useFeatureAccess
// ═══════════════════════════════════════════════════════════════════════════════

interface UseFeatureAccessOptions {
  feature?: keyof PlanLimits;
  limit?: keyof PlanLimits;
  currentUsage?: number;
  requiredPlan?: PlanId;
}

interface UseFeatureAccessResult {
  hasAccess: boolean;
  userPlan: PlanId;
  requiredPlan: PlanId | null;
  limitValue: number | null;
  isUnlimited: boolean;
  remainingUsage: number | null;
}

export function useFeatureAccess(
  options: UseFeatureAccessOptions,
): UseFeatureAccessResult {
  const { user } = useAuth();
  const userPlan = normalizePlanId(user?.plan);

  const { feature, limit, currentUsage = 0, requiredPlan } = options;

  let hasAccess = true;
  let requiredPlanResult: PlanId | null = null;
  let limitValue: number | null = null;
  let isUnlimitedValue = false;
  let remainingUsage: number | null = null;

  if (feature) {
    hasAccess = hasFeature(userPlan, feature);
    if (!hasAccess) {
      requiredPlanResult = getMinPlanForFeature(feature);
    }
  }

  if (limit) {
    limitValue = getLimit(userPlan, limit);
    isUnlimitedValue = limitValue === -1;

    if (limitValue === 0) {
      hasAccess = false;
    } else if (!isUnlimitedValue) {
      hasAccess = currentUsage < limitValue;
      remainingUsage = Math.max(0, limitValue - currentUsage);
    }
  }

  if (requiredPlan) {
    hasAccess = PLAN_ORDER[userPlan] >= PLAN_ORDER[requiredPlan];
    if (!hasAccess) {
      requiredPlanResult = requiredPlan;
    }
  }

  return {
    hasAccess,
    userPlan,
    requiredPlan: requiredPlanResult,
    limitValue,
    isUnlimited: isUnlimitedValue,
    remainingUsage,
  };
}
