import { createClient } from '@supabase/supabase-js';

/**
 * Serverless / Express API endpoint: /api/record-screenshot
 *
 * Secure server-side recording or updating of daily screenshot submissions.
 * Supports replacing an existing screenshot for the same student on the same day.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Expected POST.' });
  }

  try {
    const { studentId, date, storagePath } = req.body || {};
    if (!studentId || !storagePath) {
      return res.status(400).json({ error: 'Missing studentId or storagePath' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Missing Supabase service environment variables.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Check if record exists for this student on this date
    const { data: existing } = await supabaseAdmin
      .from('screenshot_log')
      .select('id')
      .eq('student_id', studentId)
      .eq('date', targetDate)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from('screenshot_log')
        .update({
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
          file_deleted_at: null,
        })
        .eq('id', existing.id);

      if (updateErr) {
        return res.status(400).json({ error: updateErr.message });
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('screenshot_log')
        .insert({
          student_id: studentId,
          date: targetDate,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
          file_deleted_at: null,
        });

      if (insertErr) {
        return res.status(400).json({ error: insertErr.message });
      }
    }

    return res.status(200).json({ success: true, message: 'Screenshot recorded successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error recording screenshot.' });
  }
}
