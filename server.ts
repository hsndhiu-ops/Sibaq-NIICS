import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authMiddleware } from './server/auth';
import authRouter from './server/routes/authRouter';
import adminRouter from './server/routes/adminRouter';
import guideRouter from './server/routes/guideRouter';
import studentRouter from './server/routes/studentRouter';
import leaderboardRouter from './server/routes/leaderboardRouter';
import notificationRouter from './server/routes/notificationRouter';
import fileRouter from './server/routes/fileRouter';
import programGuidesRouter from './server/routes/programGuidesRouter';
import createUserHandler from './api/create-user';
import resetPasswordHandler from './api/reset-password';
import updateUserHandler from './api/update-user';
import assignGuideHandler from './api/assign-guide';
import purgeScreenshotsHandler from './api/purge-screenshots';
import deleteScreenshotHandler from './api/delete-screenshot';
import screenshotImageHandler from './api/screenshot-image';
import deleteUserHandler from './api/delete-user';
import setActiveHandler from './api/set-active';
import updateAttendanceHandler from './api/update-attendance';
import recordScreenshotHandler from './api/record-screenshot';
import {
  startBackgroundJobs,
  runMidnightAbsentJob,
  runNightlyScreenshotPromptJob,
  runScreenshotPurgeJob,
} from './server/jobs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Attach session user to req.user if Authorization header present
  app.use(authMiddleware);

  // Unauthenticated/cookie-free image streaming for native <img> tags across all devices
  app.all('/api/admin/screenshot-image', screenshotImageHandler);
  app.all('/api/screenshot-image', screenshotImageHandler);
  app.all('/api/files/screenshot', screenshotImageHandler);

  // Mount API endpoints
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/guide', guideRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/files', fileRouter);
  app.use('/api/program-guides', programGuidesRouter);

  // Vercel serverless function equivalent routes
  app.post('/api/create-user', createUserHandler);
  app.post('/api/reset-password', resetPasswordHandler);
  app.post('/api/update-user', updateUserHandler);
  app.post('/api/delete-user', deleteUserHandler);
  app.post('/api/admin/delete-user', deleteUserHandler);
  app.delete('/api/delete-user', deleteUserHandler);
  app.delete('/api/admin/delete-user', deleteUserHandler);
  app.post('/api/set-active', setActiveHandler);
  app.post('/api/admin/set-active', setActiveHandler);
  app.post('/api/assign-guide', assignGuideHandler);
  app.post('/api/admin/assign-guide', assignGuideHandler);
  app.post('/api/update-attendance', updateAttendanceHandler);
  app.post('/api/admin/update-attendance', updateAttendanceHandler);
  app.all('/api/purge-screenshots', purgeScreenshotsHandler);
  app.all('/api/admin/purge-screenshots', purgeScreenshotsHandler);
  app.all('/api/delete-screenshot', deleteScreenshotHandler);
  app.all('/api/admin/delete-screenshot', deleteScreenshotHandler);
  app.all('/api/record-screenshot', recordScreenshotHandler);

  // Cron trigger endpoint for external invocation or admin testing
  app.post('/api/cron/trigger', (req: any, res) => {
    const cronSecret = process.env.CRON_SECRET || 'dhiu-arts-fest-secret';
    const authKey = req.headers['x-cron-secret'] || req.query.secret;
    if (authKey !== cronSecret && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized cron invocation' });
    }

    const { job } = req.body;
    if (job === 'midnight_absent') {
      runMidnightAbsentJob();
    } else if (job === 'screenshot_prompt') {
      runNightlyScreenshotPromptJob();
    } else if (job === 'purge_screenshots') {
      runScreenshotPurgeJob();
    } else {
      runMidnightAbsentJob();
      runNightlyScreenshotPromptJob();
      runScreenshotPurgeJob();
    }

    res.json({ success: true, executedJob: job || 'all' });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Start background jobs (Asia/Kolkata timezone)
  startBackgroundJobs();

  // Vite middleware in dev or static files in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DHIU Arts Fest server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
