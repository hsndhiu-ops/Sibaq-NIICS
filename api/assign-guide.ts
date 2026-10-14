import { createClient } from '@supabase/supabase-js';
import { db } from '../server/db';

/**
 * Serverless / Express handler: /api/assign-guide & /api/admin/assign-guide
 * Assign guide to students using Supabase Service Role Key (bypassing client RLS)
 * and syncing local server/db.ts
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Expected POST request.' });
  }

  try {
    const { studentIds, guideId } = req.body || {};
    if (!Array.isArray(studentIds) || studentIds.length === 0 || !guideId) {
      return res.status(400).json({ error: 'studentIds array and guideId are required.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let guideName = '';

    // 1. If Supabase configured, update in Supabase profiles using service role key
    if (supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Fetch guide to verify and get name
      const { data: guideProfile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, role')
        .eq('id', guideId)
        .maybeSingle();

      if (guideProfile) {
        guideName = guideProfile.full_name;
      }

      // Update student profiles in batch
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ guide_id: guideId })
        .in('id', studentIds);

      if (updateError) {
        console.error('[profiles] Service role assign guide error:', updateError.message, updateError);
        return res.status(500).json({ error: updateError.message || "Couldn't assign guide in database." });
      }
    }

    // 2. Also sync local db.json if available
    try {
      const localGuide = db.findUserById(guideId);
      if (localGuide && !guideName) {
        guideName = localGuide.fullName;
      }
      for (const sId of studentIds) {
        try {
          await db.updateUser(sId, { guideId });
        } catch {}
      }
    } catch {
      // Local db sync non-fatal
    }

    const count = studentIds.length;
    const message = guideName
      ? `Assigned ${count} ${count === 1 ? 'student' : 'students'} to guide ${guideName}.`
      : `Assigned ${count} ${count === 1 ? 'student' : 'students'} successfully.`;

    return res.json({ success: true, message });
  } catch (err: any) {
    console.error('Assign guide handler error:', err);
    return res.status(500).json({ error: err.message || 'Failed to assign guide.' });
  }
}
