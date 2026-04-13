/**
 * ♿ Accessibility Utilities v1.0
 *
 * Composants utilitaires pour améliorer l'accessibilité:
 * - VisuallyHidden: Contenu uniquement pour lecteurs d'écran
 * - AccessibleIcon: Icône avec description pour lecteurs d'écran
 * - LiveRegion: Zone d'annonces dynamiques
 * - FocusTrap: Piège le focus dans un conteneur
 */

import React, { useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// 👁️ VISUALLY HIDDEN
// ═══════════════════════════════════════════════════════════════════════════════

interface VisuallyHiddenProps {
  children: React.ReactNode;
  /** Si true, devient visible au focus */
  focusable?: boolean;
}

/**
 * Rend le contenu invisible visuellement mais accessible aux lecteurs d'écran.
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  focusable = false,
}) => {
  return (
    <span className={focusable ? "sr-only focus:not-sr-only" : "sr-only"}>
      {children}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 ACCESSIBLE ICON
// ═══════════════════════════════════════════════════════════════════════════════

interface AccessibleIconProps {
  /** L'icône à afficher (composant Lucide, etc.) */
  icon: React.ReactNode;
  /** Description pour les lecteurs d'écran */
  label: string;
  /** Si true, l'icône est décorative et sera ignorée */
  decorative?: boolean;
  className?: string;
}

/**
 * Wrapper pour les icônes qui ajoute l'accessibilité appropriée.
 *
 * @example
 * // Icône informative
 * <AccessibleIcon icon={<AlertCircle />} label="Attention" />
 *
 * // Icône décorative (ignorée par les lecteurs d'écran)
 * <AccessibleIcon icon={<Star />} label="" decorative />
 */
export const AccessibleIcon: React.FC<AccessibleIconProps> = ({
  icon,
  label,
  decorative = false,
  className = "",
}) => {
  if (decorative) {
    return (
      <span className={className} aria-hidden="true">
        {icon}
      </span>
    );
  }

  return (
    <span className={className} role="img" aria-label={label}>
      {icon}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📢 LIVE REGION
// ═══════════════════════════════════════════════════════════════════════════════

interface LiveRegionProps {
  /** Message à annoncer */
  message: string;
  /** Politeness: 'polite' attend une pause, 'assertive' interrompt */
  politeness?: "polite" | "assertive";
  /** Si true, le message est visible */
  visible?: boolean;
  className?: string;
}

/**
 * Zone d'annonces pour les lecteurs d'écran.
 * Utilise aria-live pour annoncer les changements dynamiques.
 *
 * @example
 * <LiveRegion message={statusMessage} politeness="polite" />
 */
export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  politeness = "polite",
  visible = false,
  className = "",
}) => {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={visible ? className : "sr-only"}
    >
      {message}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 FOCUS TRAP
// ═══════════════════════════════════════════════════════════════════════════════

interface FocusTrapProps {
  children: React.ReactNode;
  /** Si true, le piège est actif */
  active: boolean;
  /** Callback quand on essaie de sortir */
  onEscapeAttempt?: () => void;
}

/**
 * Piège le focus à l'intérieur d'un conteneur.
 * Utile pour les modales, menus, etc.
 */
export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active,
  onEscapeAttempt,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscapeAttempt) {
        onEscapeAttempt();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, onEscapeAttempt]);

  const handleFocus = (position: "start" | "end") => {
    if (!active || !containerRef.current) return;

    const focusableElements =
      containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

    if (focusableElements.length === 0) return;

    if (position === "start") {
      // Focus sur le dernier élément
      focusableElements[focusableElements.length - 1].focus();
    } else {
      // Focus sur le premier élément
      focusableElements[0].focus();
    }
  };

  if (!active) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Sentinelle de début */}
      <div
        ref={startRef}
        tabIndex={0}
        onFocus={() => handleFocus("start")}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      />

      <div ref={containerRef}>{children}</div>

      {/* Sentinelle de fin */}
      <div
        ref={endRef}
        tabIndex={0}
        onFocus={() => handleFocus("end")}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ⌨️ KEYBOARD NAVIGATION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

interface UseRovingTabIndexOptions {
  /** Orientation de la navigation */
  orientation?: "horizontal" | "vertical" | "both";
  /** Loop au début/fin */
  loop?: boolean;
}

/**
 * Hook pour la navigation au clavier dans une liste d'éléments.
 * Implémente le pattern "roving tabindex".
 */
export function useRovingTabIndex(
  items: HTMLElement[],
  options: UseRovingTabIndexOptions = {},
) {
  const { orientation = "vertical", loop = true } = options;
  const [activeIndex, setActiveIndex] = React.useState(0);

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      let nextIndex = activeIndex;
      const lastIndex = items.length - 1;

      const isNext =
        (orientation === "horizontal" && e.key === "ArrowRight") ||
        (orientation === "vertical" && e.key === "ArrowDown") ||
        (orientation === "both" &&
          (e.key === "ArrowRight" || e.key === "ArrowDown"));

      const isPrev =
        (orientation === "horizontal" && e.key === "ArrowLeft") ||
        (orientation === "vertical" && e.key === "ArrowUp") ||
        (orientation === "both" &&
          (e.key === "ArrowLeft" || e.key === "ArrowUp"));

      if (isNext) {
        e.preventDefault();
        nextIndex =
          activeIndex < lastIndex ? activeIndex + 1 : loop ? 0 : lastIndex;
      } else if (isPrev) {
        e.preventDefault();
        nextIndex = activeIndex > 0 ? activeIndex - 1 : loop ? lastIndex : 0;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = lastIndex;
      }

      if (nextIndex !== activeIndex) {
        setActiveIndex(nextIndex);
        items[nextIndex]?.focus();
      }
    },
    [activeIndex, items, orientation, loop],
  );

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getTabIndex: (index: number) => (index === activeIndex ? 0 : -1),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📐 HEADING LEVEL CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HeadingLevelContext = React.createContext<HeadingLevel>(1);

/**
 * Provider pour gérer automatiquement les niveaux de titre.
 */
export const HeadingLevelProvider: React.FC<{
  level: HeadingLevel;
  children: React.ReactNode;
}> = ({ level, children }) => {
  return (
    <HeadingLevelContext.Provider value={level}>
      {children}
    </HeadingLevelContext.Provider>
  );
};

/**
 * Titre avec niveau automatique basé sur le contexte.
 */
export const Heading: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Override le niveau automatique */
  level?: HeadingLevel;
}> = ({ children, className = "", level: overrideLevel }) => {
  const contextLevel = React.useContext(HeadingLevelContext);
  const level = overrideLevel || contextLevel;

  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  return <Tag className={className}>{children}</Tag>;
};

export default {
  VisuallyHidden,
  AccessibleIcon,
  LiveRegion,
  FocusTrap,
  useRovingTabIndex,
  HeadingLevelProvider,
  Heading,
};
