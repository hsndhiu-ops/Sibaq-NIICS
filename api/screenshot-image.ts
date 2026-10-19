import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Serverless / Express API endpoint: /api/screenshot-image
 *
 * Secure high-reliability proxy for screenshots.
 * Allows admin devices (especially iOS Safari, mobile Chrome, and restricted networks)
 * to open and inspect screenshot uploads reliably without cross-origin iframe or third-party cookie restrictions.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'HEAD') {
    res.setHeader?.('Allow', 'GET, POST, HEAD');
    return res.status(405).json({ error: 'Method Not Allowed. Expected GET, POST, or HEAD.' });
  }

  const rawPath = req.query?.path || req.query?.fileId || req.body?.path || req.body?.fileId;

  if (!rawPath || typeof rawPath !== 'string') {
    return res.status(400).json({ error: 'Screenshot path or fileId is required.' });
  }

  // Clean path parameter (remove leading slashes, avoid directory traversal)
  const cleanPath = rawPath.replace(/^[/\\]+/, '').replace(/\.\.[/\\]/g, '');

  const extMatch = cleanPath.match(/\.(png|jpe?g|webp|gif)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpeg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Attempt to download from Supabase storage "screenshots" bucket
      const { data, error } = await supabaseAdmin.storage.from('screenshots').download(cleanPath);

      if (!error && data) {
        const buffer = Buffer.from(await data.arrayBuffer());
        res.setHeader('Content-Type', data.type || mimeType);
        res.setHeader('Cache-Control', 'public, max-age=7200, stale-while-revalidate=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Disposition', `inline; filename="screenshot_${path.basename(cleanPath)}"`);
        return res.status(200).send(buffer);
      }
    } catch (sbErr) {
      console.warn('[/api/screenshot-image] Supabase storage download error:', sbErr);
    }
  }

  // Fallback: check local disk uploads directory for local test runs
  const localUploadDir = path.resolve(process.cwd(), 'uploads');
  const possibleLocalFile = path.resolve(localUploadDir, path.basename(cleanPath));
  if (fs.existsSync(possibleLocalFile)) {
    try {
      const fileBuffer = fs.readFileSync(possibleLocalFile);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=7200');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Disposition', `inline; filename="screenshot_${path.basename(cleanPath)}"`);
      return res.status(200).send(fileBuffer);
    } catch (diskErr) {
      console.warn('[/api/screenshot-image] Local disk read error:', diskErr);
    }
  }

  return res.status(404).json({
    error: 'Screenshot image not found or has been purged after the 26-hour retention period.',
  });
}
