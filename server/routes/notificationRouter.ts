import { Router } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';
import {
  VAPID_PUBLIC_KEY,
  savePushSubscription,
  removePushSubscription,
  sendPushNotificationToUser,
} from '../pushService';

const router = Router();

// Public endpoint: Fetch VAPID public key needed by browser pushManager
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// All following routes require authenticated user
router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res) => {
  const notifications = db.getNotificationsForUser(req.user!.id);
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ notifications, unreadCount });
});

router.post('/read-all', (req: AuthenticatedRequest, res) => {
  db.markNotificationsRead(req.user!.id);
  res.json({ success: true });
});

// Save or update browser Web Push subscription
router.post('/subscribe', async (req: AuthenticatedRequest, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing subscription or endpoint' });
    }

    const userAgent = req.headers['user-agent'] || undefined;
    await savePushSubscription(req.user!.id, subscription, userAgent);

    res.json({ success: true, message: 'Push subscription registered successfully' });
  } catch (err: any) {
    console.error('[/api/notifications/subscribe] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to save push subscription' });
  }
});

// Unsubscribe browser from push notifications
router.post('/unsubscribe', async (req: AuthenticatedRequest, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required to unsubscribe' });
    }

    await removePushSubscription(endpoint);
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (err: any) {
    console.error('[/api/notifications/unsubscribe] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to remove push subscription' });
  }
});

// Test endpoint: Send a test push notification to verify mobile background delivery
router.post('/test-push', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const result = await sendPushNotificationToUser(user.id, {
      title: 'DHIU Arts Fest',
      body: `Hello ${user.fullName || user.username}! Native Web Push notifications are now working on your device.`,
      url: '/',
      tag: 'test-push',
    });

    if (result.sent === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active push subscriptions found for this device. Please grant notification permission first.',
      });
    }

    res.json({
      success: true,
      sentCount: result.sent,
      message: `Test push notification sent successfully to ${result.sent} device(s).`,
    });
  } catch (err: any) {
    console.error('[/api/notifications/test-push] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to send test push notification' });
  }
});

// Dispatch web push to a list of recipients (e.g. from admin/guide broadcast)
router.post('/dispatch', async (req: AuthenticatedRequest, res) => {
  try {
    const { recipients, title, message, url } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }

    const { sendPushNotificationToUsers } = await import('../pushService');
    const result = await sendPushNotificationToUsers(recipients, {
      title: title || 'DHIU Arts Fest',
      body: message || 'You have a new update.',
      url: url || '/',
      tag: 'announcement',
    });

    res.json({ success: true, sent: result.sent, failed: result.failed });
  } catch (err: any) {
    console.error('[/api/notifications/dispatch] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to dispatch push notifications' });
  }
});

export default router;
