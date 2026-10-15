import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function / Express Handler: /api/delete-user
 *
 * Secure server-side user deletion using Supabase Service Role Key.
 * Removes related records from dependent tables, removes profile row, and deletes auth user.
 */
export default async function handler(req: any, res: any) {
  // 1. Enforce POST or DELETE method
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader?.('Allow', 'POST, DELETE');
    return res.status(405).json({
      error: 'Method Not Allowed. Expected POST or DELETE request.',
    });
  }

  try {
    const body = req.body || {};
    const userId = typeof body.userId === 'string'
      ? body.userId.trim()
      : (typeof body.id === 'string' ? body.id.trim() : '');

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
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.',
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
    let callerUserId: string | null = null;
    const isExpressAdmin = req.user && req.user.role === 'admin';
    if (isExpressAdmin) {
      callerUserId = req.user.id;
    } else {
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

      callerUserId = callerData.user.id;

      const { data: callerProfile, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', callerUserId)
        .single();

      if (profileCheckError || callerProfile?.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden: Only administrators can delete accounts.',
        });
      }
    }

    // 6. Prevent self-deletion
    if (callerUserId && callerUserId === userId) {
      return res.status(400).json({
        error: 'You cannot delete your own admin account.',
      });
    }

    // 7. Fetch the target profile to know role and name
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, role')
      .eq('id', userId)
      .maybeSingle();

    const targetFullName = targetProfile?.full_name || targetProfile?.username || 'User';
    const targetRole = targetProfile?.role || 'user';

    // 8. Clean up database relationships based on role
    if (targetRole === 'guide') {
      // Unassign any students currently assigned to this guide
      await supabaseAdmin
        .from('profiles')
        .update({ guide_id: null })
        .eq('guide_id', userId);

      // Nullify or delete tasks assigned by this guide
      try {
        await supabaseAdmin
          .from('tasks')
          .delete()
          .eq('guide_id', userId);
      } catch (tErr) {
        console.warn('Non-fatal: could not clear tasks for guide:', tErr);
      }

      // Clear remarks written by this guide
      try {
        await supabaseAdmin
          .from('remarks')
          .delete()
          .eq('guide_id', userId);
      } catch (rErr) {
        console.warn('Non-fatal: could not clear remarks for guide:', rErr);
      }
    } else if (targetRole === 'student') {
      // Remove from program_members
      try {
        await supabaseAdmin
          .from('program_members')
          .delete()
          .eq('student_id', userId);
      } catch (pmErr) {
        console.warn('Non-fatal: could not delete program_members:', pmErr);
      }

      // Remove from screenshot_log
      try {
        await supabaseAdmin
          .from('screenshot_log')
          .delete()
          .eq('student_id', userId);
      } catch (scErr) {
        console.warn('Non-fatal: could not delete screenshot_log:', scErr);
      }

      // Find tasks belonging to this student and remove their task_files
      try {
        const { data: studentTasks } = await supabaseAdmin
          .from('tasks')
          .select('id')
          .eq('student_id', userId);

        if (studentTasks && studentTasks.length > 0) {
          const taskIds = studentTasks.map((t: any) => t.id);
          await supabaseAdmin
            .from('task_files')
            .delete()
            .in('task_id', taskIds);

          await supabaseAdmin
            .from('tasks')
            .delete()
            .eq('student_id', userId);
        }
      } catch (taskErr) {
        console.warn('Non-fatal: could not delete student tasks:', taskErr);
      }

      // Remove attendance
      try {
        await supabaseAdmin
          .from('attendance')
          .delete()
          .eq('student_id', userId);
      } catch (attErr) {
        console.warn('Non-fatal: could not delete attendance:', attErr);
      }

      // Remove remarks
      try {
        await supabaseAdmin
          .from('remarks')
          .delete()
          .eq('student_id', userId);
      } catch (remErr) {
        console.warn('Non-fatal: could not delete remarks:', remErr);
      }
    }

    // 9. Delete row from public.profiles
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.error('Error deleting profile row:', profileDeleteError);
      return res.status(400).json({
        error: profileDeleteError.message || 'Failed to delete user profile from database.',
      });
    }

    // 10. Delete user from Supabase Auth via Admin API
    try {
      const { error: authDelError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authDelError) {
        console.warn('Supabase Auth user delete warning:', authDelError.message);
      }
    } catch (authErr: any) {
      console.warn('Exception deleting user from Supabase Auth Admin:', authErr?.message);
    }

    return res.status(200).json({
      success: true,
      message: `${targetFullName} has been deleted.`,
      user: {
        id: userId,
        fullName: targetFullName,
        role: targetRole,
      },
    });
  } catch (err: any) {
    console.error('Serverless function exception in api/delete-user:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error while deleting user.',
    });
  }
}
