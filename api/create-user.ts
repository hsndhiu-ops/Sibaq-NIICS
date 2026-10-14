import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: /api/create-user
 *
 * Secure server-side user provisioning using Supabase Service Role Key.
 * Registers user in Supabase Auth Admin and creates profile row in public.profiles.
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
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.fullName === 'string' && body.fullName.trim()
      ? body.fullName.trim()
      : (typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : username);
    const role = (body.role || 'student').trim().toLowerCase();
    const notificationEmail = body.notificationEmail || body.notification_email || body.email || null;
    const assignedGuideId = body.assignedGuideId || body.guideId || body.guide_id || null;

    // 2. Validate input fields
    if (!username) {
      return res.status(400).json({
        error: 'Username is required.',
      });
    }

    if (!password) {
      return res.status(400).json({
        error: 'Password is required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long.',
      });
    }

    if (role !== 'student' && role !== 'guide' && role !== 'admin') {
      return res.status(400).json({
        error: "Role must be 'student', 'guide', or 'admin'.",
      });
    }

    // 3. Validate server environment variables
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Serverless Function Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is missing.');
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

    // 5. Verify caller is an authenticated administrator
    const isExpressAdmin = req.user && req.user.role === 'admin';
    if (!isExpressAdmin) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization;
      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';

      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized: Missing login session token.',
        });
      }

      const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
      if (callerError || !callerData?.user) {
        return res.status(401).json({
          error: 'Unauthorized: Invalid or expired session.',
        });
      }

      const { data: callerProfile, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', callerData.user.id)
        .single();

      if (profileCheckError || callerProfile?.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden: Only administrators can create accounts.',
        });
      }
    }

    // 6. Map username to internal email format
    const internalEmail = `${username.toLowerCase()}@accounts.sibaq.internal`;

    // 6. Create user in Supabase Auth via Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username: username,
        role: role,
      },
    });

    if (authError || !authData.user) {
      return res.status(400).json({
        error: authError?.message || 'Failed to create user in Supabase Auth.',
      });
    }

    const userId = authData.user.id;

    // 7. Insert corresponding profile row into public.profiles
    const profileRow = {
      id: userId,
      username: username,
      full_name: fullName,
      role: role,
      notification_email: notificationEmail ? String(notificationEmail).trim() : null,
      guide_id: role === 'student' && assignedGuideId ? String(assignedGuideId).trim() : null,
      is_active: true,
    };

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' })
      .select()
      .single();

    if (profileError) {
      // Roll back auth user registration if profile creation fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (cleanupErr) {
        console.error('Failed to clean up auth user after profile failure:', cleanupErr);
      }

      return res.status(500).json({
        error: profileError.message || 'Failed to insert profile into public.profiles.',
      });
    }

    // 8. Return 200 on success
    return res.status(200).json({
      success: true,
      user: {
        id: profileData.id,
        username: profileData.username,
        fullName: profileData.full_name,
        role: profileData.role,
        notificationEmail: profileData.notification_email,
        guideId: profileData.guide_id,
        isActive: profileData.is_active,
      },
    });
  } catch (err: any) {
    console.error('Serverless function exception in api/create-user:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error while creating user account.',
    });
  }
}
