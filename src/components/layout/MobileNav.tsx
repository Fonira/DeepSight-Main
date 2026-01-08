import React from "react";
import { Menu, X } from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="lg:hidden fixed top-4 left-4 z-50 w-12 h-12 rounded-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent active:scale-95 transition-transform"
      style={{
        background: "linear-gradient(135deg, #D4A574, #B8860B)",
        boxShadow: "0 4px 12px rgba(212, 175, 55, 0.5)",
      }}
      aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
      aria-expanded={isOpen}
      aria-controls="mobile-sidebar"
    >
      {isOpen ? (
        <X className="w-6 h-6 text-[#0A1A1F]" aria-hidden="true" />
      ) : (
        <Menu className="w-6 h-6 text-[#0A1A1F]" aria-hidden="true" />
      )}
    </button>
  );
};
