import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: /api/reset-password
 *
 * Secure server-side password reset using Supabase Service Role Key.
 * Updates user password in Supabase Auth via Admin API.
 */
export default async function handler(req: any, res: any) {
  // 1. Enforce POST method
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed. Expected POST request.',
    });
  }

  try {
    const body = req.body || {};
    const userId = typeof body.userId === 'string' ? body.userId.trim() : (typeof body.id === 'string' ? body.id.trim() : '');
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : (typeof body.password === 'string' ? body.password : '');

    // 2. Validate input fields
    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required.',
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        error: 'New password is required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long.',
      });
    }

    // 3. Validate server environment variables
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Serverless Function Error: SUPABASE_SERVICE_ROLE_KEY is missing.');
      return res.status(500).json({
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. Please configure it in your Vercel project environment variables.',
      });
    }

    // 4. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 5. Update password via Supabase Auth Admin
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return res.status(400).json({
        error: error.message || 'Failed to update user password in Supabase Auth.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (err: any) {
    console.error('Serverless function exception in api/reset-password:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error while resetting password.',
    });
  }
}
