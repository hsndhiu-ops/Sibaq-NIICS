import { createClient } from '@supabase/supabase-js';
import { db } from '../server/db';

/**
 * Serverless / Express handler: /api/assign-guide & /api/admin/assign-guide
 * Supports:
 * 1. Assigning one guide to multiple students: { guideId, studentIds, programId }
 * 2. Assigning multiple guides to one student: { studentId, guideIds, programId, mode }
 * 3. Removing an assignment: { action: 'remove', studentId, guideId, programId }
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Expected POST request.' });
  }

  try {
    const body = req.body || {};
    const {
      action,
      programId: rawProgramId,
      mode = 'add',
    } = body;

    const programId = rawProgramId || 'general';

    // Handle removal
    if (action === 'remove') {
      const studentId = body.studentId;
      const guideId = body.guideId;
      if (!studentId || !guideId) {
        return res.status(400).json({ error: 'studentId and guideId are required for remove.' });
      }

      db.removeStudentProgramGuide(studentId, programId, guideId);
      db.removeStudentProgramGuide(studentId, 'general', guideId);

      const remaining = db.getStudentProgramGuides({ studentId });
      const nextGuideId = remaining[0]?.guideId || null;

      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceRoleKey) {
        try {
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          await supabaseAdmin
            .from('profiles')
            .update({ guide_id: nextGuideId })
            .eq('id', studentId);
        } catch {}
      }

      return res.json({ success: true, message: 'Guide removed successfully.', nextGuideId });
    }

    // Extract studentIds and guideIds (support singular and plural)
    const studentIds: string[] = Array.isArray(body.studentIds)
      ? body.studentIds
      : (body.studentId ? [body.studentId] : []);

    const guideIds: string[] = Array.isArray(body.guideIds)
      ? body.guideIds
      : (body.guideId ? [body.guideId] : []);

    if (studentIds.length === 0 || guideIds.length === 0) {
      return res.status(400).json({
        error: 'Provide studentIds (or studentId) and guideIds (or guideId).',
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let guideNames: string[] = [];

    // 1. Sync local server db.json (studentProgramGuides)
    const assignmentsToMake: Array<{ studentId: string; programId: string; guideId: string }> = [];
    for (const sId of studentIds) {
      for (const gId of guideIds) {
        assignmentsToMake.push({
          studentId: sId,
          programId,
          guideId: gId,
        });
      }
    }

    db.assignStudentProgramGuides(
      assignmentsToMake,
      mode === 'replace' ? 'replace' : 'add'
    );

    // 2. If Supabase configured, update in Supabase profiles using service role key
    if (supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: guideProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, username')
        .in('id', guideIds);

      if (guideProfiles) {
        guideNames = guideProfiles.map((g: any) => g.full_name || g.username);
      }

      // Update primary guide_id in profiles for backward compatibility
      if (guideIds.length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ guide_id: guideIds[0] })
          .in('id', studentIds);

        if (updateError) {
          console.warn('[profiles] Service role assign guide warning:', updateError.message);
        }
      }
    }

    // 3. Fallback for local guide names
    if (guideNames.length === 0) {
      for (const gId of guideIds) {
        const g = db.findUserById(gId);
        if (g) guideNames.push(g.fullName);
      }
    }

    const studentCount = studentIds.length;
    const guideCount = guideIds.length;
    let message = '';
    if (studentCount === 1) {
      message = mode === 'replace'
        ? `Updated guides for student (${guideCount} assigned).`
        : `Assigned ${guideNames.join(', ') || `${guideCount} guides`} to student.`;
    } else if (guideCount === 1) {
      const gName = guideNames[0] || 'guide';
      message = `Assigned ${studentCount} students to ${gName}.`;
    } else {
      message = `Assigned ${guideCount} guides to ${studentCount} students.`;
    }

    return res.json({
      success: true,
      message,
      studentCount,
      guideCount,
      guideNames,
    });
  } catch (err: any) {
    console.error('Assign guide handler error:', err);
    return res.status(500).json({ error: err.message || 'Failed to assign guide.' });
  }
}
