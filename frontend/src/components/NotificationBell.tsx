/**
 * 🔔 NotificationBell Component v1.0
 * 
 * Icône de cloche avec badge pour les notifications.
 * Affiche un dropdown avec la liste des notifications récentes.
 */

import { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { useNotifications, DeepSightNotification } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

interface NotificationBellProps {
  onAnalysisComplete?: (summaryId: number) => void;
}

export function NotificationBell({ onAnalysisComplete }: NotificationBellProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    browserPermission,
    requestBrowserPermission,
    clearNotifications,
    markAsRead,
  } = useNotifications({
    enableBrowserNotifications: true,
    onAnalysisComplete: (summaryId, videoTitle) => {
      onAnalysisComplete?.(summaryId);
    },
  });

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formater le temps relatif
  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString('fr-FR');
  };

  // Icône selon le type de notification
  const getIcon = (type: DeepSightNotification['type']) => {
    switch (type) {
      case 'analysis_complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'analysis_error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  // Gérer le clic sur une notification
  const handleNotificationClick = (notification: DeepSightNotification, index: number) => {
    if (notification.data?.action_url) {
      navigate(notification.data.action_url);
    } else if (notification.data?.summary_id) {
      navigate(`/dashboard?id=${notification.data.summary_id}`);
    }
    markAsRead(index);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton de la cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} non lues)` : ''}`}
      >
        <Bell className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
        
        {/* Badge de compteur */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-purple-500 rounded-full animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown des notifications */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex gap-2">
              {browserPermission !== 'granted' && (
                <button
                  onClick={requestBrowserPermission}
                  className="text-xs text-purple-400 hover:text-purple-300"
                  title="Activer les notifications navigateur"
                >
                  Activer
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Tout effacer
                </button>
              )}
            </div>
          </div>

          {/* Liste des notifications */}
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucune notification</p>
              <p className="text-xs mt-1">
                Les notifications apparaîtront ici quand vos analyses seront terminées
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {notifications
                .filter(n => n.type !== 'connected' && n.type !== 'heartbeat')
                .slice(0, 10)
                .map((notification, index) => (
                  <li
                    key={`${notification.timestamp}-${index}`}
                    className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => handleNotificationClick(notification, index)}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimeAgo(notification.timestamp)}
                        </p>
                      </div>
                      {notification.data?.action_url && (
                        <ExternalLink className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          )}

          {/* Footer avec status de permission */}
          <div className="p-3 border-t border-gray-700 bg-gray-800/50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {browserPermission === 'granted' ? (
                  <span className="flex items-center gap-1 text-green-500">
                    <Check className="w-3 h-3" /> Notifications activées
                  </span>
                ) : browserPermission === 'denied' ? (
                  <span className="flex items-center gap-1 text-red-400">
                    <X className="w-3 h-3" /> Notifications bloquées
                  </span>
                ) : (
                  <span>Notifications non activées</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
