/**
 * ♿ SkipLink Component v1.0
 * 
 * Lien "Skip to content" pour permettre aux utilisateurs de lecteurs d'écran
 * de passer directement au contenu principal.
 * 
 * Usage:
 * <SkipLink targetId="main-content" />
 * ...
 * <main id="main-content">...</main>
 */

import React from 'react';

interface SkipLinkProps {
  /** ID de l'élément cible (ex: "main-content") */
  targetId: string;
  /** Texte du lien (par défaut: "Aller au contenu principal") */
  label?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({ 
  targetId, 
  label = "Aller au contenu principal" 
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.removeAttribute('tabindex');
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="
        sr-only focus:not-sr-only
        fixed top-4 left-4 z-[9999]
        px-4 py-2 
        bg-accent-primary text-white
        rounded-lg shadow-lg
        focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2
        transition-all duration-200
        font-medium
      "
    >
      {label}
    </a>
  );
};

export default SkipLink;
