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
      className="relative border-b py-6 px-8 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(13, 59, 68, 0.95) 0%, rgba(10, 26, 31, 0.98) 100%)",
        borderColor: "rgba(212, 165, 116, 0.3)",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(0, 212, 170, 0.2)"
      }}
    >
      {/* Effet de vagues subtil */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute bottom-0 left-0 right-0 h-16"
          style={{
            background: "repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0, 212, 170, 0.1) 50px, rgba(0, 212, 170, 0.1) 100px)",
            animation: "wave 8s linear infinite"
          }}
        />
      </div>

      {/* Ligne de sonar */}
      <div
        className="absolute top-0 left-0 h-1 bg-gradient-to-r from-transparent via-cyan-glow to-transparent opacity-50"
        style={{
          width: "200px",
          animation: "sonarSweep 4s ease-in-out infinite"
        }}
      />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          {/* Icône de la page */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(13, 59, 68, 0.8))",
              border: "2px solid rgba(0, 212, 170, 0.4)",
              boxShadow: "0 0 20px rgba(0, 212, 170, 0.3), inset 0 0 10px rgba(0, 212, 170, 0.2)"
            }}
          >
            <span className="text-cyan-glow">{Icon}</span>
          </div>

          <div>
            <h1
              className="text-2xl font-bold title-font tracking-wider"
              style={{ color: "#D4A574" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="text-sm subtitle-font tracking-wide flex items-center gap-2 mt-1"
                style={{ color: "rgba(232, 220, 196, 0.7)" }}
              >
                <Waves className="w-4 h-4 text-cyan-glow opacity-60" />
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Actions: Notifications + Toggle de thème */}
        <div className="flex items-center gap-3">
          <NotificationBell onAnalysisComplete={onAnalysisComplete} />
          <ThemeToggle />
        </div>
      </div>

      {/* Coins décoratifs */}
      <span className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-gold-primary/30" />
      <span className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-gold-primary/30" />
    </header>
  );
};
