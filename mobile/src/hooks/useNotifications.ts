/**
 * useNotifications Hook - React Native notifications management
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from '../types';
import {
  initializeNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  setBadgeCount,
  getBadgeCount,
  clearBadge,
  NotificationType,
} from '../services/notifications';

interface NotificationState {
  isInitialized: boolean;
  permissionGranted: boolean;
  pushToken: string | null;
  badgeCount: number;
  lastNotification: Notifications.Notification | null;
}

interface NotificationHookResult {
  state: NotificationState;
  initialize: () => Promise<void>;
  updateBadgeCount: (count: number) => Promise<void>;
  clearBadgeCount: () => Promise<void>;
  handleNotificationNavigation: (data: Record<string, unknown>) => void;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function useNotifications(): NotificationHookResult {
  const navigation = useNavigation<NavigationProp>();
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const isMountedRef = useRef(true);

  const [state, setState] = useState<NotificationState>({
    isInitialized: false,
    permissionGranted: false,
    pushToken: null,
    badgeCount: 0,
    lastNotification: null,
  });

  // Handle notification navigation based on data payload
  const handleNotificationNavigation = useCallback(
    (data: Record<string, unknown>) => {
      const screen = data.screen as string | undefined;
      const _type = data.type as NotificationType | undefined;

      if (!screen) return;

      switch (screen) {
        case 'Analysis':
          if (data.summaryId) {
            navigation.navigate('Analysis', { summaryId: data.summaryId as string });
          }
          break;
        case 'Playlists':
          navigation.navigate('MainTabs', { screen: 'Playlists' } as any);
          break;
        case 'Upgrade':
          navigation.navigate('Upgrade');
          break;
        case 'Account':
          navigation.navigate('Account');
          break;
        case 'Dashboard':
          navigation.navigate('Main');
          break;
        default:
          navigation.navigate('Main');
      }
    },
    [navigation]
  );

  // Initialize notifications
  const initialize = useCallback(async () => {
    try {
      const { permissionGranted, pushToken } = await initializeNotifications();
      if (!isMountedRef.current) return;

      // Get current badge count
      const badgeCount = await getBadgeCount();
      if (!isMountedRef.current) return;

      setState((prev) => ({
        ...prev,
        isInitialized: true,
        permissionGranted,
        pushToken,
        badgeCount,
      }));

      // Check for notification that launched the app (cold start)
      const lastResponse = await getLastNotificationResponse();
      if (lastResponse?.notification.request.content.data) {
        handleNotificationNavigation(
          lastResponse.notification.request.content.data as Record<string, unknown>
        );
      }
    } catch (error) {
      if (__DEV__) { console.error('Failed to initialize notifications:', error); }
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isInitialized: true,
          permissionGranted: false,
        }));
      }
    }
  }, [handleNotificationNavigation]);

  // Update badge count
  const updateBadgeCount = useCallback(async (count: number) => {
    await setBadgeCount(count);
    setState((prev) => ({ ...prev, badgeCount: count }));
  }, []);

  // Clear badge count
  const clearBadgeCount = useCallback(async () => {
    await clearBadge();
    setState((prev) => ({ ...prev, badgeCount: 0 }));
  }, []);

  // Set up notification listeners
  useEffect(() => {
    isMountedRef.current = true;
    // Notification received while app is foregrounded
    notificationListener.current = addNotificationReceivedListener((notification) => {
      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        lastNotification: notification,
        badgeCount: prev.badgeCount + 1,
      }));
    });

    // User tapped on notification
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      handleNotificationNavigation(data);

      // Clear badge when notification is tapped
      clearBadgeCount();
    });

    // Cleanup
    return () => {
      isMountedRef.current = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleNotificationNavigation, clearBadgeCount]);

  return {
    state,
    initialize,
    updateBadgeCount,
    clearBadgeCount,
    handleNotificationNavigation,
  };
}

/**
 * Hook to use notifications in background analysis monitoring
 */
export function useAnalysisNotifications() {
  const { state, initialize } = useNotifications();
  const [activeAnalyses, setActiveAnalyses] = useState<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Start monitoring an analysis task
  const monitorAnalysis = useCallback(
    async (taskId: string, videoTitle: string, checkInterval = 5000) => {
      // Import lazily to avoid circular dependencies
      const { videoApi } = await import('../services/api');
      const { notifyAnalysisComplete, notifyAnalysisFailed } = await import(
        '../services/notifications'
      );

      const checkStatus = async () => {
        try {
          const status = await videoApi.getStatus(taskId);

          if (status.status === 'completed' && status.summary_id) {
            // Clear the interval
            const interval = activeAnalyses.get(taskId);
            if (interval) {
              clearInterval(interval);
              setActiveAnalyses((prev) => {
                const next = new Map(prev);
                next.delete(taskId);
                return next;
              });
            }

            // Show notification
            await notifyAnalysisComplete(videoTitle, status.summary_id);
          } else if (status.status === 'failed') {
            // Clear the interval
            const interval = activeAnalyses.get(taskId);
            if (interval) {
              clearInterval(interval);
              setActiveAnalyses((prev) => {
                const next = new Map(prev);
                next.delete(taskId);
                return next;
              });
            }

            // Show failure notification
            await notifyAnalysisFailed(videoTitle, status.error);
          }
        } catch (error) {
          if (__DEV__) { console.error('Error checking analysis status:', error); }
        }
      };

      // Start interval check
      const interval = setInterval(checkStatus, checkInterval);
      setActiveAnalyses((prev) => new Map(prev).set(taskId, interval));

      // Initial check
      checkStatus();
    },
    [activeAnalyses]
  );

  // Stop monitoring an analysis
  const stopMonitoring = useCallback(
    (taskId: string) => {
      const interval = activeAnalyses.get(taskId);
      if (interval) {
        clearInterval(interval);
        setActiveAnalyses((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [activeAnalyses]
  );

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      activeAnalyses.forEach((interval) => clearInterval(interval));
    };
  }, []);

  return {
    isReady: state.isInitialized && state.permissionGranted,
    initialize,
    monitorAnalysis,
    stopMonitoring,
    activeCount: activeAnalyses.size,
  };
}

export default useNotifications;
