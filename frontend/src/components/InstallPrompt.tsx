/**
 * 📱 InstallPrompt Component v1.0
 * 
 * Bannière/bouton pour installer la PWA sur mobile et desktop.
 * S'adapte à la plateforme (iOS, Android, Desktop).
 */

import React, { useState, useEffect } from 'react';
import { usePWA } from '../hooks/usePWA';
import { X, Download, Smartphone, Share, Plus, Monitor } from 'lucide-react';

interface InstallPromptProps {
  /** Style de présentation */
  variant?: 'banner' | 'button' | 'modal';
  /** Position de la bannière */
  position?: 'top' | 'bottom';
  /** Callback après installation */
  onInstalled?: () => void;
  /** Callback si refusé */
  onDismissed?: () => void;
  /** Classe CSS additionnelle */
  className?: string;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({
  variant = 'banner',
  position = 'bottom',
  onInstalled,
  onDismissed,
  className = '',
}) => {
  const { 
    canInstall, 
    isInstalled, 
    isInstalling, 
    platform, 
    installDismissed,
    promptInstall 
  } = usePWA();
  
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Afficher la bannière après un délai
  useEffect(() => {
    if (!isInstalled && !installDismissed) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000); // 3 secondes après le chargement
      
      return () => clearTimeout(timer);
    }
  }, [isInstalled, installDismissed]);

  // Gérer l'installation
  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowIOSGuide(true);
      return;
    }
    
    const success = await promptInstall();
    
    if (success) {
      onInstalled?.();
      setShowBanner(false);
    } else {
      onDismissed?.();
    }
  };

  // Fermer la bannière
  const handleDismiss = () => {
    setShowBanner(false);
    onDismissed?.();
  };

  // Ne rien afficher si déjà installé ou pas de possibilité d'installation
  if (isInstalled) {
    return null;
  }

  // Guide iOS (partage > Ajouter à l'écran d'accueil)
  if (showIOSGuide) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-bg-elevated rounded-2xl p-6 shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">
              Installer Deep Sight
            </h3>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
          
          <p className="text-text-secondary mb-6">
            Pour installer l'app sur votre iPhone/iPad :
          </p>
          
          <ol className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                <Share className="w-4 h-4 text-accent-primary" />
              </div>
              <div>
                <p className="font-medium text-text-primary">1. Appuyez sur Partager</p>
                <p className="text-sm text-text-secondary">En bas de Safari</p>
              </div>
            </li>
            
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-accent-primary" />
              </div>
              <div>
                <p className="font-medium text-text-primary">2. Sur l'écran d'accueil</p>
                <p className="text-sm text-text-secondary">Faites défiler et sélectionnez</p>
              </div>
            </li>
            
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-accent-primary" />
              </div>
              <div>
                <p className="font-medium text-text-primary">3. Appuyez sur Ajouter</p>
                <p className="text-sm text-text-secondary">L'app sera sur votre écran d'accueil</p>
              </div>
            </li>
          </ol>
          
          <button
            onClick={() => setShowIOSGuide(false)}
            className="w-full mt-6 py-3 bg-accent-primary hover:bg-accent-primary-hover rounded-xl font-medium text-white transition-colors"
          >
            J'ai compris
          </button>
        </div>
      </div>
    );
  }

  // Bouton simple
  if (variant === 'button') {
    if (!canInstall && platform !== 'ios') {
      return null;
    }
    
    return (
      <button
        onClick={handleInstall}
        disabled={isInstalling}
        className={`
          inline-flex items-center gap-2 px-4 py-2 
          bg-accent-primary hover:bg-accent-primary-hover
          rounded-lg font-medium text-white
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        {isInstalling ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Installation...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Installer l'app
          </>
        )}
      </button>
    );
  }

  // Bannière
  if (!showBanner || (!canInstall && platform !== 'ios')) {
    return null;
  }

  const positionClasses = position === 'top' 
    ? 'top-0 left-0 right-0' 
    : 'bottom-0 left-0 right-0 pb-safe';

  return (
    <div 
      className={`
        fixed ${positionClasses} z-50 p-4 
        bg-gradient-to-r from-accent-primary to-accent-primary-hover
        shadow-lg animate-slide-up
        ${className}
      `}
      role="banner"
      aria-label="Installer l'application"
    >
      <div className="max-w-lg mx-auto flex items-center gap-4">
        {/* Icône */}
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          {platform === 'ios' || platform === 'android' ? (
            <Smartphone className="w-6 h-6 text-white" />
          ) : (
            <Monitor className="w-6 h-6 text-white" />
          )}
        </div>
        
        {/* Texte */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white">
            Installer Deep Sight
          </p>
          <p className="text-sm text-white/80 truncate">
            {platform === 'ios' 
              ? 'Ajoutez à l\'écran d\'accueil'
              : 'Accès rapide depuis votre appareil'
            }
          </p>
        </div>
        
        {/* Boutons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="px-4 py-2 bg-white text-accent-primary rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {isInstalling ? '...' : 'Installer'}
          </button>
          
          <button
            onClick={handleDismiss}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 UPDATE PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export const UpdatePrompt: React.FC = () => {
  const { updateAvailable, applyUpdate } = usePWA();
  
  if (!updateAvailable) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <div className="bg-bg-elevated rounded-xl p-4 shadow-lg border border-border-default">
        <p className="text-text-primary font-medium mb-2">
          🆕 Mise à jour disponible
        </p>
        <p className="text-sm text-text-secondary mb-4">
          Une nouvelle version de Deep Sight est prête.
        </p>
        <button
          onClick={applyUpdate}
          className="w-full py-2 bg-accent-primary hover:bg-accent-primary-hover rounded-lg font-medium text-white transition-colors"
        >
          Mettre à jour maintenant
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
