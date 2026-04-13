/**
 * 👤 SIDEBAR USER CARD v2.0 — Avatar dynamique avec persistance & animations
 * ═══════════════════════════════════════════════════════════════════════════════
 * Features:
 * - ✅ Avatar personnalisé persistant (base64 ou URL)
 * - ✅ Animation de transition fluide lors du changement
 * - ✅ Effet de lueur selon le plan (Pro/Expert)
 * - ✅ Fallback intelligent avec initiales
 * - ✅ Optimisation du rendu avec mémoisation
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Coins, LogOut } from "lucide-react";
import { Badge } from "../Badge";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_GLOW_COLORS: Record<string, string> = {
  pro: "rgba(99, 102, 241, 0.4)",
  free: "rgba(212, 165, 116, 0.2)",
};

const PLAN_BORDER_COLORS: Record<string, string> = {
  pro: "#6366F1",
  free: "#D4A574",
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SidebarUserCardProps {
  username: string;
  credits: number;
  plan?: "free" | "pro"; // Aliases pour rétrocompat
  avatarUrl?: string | null;
  onLogout: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 COMPOSANT
// ═══════════════════════════════════════════════════════════════════════════════

export const SidebarUserCard: React.FC<SidebarUserCardProps> = ({
  username,
  credits,
  plan = "free",
  avatarUrl,
  onLogout,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(
    avatarUrl || null,
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔄 GESTION DE L'AVATAR AVEC TRANSITION FLUIDE
  // ═══════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Reset l'erreur quand l'URL change
    if (avatarUrl !== currentAvatar) {
      setImageError(false);
      setIsLoading(true);

      // Animation de transition
      setIsTransitioning(true);

      const timeout = setTimeout(() => {
        setCurrentAvatar(avatarUrl || null);
        setIsTransitioning(false);
      }, 150);

      return () => clearTimeout(timeout);
    }
  }, [avatarUrl, currentAvatar]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 HELPERS MÉMORISÉS
  // ═══════════════════════════════════════════════════════════════════════════════

  const planConfig = useMemo(
    () => ({
      variant: (() => {
        switch (plan) {
          case "pro":
            return "warning" as const;
          default:
            return "default" as const;
        }
      })(),
      label: (() => {
        switch (plan) {
          case "pro":
            return "PRO";
          default:
            return "FREE";
        }
      })(),
      glowColor: PLAN_GLOW_COLORS[plan] || PLAN_GLOW_COLORS.free,
      borderColor: PLAN_BORDER_COLORS[plan] || PLAN_BORDER_COLORS.free,
      hasGlow: ["pro"].includes(plan),
    }),
    [plan],
  );

  // Génération des initiales
  const initials = useMemo(() => {
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [username]);

  // Gradient de couleur basé sur le username
  const gradientColors = useMemo(() => {
    const hash = username.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    const colors = [
      ["#D4A574", "#00D4AA"],
      ["#D4AF37", "#9B59B6"],
      ["#00FFFF", "#D4A574"],
      ["#F4D03F", "#00D4AA"],
      ["#D4A574", "#E8C87A"],
    ];

    return colors[Math.abs(hash) % colors.length];
  }, [username]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🖼️ GESTION DE L'IMAGE
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setImageError(true);
  }, []);

  // Déterminer si on affiche les initiales
  const shouldShowInitials = !currentAvatar || imageError;

  // Source de l'avatar
  const avatarSrc = useMemo(() => {
    if (currentAvatar && !imageError) {
      return currentAvatar;
    }
    return "/default-avatar.png";
  }, [currentAvatar, imageError]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎬 STYLES DYNAMIQUES
  // ═══════════════════════════════════════════════════════════════════════════════

  const avatarContainerStyle = useMemo(
    () => ({
      borderColor: planConfig.borderColor,
      background: shouldShowInitials
        ? `linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`
        : "transparent",
      boxShadow: planConfig.hasGlow
        ? `0 0 15px ${planConfig.glowColor}, 0 0 30px ${planConfig.glowColor}`
        : `0 0 10px rgba(212, 165, 116, 0.3)`,
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      opacity: isTransitioning ? 0.6 : 1,
      transform: isTransitioning ? "scale(0.92)" : "scale(1)",
    }),
    [planConfig, shouldShowInitials, gradientColors, isTransitioning],
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDU
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="px-4 py-4 mt-auto border-t space-y-3"
      style={{ borderColor: "rgba(212, 165, 116, 0.2)" }}
    >
      <div
        className="rounded-xl p-4 mb-3"
        style={{
          background: "rgba(13, 59, 68, 0.5)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          {/* 🖼️ Avatar avec effets */}
          <div
            className="relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2"
            style={avatarContainerStyle}
          >
            {/* Anneau de lueur animé pour Pro+ */}
            {planConfig.hasGlow && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${planConfig.glowColor} 0%, transparent 70%)`,
                  opacity: 0.4,
                  animation: "pulse-glow 2s ease-in-out infinite",
                }}
              />
            )}

            {/* Contenu de l'avatar */}
            {shouldShowInitials ? (
              <span
                className="relative z-10 font-bold text-lg select-none"
                style={{ color: "#0A1A1F" }}
              >
                {initials}
              </span>
            ) : (
              <>
                {/* Skeleton loader pendant le chargement */}
                {isLoading && (
                  <div
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{
                      background: `linear-gradient(90deg, 
                        rgba(212, 165, 116, 0.1) 0%, 
                        rgba(212, 165, 116, 0.3) 50%, 
                        rgba(212, 165, 116, 0.1) 100%)`,
                      animation: "shimmer 1.5s infinite",
                    }}
                  />
                )}
                <img
                  src={avatarSrc}
                  alt={`Avatar de ${username}`}
                  className="w-full h-full object-cover relative z-10"
                  style={{
                    transition: "opacity 0.3s ease-in-out",
                    opacity: isLoading ? 0 : 1,
                  }}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              </>
            )}
          </div>

          {/* Username & Plan */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold truncate mb-1"
              style={{ color: "#E8DCC4", fontWeight: 600 }}
            >
              {username}
            </p>
            <Badge
              variant={planConfig.variant}
              className="text-[10px] px-2 py-0.5"
            >
              {planConfig.label}
            </Badge>
          </div>
        </div>

        {/* 💰 Crédits */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg"
          style={{
            background: "rgba(0, 212, 170, 0.1)",
            border: "1px solid rgba(0, 212, 170, 0.3)",
          }}
        >
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4" style={{ color: "#F4D03F" }} />
            <span className="text-xs font-medium" style={{ color: "#E8DCC4" }}>
              Crédits
            </span>
          </div>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: "#F4D03F" }}
          >
            {credits >= 999999 ? "∞" : credits.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 🚪 Bouton de déconnexion */}
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-lg text-sm font-medium uppercase transition-all duration-200 group"
        style={{
          background: "rgba(180, 60, 60, 0.3)",
          border: "1px solid #B43C3C",
          color: "#FF6B6B",
          letterSpacing: "1px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(180, 60, 60, 0.6)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(180, 60, 60, 0.3)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span>Déconnexion</span>
      </button>

      {/* 🎨 Animations CSS */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default SidebarUserCard;
