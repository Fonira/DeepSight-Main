import React from "react";
import { useLocation } from "react-router-dom";
import {
  Video, BookOpen, History, Gem, Settings, Crown,
  Waves, Anchor
} from "lucide-react";
import { ThemeToggle } from "../ThemeToggle";
import { NotificationBell } from "../NotificationBell";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onAnalysisComplete?: (summaryId: number) => void;
}

const pageIcons: Record<string, React.ReactNode> = {
  "/dashboard": <Video className="w-6 h-6" />,
  "/playlist": <BookOpen className="w-6 h-6" />,
  "/history": <History className="w-6 h-6" />,
  "/upgrade": <Gem className="w-6 h-6" />,
  "/settings": <Settings className="w-6 h-6" />,
  "/admin": <Crown className="w-6 h-6" />,
};

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onAnalysisComplete }) => {
  const location = useLocation();
  const Icon = pageIcons[location.pathname] || <Anchor className="w-6 h-6" />;

  return (
    <header
      className="relative border-b py-4 sm:py-6 px-4 sm:px-8 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(13, 59, 68, 0.95) 0%, rgba(10, 26, 31, 0.98) 100%)",
        borderColor: "rgba(212, 165, 116, 0.3)",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(0, 212, 170, 0.2)"
      }}
    >
      {/* Effet de vagues subtil - hidden on mobile */}
      <div className="absolute inset-0 opacity-10 pointer-events-none hidden sm:block">
        <div
          className="absolute bottom-0 left-0 right-0 h-16"
          style={{
            background: "repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0, 212, 170, 0.1) 50px, rgba(0, 212, 170, 0.1) 100px)",
            animation: "wave 8s linear infinite"
          }}
        />
      </div>

      {/* Ligne de sonar - hidden on mobile */}
      <div
        className="absolute top-0 left-0 h-1 bg-gradient-to-r from-transparent via-cyan-glow to-transparent opacity-50 hidden sm:block"
        style={{
          width: "200px",
          animation: "sonarSweep 4s ease-in-out infinite"
        }}
      />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {/* Icône de la page - smaller on mobile */}
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(13, 59, 68, 0.8))",
              border: "2px solid rgba(0, 212, 170, 0.4)",
              boxShadow: "0 0 20px rgba(0, 212, 170, 0.3), inset 0 0 10px rgba(0, 212, 170, 0.2)"
            }}
          >
            <span className="text-cyan-glow [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">{Icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            <h1
              className="text-lg sm:text-2xl font-bold title-font tracking-wider truncate"
              style={{ color: "#D4A574" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="text-xs sm:text-sm subtitle-font tracking-wide flex items-center gap-2 mt-0.5 sm:mt-1 truncate"
                style={{ color: "rgba(232, 220, 196, 0.7)" }}
              >
                <Waves className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-glow opacity-60 flex-shrink-0" />
                <span className="truncate">{subtitle}</span>
              </p>
            )}
          </div>
        </div>

        {/* Actions: Notifications + Toggle de thème */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <NotificationBell onAnalysisComplete={onAnalysisComplete} />
          <ThemeToggle />
        </div>
      </div>

      {/* Coins décoratifs - hidden on mobile */}
      <span className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-gold-primary/30 hidden sm:block" />
      <span className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-gold-primary/30 hidden sm:block" />
    </header>
  );
};
