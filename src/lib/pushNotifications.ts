/**
 * Web Push Notification client-side utility functions for PWA.
 */

/**
 * Converts a base64url-encoded VAPID public key into a Uint8Array required by pushManager.subscribe()
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether the current browser/device supports Web Push Notifications and Service Workers
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Fetch the VAPID public key from backend or environment variable
 */
export async function getVapidPublicKey(): Promise<string> {
  // 1. Try environment variable
  const envKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
  if (envKey) return envKey;

  // 2. Fetch from backend route
  try {
    const res = await fetch('/api/notifications/vapid-public-key');
    if (res.ok) {
      const data = await res.json();
      if (data.publicKey) return data.publicKey;
    }
  } catch (err) {
    console.warn('[Push] Error fetching VAPID public key:', err);
  }

  // 3. Fallback default key
  return 'BHwBdPBy2bN4uH8n2oyGa6QZ50lFLV1vZHXqpLSF-1TP38MP77lM5Db5LD7nzCwJLua8RDrKVUfJYlWdrBj5SE8';
}

/**
 * Get current active PushSubscription if already subscribed
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[Push] Error getting current subscription:', err);
    return null;
  }
}

/**
 * Prompt user for permission, subscribe to PushManager, and register with backend
 */
export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      error: 'Web Push Notifications are not supported by this browser.',
    };
  }

  try {
    // 1. Request notification permission from the user
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error:
          permission === 'denied'
            ? 'Notification permission was denied. Please enable notifications in your browser settings.'
            : 'Notification permission was dismissed.',
      };
    }

    // 2. Wait for Service Worker registration
    const registration = await navigator.serviceWorker.ready;

    // 3. Check for existing subscription or create new one
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const vapidPublicKey = await getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    // 4. Send subscription JSON payload to backend
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save subscription on server');
    }

    return { success: true, subscription };
  } catch (err: any) {
    console.error('[Push] Subscribe error:', err);
    return {
      success: false,
      error: err.message || 'Failed to subscribe to push notifications.',
    };
  }
}

/**
 * Unsubscribe from PushManager and notify backend
 */
export async function unsubscribeFromPushNotifications(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isPushNotificationSupported()) return { success: true };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Push] Unsubscribe error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger a test push notification to verify delivery
 */
export async function sendTestPushNotification(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/notifications/test-push', {
      method: 'POST',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to send test push');
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
