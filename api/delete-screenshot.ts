import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Serverless / Express API endpoint: /api/delete-screenshot
 *
 * Allows administrators to delete a single screenshot uploaded by a student
 * (e.g. if reloaded by student, improper upload, or on admin action).
 * Removes the physical file from Supabase Storage and records file_deleted_at in screenshot_log.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader?.('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed. Expected POST or DELETE.' });
  }

  try {
    const body = req.body || {};
    const id = body.id || body.screenshotId || req.query.id;
    const storagePath = body.storagePath || body.path || body.fileId || req.query.storagePath || req.query.path;

    if (!id && !storagePath) {
      return res.status(400).json({ error: 'Screenshot ID or storage path is required.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Missing Supabase service environment variables.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let targetPath = storagePath;

    // 1. If we have ID but no storagePath, look it up in screenshot_log
    if (id && !targetPath) {
      const { data: logRow } = await supabaseAdmin
        .from('screenshot_log')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle();
      if (logRow?.storage_path) {
        targetPath = logRow.storage_path;
      }
    }

    // 2. Remove from Supabase Storage "screenshots" bucket
    if (targetPath) {
      const cleanPath = targetPath.replace(/^[/\\]+/, '');
      try {
        await supabaseAdmin.storage.from('screenshots').remove([cleanPath]);
      } catch (storageErr) {
        console.warn('[/api/delete-screenshot] Storage file removal error:', storageErr);
      }

      // Check local disk uploads if exists
      const localFile = path.resolve(process.cwd(), 'uploads', path.basename(cleanPath));
      if (fs.existsSync(localFile)) {
        try {
          fs.unlinkSync(localFile);
        } catch (e) {
          // ignore
        }
      }
    }

    // 3. Delete the screenshot_log record completely so student can re-upload if needed and it disappears from admin view
    if (id) {
      await supabaseAdmin
        .from('screenshot_log')
        .delete()
        .eq('id', id);
    } else if (targetPath) {
      await supabaseAdmin
        .from('screenshot_log')
        .delete()
        .eq('storage_path', targetPath);
    }

    return res.status(200).json({
      success: true,
      message: 'Screenshot deleted successfully.',
    });
  } catch (err: any) {
    console.error('[/api/delete-screenshot] Exception:', err);
    return res.status(500).json({
      error: err.message || 'Internal error while deleting screenshot.',
    });
  }
}
