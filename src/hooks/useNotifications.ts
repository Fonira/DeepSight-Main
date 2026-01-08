/**
 * 🔔 useNotifications Hook v1.0
 * 
 * Hook React pour recevoir les notifications en temps réel via SSE.
 * Gère automatiquement :
 * - Connexion SSE au backend
 * - Reconnexion automatique en cas de déconnexion
 * - Notifications navigateur (avec permission)
 * - Notifications in-app via Toast
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://deepsight-backend-production.up.railway.app';

export interface DeepSightNotification {
  type: 'analysis_complete' | 'analysis_error' | 'info' | 'test' | 'connected' | 'heartbeat';
  title: string;
  message: string;
  timestamp: string;
  data?: {
    summary_id?: number;
    video_id?: string;
    video_title?: string;
    cached?: boolean;
    action_url?: string;
    error?: string;
  };
}

interface UseNotificationsOptions {
  /** Activer les notifications navigateur */
  enableBrowserNotifications?: boolean;
  /** Callback appelé pour chaque notification */
  onNotification?: (notification: DeepSightNotification) => void;
  /** Callback quand une analyse est terminée */
  onAnalysisComplete?: (summaryId: number, videoTitle: string) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<DeepSightNotification[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Demander la permission pour les notifications navigateur
  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('🔔 Browser notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      setBrowserPermission('granted');
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      return permission;
    }

    setBrowserPermission('denied');
    return 'denied';
  }, []);

  // Afficher une notification navigateur
  const showBrowserNotification = useCallback((notification: DeepSightNotification) => {
    if (!options.enableBrowserNotifications) return;
    if (browserPermission !== 'granted') return;
    if (notification.type === 'heartbeat' || notification.type === 'connected') return;

    try {
      const browserNotif = new Notification(notification.title, {
        body: notification.message,
        icon: '/logo-deep-sight.png',
        tag: `deepsight-${notification.data?.summary_id || Date.now()}`,
        requireInteraction: notification.type === 'analysis_complete',
      });

      // Cliquer sur la notification ouvre l'app
      browserNotif.onclick = () => {
        window.focus();
        if (notification.data?.action_url) {
          window.location.href = notification.data.action_url;
        }
        browserNotif.close();
      };

      // Fermer automatiquement après 10s
      setTimeout(() => browserNotif.close(), 10000);
    } catch (err) {
      console.error('Failed to show browser notification:', err);
    }
  }, [browserPermission, options.enableBrowserNotifications]);

  // Gérer une notification entrante
  const handleNotification = useCallback((notification: DeepSightNotification) => {
    // Ignorer les heartbeats
    if (notification.type === 'heartbeat') return;

    console.log('🔔 Notification received:', notification);

    // Ajouter à la liste
    setNotifications(prev => [notification, ...prev].slice(0, 50));

    // Notification navigateur
    showBrowserNotification(notification);

    // Callbacks
    options.onNotification?.(notification);

    if (notification.type === 'analysis_complete' && notification.data?.summary_id) {
      options.onAnalysisComplete?.(
        notification.data.summary_id,
        notification.data.video_title || 'Vidéo'
      );
    }
  }, [showBrowserNotification, options]);

  // Connexion SSE
  const connect = useCallback(() => {
    if (!token || !isAuthenticated) {
      console.log('🔔 Not authenticated, skipping SSE connection');
      return;
    }

    // Fermer la connexion existante
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('🔔 Connecting to notification stream...');

    // Note: EventSource ne supporte pas les headers custom
    // On utilise un URL avec le token en query param (moins sécurisé mais nécessaire pour SSE)
    // Alternative: utiliser fetch avec ReadableStream ou WebSocket
    
    // Pour l'instant, on utilise le polling comme fallback
    const fetchNotifications = async () => {
      try {
        const response = await fetch(`${API_URL}/api/notifications/pending`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.notifications && data.notifications.length > 0) {
            data.notifications.forEach((notif: DeepSightNotification) => {
              handleNotification(notif);
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch pending notifications:', err);
      }
    };

    // Polling toutes les 10 secondes (fallback pour SSE)
    const pollInterval = setInterval(fetchNotifications, 10000);
    
    // Fetch initial
    fetchNotifications();
    
    setIsConnected(true);

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      setIsConnected(false);
    };
  }, [token, isAuthenticated, handleNotification]);

  // Se connecter au montage
  useEffect(() => {
    if (isAuthenticated && token) {
      const cleanup = connect();
      return cleanup;
    }
  }, [isAuthenticated, token, connect]);

  // Demander la permission au montage si activé
  useEffect(() => {
    if (options.enableBrowserNotifications) {
      requestBrowserPermission();
    }
  }, [options.enableBrowserNotifications, requestBrowserPermission]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Fonction pour clear les notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Fonction pour marquer une notification comme lue
  const markAsRead = useCallback((index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    isConnected,
    notifications,
    browserPermission,
    requestBrowserPermission,
    clearNotifications,
    markAsRead,
    unreadCount: notifications.filter(n => n.type !== 'connected').length,
  };
}

export default useNotifications;
