import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Configure notification handler behavior.
 * Determines how notifications are displayed when the app is in the foreground.
 */
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
 * Register for push notifications and save the Expo push token.
 * Returns the push token string or null if registration fails.
 */
export async function registerForPushNotifications(userId?: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied');
    return null;
  }

  // Get Expo push token. projectId comes from the resolved Expo config
  // (extra.eas.projectId) — the single source of truth — never a hardcoded UUID.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (!projectId) {
    console.warn('[notifications] No EAS projectId configured; cannot register for push.');
    return null;
  }
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  const token = tokenData.data;

  // Save token to user profile in Supabase
  if (userId && token) {
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);
    if (error) {
      console.warn('[notifications] Failed to save push token:', error.message);
    }
  }

  // Android notification channels
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Urgent',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      sound: 'default',
    });
  }

  return token;
}

/**
 * Add a listener for notifications received while the app is foregrounded.
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for when the user taps on a notification.
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the number of badge count (iOS).
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Dispatch a push notification to a specific user via the send-push edge function.
 * Called after inserting a notification record in the database.
 */
export async function dispatchPushNotification(record: {
  user_id: string;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, any>;
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const { error } = await supabase.functions.invoke('send-push', {
      body: { record },
    });
    if (error) {
      console.warn('[Notifications] Push dispatch failed:', error.message);
    }
  } catch (err) {
    console.warn('[Notifications] Push dispatch error:', err);
  }
}
