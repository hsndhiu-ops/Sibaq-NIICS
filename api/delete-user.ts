import { createClient } from '@supabase/supabase-js';

/**
 * Serverless / Express Handler: /api/admin/delete-user
 *
 * Implements Part 6 specifications:
 * - Accepts POST/DELETE with { userIds: string[] } (max 50) or { userId: string }
 * - Reads caller's login token from Authorization header and returns 403 unless active admin
 * - Server rules: only students and guides (never admin, never caller)
 * - A guide who still guides any program cannot be deleted: returns 409 "This guide still guides N programs. Remove him from them first."
 * - Removes the auth user with Auth Admin API, cleans database rows, best-effort deletes storage files under user's id folder
 * - Returns per-user results and logs who deleted whom on the server
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader?.('Allow', 'POST, DELETE');
    return res.status(405).json({
      error: 'Method Not Allowed. Expected POST or DELETE request.',
    });
  }

  try {
    const body = req.body || {};
    let userIds: string[] = [];

    if (Array.isArray(body.userIds)) {
      userIds = body.userIds.filter((id: any) => typeof id === 'string' && id.trim().length > 0);
    } else if (typeof body.userId === 'string' && body.userId.trim()) {
      userIds = [body.userId.trim()];
    } else if (typeof body.id === 'string' && body.id.trim()) {
      userIds = [body.id.trim()];
    }

    if (userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user ID is required.' });
    }

    if (userIds.length > 50) {
      return res.status(400).json({ error: 'Cannot delete more than 50 accounts at once.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[delete-user] Missing SUPABASE_SERVICE_ROLE_KEY.');
      return res.status(500).json({
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.',
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Authenticate caller as active administrator
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

    const { data: callerProfile, error: callerProfError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerId)
      .single();

    if (callerProfError || callerProfile?.role !== 'admin' || callerProfile?.is_active === false) {
      return res.status(403).json({
        error: 'Forbidden: Only active administrators can delete accounts.',
      });
    }

    // 2. Fetch profiles for all requested userIds
    const { data: targetProfiles, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, role, is_active')
      .in('id', userIds);

    if (fetchErr) {
      console.error('[delete-user] error querying target profiles:', fetchErr);
      return res.status(500).json({ error: "Couldn't fetch account details." });
    }

    const profileMap = new Map((targetProfiles || []).map((p) => [p.id, p]));

    // 3. Pre-flight checks on all targets
    for (const targetId of userIds) {
      if (targetId === callerId) {
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
      }

      const prof = profileMap.get(targetId);
      if (!prof) continue;

      if (prof.role === 'admin') {
        return res.status(403).json({
          error: `Cannot delete administrator account (${prof.username}). Only students and guides can be deleted.`,
        });
      }

      // Check if guide still guides any program
      if (prof.role === 'guide') {
        const { count, error: pgErr } = await supabaseAdmin
          .from('program_guides')
          .select('*', { count: 'exact', head: true })
          .eq('guide_id', targetId);

        if (!pgErr && typeof count === 'number' && count > 0) {
          return res.status(409).json({
            error: `This guide still guides ${count} ${count === 1 ? 'program' : 'programs'}. Remove him from them first.`,
          });
        }
      }
    }

    // 4. Perform deletions
    const results: Array<{ userId: string; username?: string; success: boolean; message: string }> = [];

    for (const targetId of userIds) {
      const prof = profileMap.get(targetId);
      const username = prof?.username || targetId;
      const role = prof?.role || 'user';

      try {
        // Clean related rows in database based on role
        if (role === 'guide') {
          // Deleting a guide also deletes the tasks and remarks he wrote
          await supabaseAdmin.from('tasks').delete().eq('guide_id', targetId);
          await supabaseAdmin.from('remarks').delete().eq('guide_id', targetId);
        } else if (role === 'student') {
          // Remove student enrollments, attendance, remarks, tasks, files
          await supabaseAdmin.from('program_members').delete().eq('student_id', targetId);
          await supabaseAdmin.from('attendance').delete().eq('student_id', targetId);
          await supabaseAdmin.from('remarks').delete().eq('student_id', targetId);
          await supabaseAdmin.from('screenshot_log').delete().eq('student_id', targetId);

          const { data: sTasks } = await supabaseAdmin
            .from('tasks')
            .select('id')
            .eq('student_id', targetId);

          if (sTasks && sTasks.length > 0) {
            const taskIds = sTasks.map((t) => t.id);
            await supabaseAdmin.from('task_files').delete().in('task_id', taskIds);
            await supabaseAdmin.from('tasks').delete().eq('student_id', targetId);
          }
        }

        // Delete from public.profiles
        await supabaseAdmin.from('profiles').delete().eq('id', targetId);

        // Delete user via Supabase Auth Admin API
        try {
          const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(targetId);
          if (authErr) {
            console.warn(`[delete-user] Auth admin delete warning for ${targetId}:`, authErr.message);
          }
        } catch (authException: any) {
          console.warn(`[delete-user] Auth admin exception for ${targetId}:`, authException?.message);
        }

        // Best-effort storage cleanup: delete files under user's id folder
        try {
          // Clean task-files bucket under folder targetId/
          const { data: taskFilesList } = await supabaseAdmin.storage
            .from('task-files')
            .list(targetId);

          if (taskFilesList && taskFilesList.length > 0) {
            const paths = taskFilesList.map((f) => `${targetId}/${f.name}`);
            await supabaseAdmin.storage.from('task-files').remove(paths);
          }
        } catch (storErr) {
          console.warn(`[delete-user] Non-fatal storage task-files cleanup for ${targetId}:`, storErr);
        }

        try {
          // Clean screenshots bucket under folder targetId/
          const { data: screenList } = await supabaseAdmin.storage
            .from('screenshots')
            .list(targetId);

          if (screenList && screenList.length > 0) {
            const paths = screenList.map((f) => `${targetId}/${f.name}`);
            await supabaseAdmin.storage.from('screenshots').remove(paths);
          }
        } catch (storErr2) {
          console.warn(`[delete-user] Non-fatal storage screenshots cleanup for ${targetId}:`, storErr2);
        }

        // Log who deleted whom on the server
        console.log(
          `[AUDIT] Admin ${callerId} deleted ${role} ${username} (${targetId})`
        );

        results.push({
          userId: targetId,
          username,
          success: true,
          message: 'Account deleted successfully.',
        });
      } catch (userErr: any) {
        console.error(`[delete-user] Failed deleting user ${targetId}:`, userErr);
        results.push({
          userId: targetId,
          username,
          success: false,
          message: userErr.message || 'Deletion failed.',
        });
      }
    }

    const allSucceeded = results.every((r) => r.success);
    return res.status(allSucceeded ? 200 : 207).json({
      success: allSucceeded,
      count: results.filter((r) => r.success).length,
      results,
    });
  } catch (err: any) {
    console.error('[delete-user] Exception:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error while deleting accounts.',
    });
  }
}
