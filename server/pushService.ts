import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Default VAPID Keys (can be overridden via environment variables)
export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BHwBdPBy2bN4uH8n2oyGa6QZ50lFLV1vZHXqpLSF-1TP38MP77lM5Db5LD7nzCwJLua8RDrKVUfJYlWdrBj5SE8';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'ya07btYgnwhoOD3nSi5RgWNBp-AZe-NN6VbUCwRSv8Q';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ||
  'https://sibaq-niics.vercel.app/';

// Configure web-push with VAPID details
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error('[WebPush] Error configuring VAPID details:', err);
}

// Supabase client instance
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
}

/**
 * Save or update a user's web push subscription in Supabase
 */
export async function savePushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  userAgent?: string
): Promise<{ success: boolean; message?: string }> {
  if (!supabaseAdmin) {
    throw new Error('Supabase client not initialized for push notifications');
  }

  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Invalid subscription object: missing endpoint or cryptographic keys');
  }

  // Check if subscription already exists for this endpoint
  const { data: existing } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, user_id')
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (existing) {
    // Update existing subscription record with current user and keys
    const { error: updateErr } = await supabaseAdmin
      .from('push_subscriptions')
      .update({
        user_id: userId,
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        user_agent: userAgent || null,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateErr) {
      console.error('[WebPush] Error updating subscription:', updateErr);
      throw new Error(updateErr.message);
    }
  } else {
    // Insert new subscription record
    const { error: insertErr } = await supabaseAdmin
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint,
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        user_agent: userAgent || null,
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      });

    if (insertErr) {
      console.error('[WebPush] Error saving subscription:', insertErr);
      throw new Error(insertErr.message);
    }
  }

  return { success: true };
}

/**
 * Remove an endpoint subscription from Supabase
 */
export async function removePushSubscription(endpoint: string): Promise<boolean> {
  if (!supabaseAdmin || !endpoint) return false;

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[WebPush] Error removing subscription:', error);
    return false;
  }
  return true;
}

/**
 * Send a Web Push notification to all subscriptions of a specific user
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!supabaseAdmin) {
    console.warn('[WebPush] Supabase admin not configured');
    return { sent: 0, failed: 0 };
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('user_id', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const notificationData = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || 'general-notification',
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
  });

  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh_key,
        auth: sub.auth_key,
      },
    };

    try {
      await webpush.sendNotification(pushSub, notificationData);
      sent++;
      // Update last_used_at timestamp
      supabaseAdmin
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', sub.id)
        .then(() => {});
    } catch (err: any) {
      failed++;
      console.warn(`[WebPush] Push failed for endpoint (status ${err.statusCode}):`, err.message || err);

      // Status 404 or 410 indicates the subscription is expired or unsubscribed
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log('[WebPush] Cleaning up expired subscription:', sub.id);
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id);
      }
    }
  }

  return { sent, failed };
}

/**
 * Send a Web Push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  for (const uid of uniqueIds) {
    const res = await sendPushNotificationToUser(uid, payload);
    totalSent += res.sent;
    totalFailed += res.failed;
  }

  return { sent: totalSent, failed: totalFailed };
}
