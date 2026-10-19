import { useState, useEffect, useCallback } from 'react';
import {
  isPushNotificationSupported,
  getCurrentPushSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestPushNotification,
} from '../lib/pushNotifications';

export interface UsePushNotificationsResult {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTest: () => Promise<{ success: boolean; message?: string }>;
}

/**
 * Custom React hook for managing Web Push Notification permissions and subscriptions
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize and check status
  useEffect(() => {
    const supported = isPushNotificationSupported();
    setIsSupported(supported);

    if (!supported) {
      setLoading(false);
      return;
    }

    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }

    // Check if there is an active push subscription
    getCurrentPushSubscription()
      .then((sub) => {
        setIsSubscribed(Boolean(sub));
      })
      .catch((err) => {
        console.warn('[usePushNotifications] Error checking subscription:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Request permission and subscribe
  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    setLoading(true);

    try {
      const res = await subscribeToPushNotifications();
      if (res.success) {
        setIsSubscribed(true);
        if (typeof Notification !== 'undefined') {
          setPermission(Notification.permission);
        }
        setLoading(false);
        return true;
      } else {
        setError(res.error || 'Subscription failed');
        if (typeof Notification !== 'undefined') {
          setPermission(Notification.permission);
        }
        setLoading(false);
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while subscribing');
      setLoading(false);
      return false;
    }
  }, []);

  // Unsubscribe
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    setLoading(true);

    try {
      const res = await unsubscribeFromPushNotifications();
      if (res.success) {
        setIsSubscribed(false);
        setLoading(false);
        return true;
      } else {
        setError(res.error || 'Unsubscription failed');
        setLoading(false);
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while unsubscribing');
      setLoading(false);
      return false;
    }
  }, []);

  // Send a test push notification
  const sendTest = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    setError(null);
    try {
      const res = await sendTestPushNotification();
      if (!res.success) {
        setError(res.error || 'Test notification failed');
      }
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to send test push notification');
      return { success: false, message: err.message };
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  };
}
