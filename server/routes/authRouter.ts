import { Router } from 'express';
import { db } from '../db';
import { createSession, destroySession, requireAuth, AuthenticatedRequest } from '../auth';

const router = Router();

// Setup status: check if any admin exists
router.get('/setup-status', (req, res) => {
  const users = db.getUsers();
  const hasAdmin = users.some((u) => u.role === 'admin');
  res.json({
    hasAdmin,
    totalUsers: users.length,
  });
});

// Initial admin setup (only permitted when no admin exists)
router.post('/init-admin', async (req, res) => {
  const users = db.getUsers();
  const hasAdmin = users.some((u) => u.role === 'admin');
  if (hasAdmin) {
    return res.status(403).json({ error: 'System is already initialized with an administrator.' });
  }

  const { username, password, fullName, email } = req.body;
  if (!username || !password || !fullName) {
    return res.status(400).json({ error: 'Username, password, and full name are required.' });
  }

  try {
    const admin = await db.createUser({
      username,
      password,
      role: 'admin',
      fullName,
      email: email || null,
    });
    const token = createSession(admin.id, 'admin');
    res.json({
      token,
      user: admin,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Wrong username or password. Check and try again.' });
  }

  const user = db.findUserByUsername(username);
  if (!user) {
    // Exact spec error message
    return res.status(400).json({ error: 'Wrong username or password. Check and try again.' });
  }

  const valid = await db.verifyPassword(user, password);
  if (!valid) {
    // Exact spec error message
    return res.status(400).json({ error: 'Wrong username or password. Check and try again.' });
  }

  const token = createSession(user.id, user.role);
  const { passwordHash: _, ...safeUser } = user;

  res.json({
    token,
    user: safeUser,
  });
});

// Logout
router.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    destroySession(token);
  }
  res.json({ success: true });
});

// Current user profile
router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// Change own password
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters.' });
  }

  const fullUser = db.findUserById(req.user!.id);
  if (!fullUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const valid = await db.verifyPassword(fullUser, currentPassword);
  if (!valid) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  await db.resetPassword(req.user!.id, newPassword);
  res.json({ success: true, message: 'Password updated successfully.' });
});

// Update profile (username, email, fullName)
router.post('/update-profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { username, email, fullName } = req.body;
  try {
    const updates: any = {};
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (fullName !== undefined) updates.fullName = fullName;
    const updated = await db.updateUser(req.user!.id, updates);
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
