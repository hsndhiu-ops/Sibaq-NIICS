import { Router } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res) => {
  const notifications = db.getNotificationsForUser(req.user!.id);
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ notifications, unreadCount });
});

router.post('/read-all', (req: AuthenticatedRequest, res) => {
  db.markNotificationsRead(req.user!.id);
  res.json({ success: true });
});

export default router;
