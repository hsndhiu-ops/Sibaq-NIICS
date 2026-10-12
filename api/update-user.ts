import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: /api/update-user
 *
 * Secure server-side profile update using Supabase Service Role Key.
 * Bypasses client-side Row Level Security (RLS) for administrator account management.
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

    // 2. Validate input fields
    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required.',
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

    // 5. Build profile update payload
    const updatePayload: Record<string, any> = {};

    if (body.fullName !== undefined) {
      updatePayload.full_name = typeof body.fullName === 'string' ? body.fullName.trim() : body.fullName;
    } else if (body.full_name !== undefined) {
      updatePayload.full_name = typeof body.full_name === 'string' ? body.full_name.trim() : body.full_name;
    }

    if (body.email !== undefined) {
      updatePayload.notification_email = body.email ? String(body.email).trim() : null;
    } else if (body.notificationEmail !== undefined) {
      updatePayload.notification_email = body.notificationEmail ? String(body.notificationEmail).trim() : null;
    } else if (body.notification_email !== undefined) {
      updatePayload.notification_email = body.notification_email ? String(body.notification_email).trim() : null;
    }

    if (body.guideId !== undefined) {
      updatePayload.guide_id = body.guideId ? String(body.guideId).trim() : null;
    } else if (body.guide_id !== undefined) {
      updatePayload.guide_id = body.guide_id ? String(body.guide_id).trim() : null;
    }

    if (body.username !== undefined) {
      updatePayload.username = typeof body.username === 'string' ? body.username.trim() : body.username;
    }

    if (body.role !== undefined) {
      updatePayload.role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : body.role;
    }

    if (body.isActive !== undefined) {
      updatePayload.is_active = Boolean(body.isActive);
    } else if (body.is_active !== undefined) {
      updatePayload.is_active = Boolean(body.is_active);
    }

    // 6. Update row in public.profiles table
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single();

    if (profileError || !updatedProfile) {
      return res.status(400).json({
        error: profileError?.message || 'Failed to update user profile in database.',
      });
    }

    // 7. Sync user_metadata in Auth if fullName was updated
    if (updatePayload.full_name) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            full_name: updatePayload.full_name,
          },
        });
      } catch (authErr) {
        console.warn('Note: Could not sync full_name to Auth metadata:', authErr);
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        id: updatedProfile.id,
        username: updatedProfile.username,
        fullName: updatedProfile.full_name,
        role: updatedProfile.role,
        email: updatedProfile.notification_email,
        guideId: updatedProfile.guide_id,
        isActive: updatedProfile.is_active,
        createdAt: updatedProfile.created_at,
      },
    });
  } catch (err: any) {
    console.error('Serverless function exception in api/update-user:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error while updating user account.',
    });
  }
}
