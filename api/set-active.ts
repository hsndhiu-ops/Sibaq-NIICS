import { createClient } from '@supabase/supabase-js';

/**
 * Serverless / Express Handler: /api/admin/set-active
 *
 * Sets active/deactivated status (is_active) on a user profile.
 * Only authenticated administrators can toggle account activation.
 * Never allows deactivating an admin or self.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed. Expected POST request.',
    });
  }

  try {
    const body = req.body || {};
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const active = Boolean(body.active);

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[set-active] Missing SUPABASE_SERVICE_ROLE_KEY.');
      return res.status(500).json({
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.',
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is an active admin
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!token) {
      return res.status(403).json({ error: 'Forbidden: Missing login token.' });
    }

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerData?.user) {
      return res.status(403).json({ error: 'Forbidden: Invalid login session.' });
    }

    const callerId = callerData.user.id;

    // Check caller profile
    const { data: callerProfile, error: callerProfError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerId)
      .single();

    if (callerProfError || callerProfile?.role !== 'admin' || callerProfile?.is_active === false) {
      return res.status(403).json({
        error: 'Forbidden: Only active administrators can activate or deactivate accounts.',
      });
    }

    // Prevent self-deactivation
    if (callerId === userId) {
      return res.status(400).json({
        error: 'You cannot deactivate your own admin account.',
      });
    }

    // Fetch target user profile
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, role')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetProfile.role === 'admin') {
      return res.status(400).json({ error: 'Cannot deactivate administrator accounts.' });
    }

    // Update is_active
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: active })
      .eq('id', userId);

    if (updateError) {
      console.error('[set-active] update error:', updateError);
      return res.status(500).json({ error: 'Failed to update account status.' });
    }

    console.log(
      `[AUDIT] Admin ${callerId} set is_active=${active} for ${targetProfile.role} ${targetProfile.username} (${userId})`
    );

    return res.status(200).json({
      success: true,
      userId,
      active,
      message: active ? 'Account activated.' : 'Account deactivated.',
    });
  } catch (err: any) {
    console.error('[set-active] Exception:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error while toggling account status.',
    });
  }
}
