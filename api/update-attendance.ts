import { createClient } from '@supabase/supabase-js';

/**
 * Serverless / Express API endpoint: /api/update-attendance
 * Updates attendance row using Supabase Service Role Key (bypassing RLS / permission restrictions).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Expected POST request.' });
  }

  try {
    const body = req.body || {};
    const id = body.id || body.attendanceId;

    if (!id) {
      return res.status(400).json({ error: 'Attendance row ID is required.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const status = body.status === 'present' ? 'present' : 'absent';
    const score_level = status === 'absent' ? null : (body.score_level ?? body.scoreLevel ?? null);
    const note = body.note !== undefined ? body.note : null;

    const payload: Record<string, any> = {
      status,
      score_level,
      note,
      marked_at: body.marked_at || new Date().toISOString(),
    };

    if (body.marked_by) {
      payload.marked_by = body.marked_by;
    } else if (req.user?.id) {
      payload.marked_by = req.user.id;
    }

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[/api/update-attendance] Supabase error:', error);
      return res.status(500).json({ error: error.message || 'Failed to update attendance row.' });
    }

    return res.json({ success: true, attendance: data });
  } catch (err: any) {
    console.error('[/api/update-attendance] Exception:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
