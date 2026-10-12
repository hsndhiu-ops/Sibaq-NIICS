import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: /api/purge-screenshots
 *
 * Automatically or manually purges screenshots older than 48 hours
 * from the screenshots bucket and updates screenshot_log in public.profiles/screenshot_log.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    res.setHeader?.('Allow', 'DELETE, POST');
    return res.status(405).json({
      error: 'Method Not Allowed. Expected DELETE or POST request.',
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error: 'Missing Supabase environment variables.',
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Query screenshots uploaded over 48 hours ago that are not yet marked as deleted
    const { data: oldScreenshots, error: queryErr } = await supabaseAdmin
      .from('screenshot_log')
      .select('id, storage_path')
      .lt('uploaded_at', cutoffTime)
      .is('file_deleted_at', null);

    if (queryErr) {
      return res.status(500).json({
        error: queryErr.message || 'Failed to query screenshots for purging.',
      });
    }

    let purgedCount = 0;

    if (oldScreenshots && oldScreenshots.length > 0) {
      const pathsToRemove = oldScreenshots
        .map((s) => s.storage_path)
        .filter(Boolean);

      if (pathsToRemove.length > 0) {
        try {
          await supabaseAdmin.storage.from('screenshots').remove(pathsToRemove);
        } catch (storageErr) {
          console.warn('Storage file deletion error during purge:', storageErr);
        }
      }

      const idsToUpdate = oldScreenshots.map((s) => s.id);
      const { error: updateErr } = await supabaseAdmin
        .from('screenshot_log')
        .update({ file_deleted_at: new Date().toISOString() })
        .in('id', idsToUpdate);

      if (!updateErr) {
        purgedCount = oldScreenshots.length;
      }
    }

    return res.status(200).json({
      success: true,
      purgedCount,
      message: `Purged ${purgedCount} screenshot files older than 48 hours.`,
    });
  } catch (err: any) {
    console.error('Exception in purge-screenshots serverless function:', err);
    return res.status(500).json({
      error: err.message || 'Internal error purging screenshots.',
    });
  }
}
