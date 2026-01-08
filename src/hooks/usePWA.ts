/**
 * 📱 usePWA Hook v1.0
 * 
 * Hook React pour gérer l'installation de la PWA:
 * - Détection de la possibilité d'installation
 * - Prompt d'installation
 * - État d'installation
 * - Détection du mode standalone
 * - Mise à jour du Service Worker
 */

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAState {
  /** L'app peut être installée */
  canInstall: boolean;
  /** L'app est déjà installée (mode standalone) */
  isInstalled: boolean;
  /** L'app est en cours d'installation */
  isInstalling: boolean;
  /** Plateforme détectée */
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  /** Service Worker enregistré */
  swRegistered: boolean;
  /** Mise à jour disponible */
  updateAvailable: boolean;
  /** Installation refusée par l'utilisateur */
  installDismissed: boolean;
}

interface PWAActions {
  /** Déclencher le prompt d'installation */
  promptInstall: () => Promise<boolean>;
  /** Appliquer la mise à jour du SW */
  applyUpdate: () => void;
  /** Réinitialiser l'état dismissed */
  resetDismissed: () => void;
}

export function usePWA(): PWAState & PWAActions {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Détecter la plateforme
  const detectPlatform = useCallback((): 'ios' | 'android' | 'desktop' | 'unknown' => {
    const ua = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(ua)) {
      return 'ios';
    }
    if (/android/.test(ua)) {
      return 'android';
    }
    if (/windows|mac|linux/.test(ua) && !/mobile/.test(ua)) {
      return 'desktop';
    }
    return 'unknown';
  }, []);

  // Vérifier si l'app est en mode standalone (installée)
  const isInstalled = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );

  const platform = detectPlatform();

  // Enregistrer le Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Enregistrer le SW
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope);
          setSwRegistered(true);
          setSwRegistration(registration);

          // Vérifier les mises à jour
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New version available');
                  setUpdateAvailable(true);
                }
              });
            }
          });

          // Vérifier périodiquement les mises à jour (toutes les heures)
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });

      // Écouter les messages du SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          setUpdateAvailable(true);
        }
      });
    }
  }, []);

  // Écouter l'événement beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt captured');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Écouter l'installation réussie
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsInstalling(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Déclencher le prompt d'installation
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[PWA] No deferred prompt available');
      return false;
    }

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('[PWA] User choice:', outcome);
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setCanInstall(false);
        return true;
      } else {
        setInstallDismissed(true);
        // Sauvegarder en localStorage pour ne pas redemander trop souvent
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        return false;
      }
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      return false;
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt]);

  // Appliquer la mise à jour du SW
  const applyUpdate = useCallback(() => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [swRegistration]);

  // Réinitialiser l'état dismissed
  const resetDismissed = useCallback(() => {
    setInstallDismissed(false);
    localStorage.removeItem('pwa-install-dismissed');
  }, []);

  // Vérifier si l'utilisateur a déjà refusé récemment
  useEffect(() => {
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setInstallDismissed(true);
      } else {
        localStorage.removeItem('pwa-install-dismissed');
      }
    }
  }, []);

  return {
    canInstall,
    isInstalled,
    isInstalling,
    platform,
    swRegistered,
    updateAvailable,
    installDismissed,
    promptInstall,
    applyUpdate,
    resetDismissed,
  };
}

export default usePWA;
