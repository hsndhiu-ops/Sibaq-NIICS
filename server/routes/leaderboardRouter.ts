import { Router } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthenticatedRequest, res) => {
  // CRITICAL SPEC REQUIREMENT: Leaderboard must return 403 / nothing for guide role
  if (req.user!.role === 'guide') {
    return res.status(403).json({ error: 'Leaderboard is not accessible to guides.' });
  }

  // Permitted for 'admin' and 'student'
  const leaderboard = db.getLeaderboard();
  res.json({ leaderboard });
});

export default router;
