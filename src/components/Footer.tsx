import React from "react";
import { Link } from "react-router-dom";
import { Scale } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border-default bg-bg-secondary py-4 px-6 flex-shrink-0">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-text-secondary text-sm">
          © 2024 Deep Sight - Tous droits réservés
        </div>
        <Link
          to="/legal"
          className="flex items-center gap-2 text-accent-primary hover:text-accent-primary-hover transition-colors text-sm font-medium"
        >
          <Scale className="w-4 h-4" />
          Mentions Légales
        </Link>
      </div>
    </footer>
  );
};
