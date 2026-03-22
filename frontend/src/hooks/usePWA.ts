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
  const isInstalled = (() => {
    try {
      return typeof window !== 'undefined' && (
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://')
      );
    } catch {
      return false;
    }
  })();

  const platform = detectPlatform();

  // Enregistrer le Service Worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let updateInterval: ReturnType<typeof setInterval> | undefined;

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.addEventListener('message', onSwMessage);

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        setSwRegistered(true);
        setSwRegistration(registration);

        // Vérifier les mises à jour
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        // Vérifier périodiquement les mises à jour (toutes les heures)
        updateInterval = setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
      if (updateInterval !== undefined) clearInterval(updateInterval);
    };
  }, []);

  // Écouter l'événement beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Écouter l'installation réussie
    window.addEventListener('appinstalled', () => {
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
      return false;
    }

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setCanInstall(false);
        return true;
      } else {
        setInstallDismissed(true);
        // Sauvegarder en localStorage pour ne pas redemander trop souvent
        try { localStorage.setItem('pwa-install-dismissed', Date.now().toString()); } catch { /* */ }
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
    try { localStorage.removeItem('pwa-install-dismissed'); } catch { /* Safari private */ }
  }, []);

  // Vérifier si l'utilisateur a déjà refusé récemment
  useEffect(() => {
    try {
      const dismissedAt = localStorage.getItem('pwa-install-dismissed');
      if (dismissedAt) {
        const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
          setInstallDismissed(true);
        } else {
          localStorage.removeItem('pwa-install-dismissed');
        }
      }
    } catch { /* Safari private mode */ }
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
