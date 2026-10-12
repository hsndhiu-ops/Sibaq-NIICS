import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { User, UserRole } from '../src/types';

export interface SessionData {
  userId: string;
  role: UserRole;
  createdAt: number;
}

// In-memory session token store with 30-day expiry
const activeSessions = new Map<string, SessionData>();

export function createSession(userId: string, role: UserRole): string {
  const token = uuidv4() + '-' + Buffer.from(Date.now().toString()).toString('base64');
  activeSessions.set(token, {
    userId,
    role,
    createdAt: Date.now(),
  });
  return token;
}

export function destroySession(token: string) {
  activeSessions.delete(token);
}

export function getSession(token: string): SessionData | undefined {
  const session = activeSessions.get(token);
  if (!session) return undefined;
  // 30 days expiry
  if (Date.now() - session.createdAt > 30 * 24 * 60 * 60 * 1000) {
    activeSessions.delete(token);
    return undefined;
  }
  return session;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  const session = getSession(token);
  if (!session) {
    return next();
  }

  const user = db.findUserById(session.userId);
  if (user) {
    const { passwordHash: _, ...safeUser } = user;
    req.user = safeUser;
  }
  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access forbidden: insufficient role permissions' });
    }
    next();
  };
}

export const requireAdmin = requireRole(['admin']);
export const requireGuide = requireRole(['guide']);
export const requireStudent = requireRole(['student']);
