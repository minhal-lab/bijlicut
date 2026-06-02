/**
 * notifications.js — BijliCut
 * ---------------------------------------------------------------------------
 * Local "Peak-Hour Smart Alarm" scheduling built on expo-notifications.
 *
 * Schedules two repeating DAILY local notifications:
 *   • 6:00 PM  → peak hours begin (high priority)
 *   • 10:00 PM → off-peak resumes
 *
 * No remote push, no server — purely on-device scheduled alarms.
 * ---------------------------------------------------------------------------
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const PEAK_CHANNEL_ID = 'peak-hour-alerts';
const PEAK_START_ID = 'bijlicut-peak-start';
const PEAK_END_ID = 'bijlicut-peak-end';

// Show the alert as a banner (and play sound) even when the app is foregrounded.
// SDK 54 uses shouldShowBanner / shouldShowList (shouldShowAlert is deprecated).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Android requires a high-importance channel for heads-up, high-priority alerts. */
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PEAK_CHANNEL_ID, {
    name: 'Peak Hour Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#f4b400',
    sound: 'default',
  });
}

/**
 * Ask for notification permission (idempotent — won't re-prompt if already set).
 * @returns {Promise<boolean>} whether permission is granted.
 */
export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted' && current.canAskAgain !== false) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  return status === 'granted';
}

/**
 * Schedule (or re-schedule) both daily peak-hour alarms. Cancels any existing
 * ones first so toggling on repeatedly never stacks duplicates.
 */
export async function schedulePeakAlerts() {
  await ensureAndroidChannel();
  await cancelPeakAlerts();

  await Notifications.scheduleNotificationAsync({
    identifier: PEAK_START_ID,
    content: {
      title: '⚡ PEAK HOURS STARTED!',
      body: 'High tax rates active. Please turn off ACs, water pumps, and heavy appliances to save on your bill!',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: '#ef4444',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18, // 6:00 PM
      minute: 0,
      channelId: PEAK_CHANNEL_ID,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: PEAK_END_ID,
    content: {
      title: '✅ Off-Peak Hours Active!',
      body: 'Standard rates have resumed.',
      sound: 'default',
      color: '#22c55e',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 22, // 10:00 PM
      minute: 0,
      channelId: PEAK_CHANNEL_ID,
    },
  });
}

/** Cancel both scheduled peak-hour alarms (safe to call when none exist). */
export async function cancelPeakAlerts() {
  try {
    await Notifications.cancelScheduledNotificationAsync(PEAK_START_ID);
    await Notifications.cancelScheduledNotificationAsync(PEAK_END_ID);
  } catch {
    // No-op: nothing scheduled yet.
  }
}

/**
 * Whether our peak alarms are currently scheduled — lets the UI restore the
 * toggle state on app launch.
 * @returns {Promise<boolean>}
 */
export async function arePeakAlertsScheduled() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ids = scheduled.map((n) => n.identifier);
  return ids.includes(PEAK_START_ID) || ids.includes(PEAK_END_ID);
}
