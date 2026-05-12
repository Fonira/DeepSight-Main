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
  PlanFeatures,
  PlanLimits,
  PLAN_FEATURES,
  PLAN_HIERARCHY,
  getLimit,
  isUnlimited,
  getPlanInfo,
  normalizePlanId,
} from "../config/planPrivileges";
import { UpgradePromptModal } from "./UpgradePromptModal";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 HELPERS — Pricing v2 (PlanInfo n'a plus gradient/killerFeature/priceDisplay)
// ═══════════════════════════════════════════════════════════════════════════════

/** Gradient Tailwind par plan (remplace PlanInfo.gradient supprimé en v2) */
const PLAN_GRADIENT: Record<PlanId, string> = {
  free: "from-gray-500 to-gray-600",
  pro: "from-blue-500 to-indigo-600",
  expert: "from-violet-500 to-purple-600",
};

/** Killer feature par plan (remplace PlanInfo.killerFeature supprimé en v2) */
const PLAN_KILLER_FEATURE: Record<PlanId, { fr: string; en: string }> = {
  free: { fr: "Gratuit", en: "Free" },
  pro: {
    fr: "Flashcards & mind maps",
    en: "Flashcards & mind maps",
  },
  expert: {
    fr: "Toutes les fonctionnalités",
    en: "All features",
  },
};

/** Affichage du prix par plan (remplace PlanInfo.priceDisplay supprimé en v2) */
function formatPriceDisplay(plan: PlanId, lang: "fr" | "en"): string {
  const info = getPlanInfo(plan);
  if (info.priceMonthly === 0) return lang === "fr" ? "Gratuit" : "Free";
  const euros = (info.priceMonthly / 100).toFixed(2);
  const formatted = lang === "fr" ? euros.replace(".", ",") : euros;
  const suffix = lang === "fr" ? "€/mois" : "€/mo";
  return `${formatted} ${suffix}`;
}

/** Check si un plan a une feature (utilise PLAN_FEATURES boolean flags) */
function planHasFeature(plan: PlanId, feature: keyof PlanFeatures): boolean {
  return Boolean(PLAN_FEATURES[plan][feature]);
}

/** Trouve le plan minimal qui débloque une feature (parcourt PLAN_HIERARCHY) */
function minPlanForFeature(feature: keyof PlanFeatures): PlanId {
  for (const plan of PLAN_HIERARCHY) {
    if (planHasFeature(plan, feature)) return plan;
  }
  return "expert";
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PremiumFeatureGateProps {
  /** Feature to check access for */
  feature?: keyof PlanFeatures;
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
    // Check by feature
    if (feature) {
      return planHasFeature(userPlan, feature);
    }

    // Check by limit
    if (limit) {
      const maxLimit = getLimit(userPlan, limit);
      if (maxLimit === 0) return false;
      if (isUnlimited(userPlan, limit)) return true;
      return currentUsage < maxLimit;
    }

    // Check by required plan (Pricing v2 : pas de `order`, on utilise PLAN_HIERARCHY)
    if (requiredPlan) {
      return PLAN_HIERARCHY.indexOf(userPlan) >= PLAN_HIERARCHY.indexOf(requiredPlan);
    }

    // Default: allow access
    return true;
  };

  const hasAccess = checkAccess();

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 GET REQUIRED PLAN INFO
  // ═══════════════════════════════════════════════════════════════════════════

  const getRequiredPlan = (): PlanId => {
    if (feature) {
      return minPlanForFeature(feature);
    }
    if (requiredPlan) {
      return requiredPlan;
    }
    // For limits, suggest the next plan up
    const currentIndex = PLAN_HIERARCHY.indexOf(userPlan);
    return (
      PLAN_HIERARCHY[Math.min(currentIndex + 1, PLAN_HIERARCHY.length - 1)] ??
      "expert"
    );
  };

  const getRequiredPlanInfo = () => getPlanInfo(getRequiredPlan());

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔔 SIDE EFFECTS — DOIT être appelé inconditionnellement (rules-of-hooks)
  // ═══════════════════════════════════════════════════════════════════════════

  // Call onBlocked callback
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔒 RENDER: ACCESS DENIED
  // ═══════════════════════════════════════════════════════════════════════════

  // Hide completely
  if (fallback === "hide") {
    return null;
  }

  // Custom fallback
  if (fallback === "custom" && customFallback) {
    return <>{customFallback}</>;
  }

  // Modal fallback - show modal on click, but render children blurred
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
            feature === "playlists"
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
        <div className="blur-md pointer-events-none select-none">
          {children}
        </div>
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

  // Pricing v2 : PlanInfo a `name` / `nameEn` (plus de `{ fr, en }` imbriqué)
  const requiredPlanId: PlanId = getRequiredPlan();
  const requiredPlanName =
    language === "fr" ? requiredPlanInfo.name : requiredPlanInfo.nameEn;
  const requiredPlanGradient = PLAN_GRADIENT[requiredPlanId];
  const killerFeature =
    PLAN_KILLER_FEATURE[requiredPlanId][language === "fr" ? "fr" : "en"];
  const priceDisplay = formatPriceDisplay(
    requiredPlanId,
    language === "fr" ? "fr" : "en",
  );

  // Generate default title and description
  const defaultTitle = t(
    `Fonctionnalité ${requiredPlanInfo.name}`,
    `${requiredPlanInfo.nameEn} Feature`,
  );

  const defaultDescription = t(
    `Cette fonctionnalité est disponible à partir du plan ${requiredPlanInfo.name}.`,
    `This feature is available from the ${requiredPlanInfo.nameEn} plan.`,
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
              className={`${classes.icon} mx-auto mb-4 rounded-2xl bg-gradient-to-br ${requiredPlanGradient} flex items-center justify-center`}
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
              className={`${classes.button} w-full flex items-center justify-center gap-2 bg-gradient-to-r ${requiredPlanGradient} text-white font-medium rounded-xl hover:opacity-90 transition-opacity`}
            >
              <Sparkles className="w-4 h-4" />
              {t("Passer au plan", "Upgrade to")} {requiredPlanName}
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
        {/* Icon with gradient background */}
        <div
          className={`${classes.icon} mb-4 rounded-2xl bg-gradient-to-br ${requiredPlanGradient} bg-opacity-10 flex items-center justify-center relative overflow-hidden`}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${requiredPlanGradient} opacity-20`}
          />
          <Lock className={`${classes.iconInner} text-white relative z-10`} />
        </div>

        {/* Title */}
        <h3 className={`${classes.title} font-bold text-text-primary mb-2`}>
          {displayTitle}
        </h3>

        {/* Description */}
        <p
          className={`${classes.description} text-text-secondary mb-4 max-w-sm`}
        >
          {displayDescription}
        </p>

        {/* Plan badge */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${requiredPlanGradient} bg-opacity-10 mb-4`}
        >
          <span
            className={`text-xs font-medium bg-gradient-to-r ${requiredPlanGradient} bg-clip-text text-transparent`}
          >
            {killerFeature}
          </span>
        </div>

        {/* Upgrade button */}
        <button
          onClick={handleUpgradeClick}
          className={`${classes.button} flex items-center gap-2 bg-gradient-to-r ${requiredPlanGradient} text-white font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg`}
        >
          <Sparkles className="w-4 h-4" />
          {t("Débloquer avec", "Unlock with")} {requiredPlanName}
        </button>

        {/* Price hint */}
        <p className="mt-3 text-xs text-text-tertiary">
          {t("À partir de", "From")} {priceDisplay}
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎣 HOOK: useFeatureAccess
// ═══════════════════════════════════════════════════════════════════════════════

interface UseFeatureAccessOptions {
  feature?: keyof PlanFeatures;
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

  // Check by feature
  if (feature) {
    hasAccess = planHasFeature(userPlan, feature);
    if (!hasAccess) {
      requiredPlanResult = minPlanForFeature(feature);
    }
  }

  // Check by limit
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

  // Check by required plan (Pricing v2 : pas de `order`, on utilise PLAN_HIERARCHY)
  if (requiredPlan) {
    hasAccess =
      PLAN_HIERARCHY.indexOf(userPlan) >= PLAN_HIERARCHY.indexOf(requiredPlan);
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

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default PremiumFeatureGate;
