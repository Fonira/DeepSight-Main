/**
 * Notifications Service - Real-time notifications for DeepSight Mobile
 * Integrates with expo-notifications for local and push notifications
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Notification types
export type NotificationType =
  | 'analysis_complete'
  | 'analysis_failed'
  | 'playlist_complete'
  | 'credits_low'
  | 'credits_empty'
  | 'subscription_expiring'
  | 'new_feature'
  | 'weekly_summary';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Notifications require a physical device');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }

  return true;
}

/**
 * Get push token for backend registration
 */
export async function getPushToken(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.log('No project ID found for push notifications');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Configure notification channels (Android)
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    // Analysis notifications
    await Notifications.setNotificationChannelAsync('analysis', {
      name: 'Analysis Updates',
      description: 'Notifications about video analysis progress',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      sound: 'default',
    });

    // Credit notifications
    await Notifications.setNotificationChannelAsync('credits', {
      name: 'Credit Alerts',
      description: 'Notifications about credit usage',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F59E0B',
    });

    // General notifications
    await Notifications.setNotificationChannelAsync('general', {
      name: 'General Updates',
      description: 'General app notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/**
 * Get notification channel for type
 */
function getChannelForType(type: NotificationType): string {
  switch (type) {
    case 'analysis_complete':
    case 'analysis_failed':
    case 'playlist_complete':
      return 'analysis';
    case 'credits_low':
    case 'credits_empty':
      return 'credits';
    default:
      return 'general';
  }
}

/**
 * Get icon for notification type
 */
function getIconForType(type: NotificationType): string {
  switch (type) {
    case 'analysis_complete':
      return 'checkmark-circle';
    case 'analysis_failed':
      return 'close-circle';
    case 'playlist_complete':
      return 'albums';
    case 'credits_low':
      return 'warning';
    case 'credits_empty':
      return 'alert-circle';
    case 'subscription_expiring':
      return 'time';
    case 'new_feature':
      return 'sparkles';
    case 'weekly_summary':
      return 'analytics';
    default:
      return 'notifications';
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  payload: NotificationPayload,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  const notificationContent: Notifications.NotificationContentInput = {
    title: payload.title,
    body: payload.body,
    data: {
      type: payload.type,
      ...payload.data,
    },
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.HIGH,
  };

  // Add channel for Android
  if (Platform.OS === 'android') {
    (notificationContent as any).channelId = getChannelForType(payload.type);
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: notificationContent,
    trigger: trigger || null, // null = immediate
  });

  return identifier;
}

/**
 * Show immediate notification (helper)
 */
export async function showNotification(
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  return scheduleLocalNotification({
    type,
    title,
    body,
    data,
  });
}

/**
 * Schedule notification for analysis complete
 */
export async function notifyAnalysisComplete(
  videoTitle: string,
  summaryId: string
): Promise<string> {
  return showNotification(
    'analysis_complete',
    'Analysis Complete! ✓',
    `"${videoTitle}" is ready to view`,
    { summaryId, screen: 'Analysis' }
  );
}

/**
 * Schedule notification for analysis failed
 */
export async function notifyAnalysisFailed(
  videoTitle: string,
  error?: string
): Promise<string> {
  return showNotification(
    'analysis_failed',
    'Analysis Failed',
    error || `Could not analyze "${videoTitle}"`,
    { screen: 'Dashboard' }
  );
}

/**
 * Schedule notification for playlist complete
 */
export async function notifyPlaylistComplete(
  playlistName: string,
  videoCount: number,
  playlistId: string
): Promise<string> {
  return showNotification(
    'playlist_complete',
    'Playlist Analysis Complete! ✓',
    `${videoCount} videos from "${playlistName}" are ready`,
    { playlistId, screen: 'Playlists' }
  );
}

/**
 * Schedule notification for low credits
 */
export async function notifyCreditsLow(
  remainingCredits: number
): Promise<string> {
  return showNotification(
    'credits_low',
    'Credits Running Low',
    `You have ${remainingCredits} credits remaining. Upgrade for more!`,
    { screen: 'Upgrade' }
  );
}

/**
 * Schedule notification for empty credits
 */
export async function notifyCreditsEmpty(): Promise<string> {
  return showNotification(
    'credits_empty',
    'Credits Depleted',
    'Upgrade your plan to continue analyzing videos',
    { screen: 'Upgrade' }
  );
}

/**
 * Schedule notification for subscription expiring
 */
export async function notifySubscriptionExpiring(
  daysRemaining: number
): Promise<string> {
  return showNotification(
    'subscription_expiring',
    'Subscription Expiring Soon',
    `Your subscription expires in ${daysRemaining} days`,
    { screen: 'Account' }
  );
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Set badge count (iOS)
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Get badge count (iOS)
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Clear badge
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Add notification received listener
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Add notification response listener (when user taps notification)
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Get last notification response (for cold start)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

/**
 * Initialize notification system
 */
export async function initializeNotifications(): Promise<{
  permissionGranted: boolean;
  pushToken: string | null;
}> {
  // Setup channels (Android)
  await setupNotificationChannels();

  // Request permissions
  const permissionGranted = await requestNotificationPermissions();

  // Get push token
  const pushToken = permissionGranted ? await getPushToken() : null;

  return { permissionGranted, pushToken };
}

export default {
  initializeNotifications,
  requestNotificationPermissions,
  getPushToken,
  setupNotificationChannels,
  scheduleLocalNotification,
  showNotification,
  notifyAnalysisComplete,
  notifyAnalysisFailed,
  notifyPlaylistComplete,
  notifyCreditsLow,
  notifyCreditsEmpty,
  notifySubscriptionExpiring,
  cancelNotification,
  cancelAllNotifications,
  getScheduledNotifications,
  setBadgeCount,
  getBadgeCount,
  clearBadge,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
};
