import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { db } from './db';
import { User, UserRole } from '../src/types';

export interface SessionData {
  userId: string;
  role: UserRole;
  createdAt: number;
}

// In-memory session token store with 30-day expiry
const activeSessions = new Map<string, SessionData>();

// Supabase client instance for verifying Supabase Auth JWTs on backend routes
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

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

/**
 * Universal authentication middleware:
 * Supports in-memory session tokens AND Supabase Auth JWTs (Authorization: Bearer <token>)
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    // 1. In-memory session token (fast path for local/mock sessions)
    const session = getSession(token);
    if (session) {
      const user = db.findUserById(session.userId);
      if (user) {
        const { passwordHash: _, ...safeUser } = user;
        req.user = safeUser;
        return next();
      }
    }

    // 2. Supabase JWT handling (for production and client-side Supabase logins)
    if (token.includes('.')) {
      // 2a. Verify via Supabase Admin Auth if client is configured
      if (supabaseAdmin) {
        try {
          const { data, error } = await supabaseAdmin.auth.getUser(token);
          if (data?.user && !error) {
            const userId = data.user.id;

            // Fetch accurate profile details from public.profiles
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            const role = (profile?.role || data.user.user_metadata?.role || 'student') as UserRole;
            const fullName =
              profile?.full_name ||
              data.user.user_metadata?.full_name ||
              (data.user.email ? data.user.email.split('@')[0] : 'User');
            const username =
              profile?.username ||
              data.user.user_metadata?.username ||
              (data.user.email ? data.user.email.split('@')[0] : '');

            const safeUser: User = {
              id: userId,
              username,
              fullName,
              role,
              guideId: profile?.guide_id || null,
              email: profile?.notification_email || data.user.email || null,
              createdAt: profile?.created_at || new Date().toISOString(),
            };

            req.user = safeUser;
            activeSessions.set(token, {
              userId,
              role,
              createdAt: Date.now(),
            });
            return next();
          }
        } catch (supabaseErr) {
          // Fall through to fallback payload decoding
        }
      }

      // 2b. Resilient fallback: decode valid, unexpired JWT payload
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
          const payload = JSON.parse(payloadJson);

          if (payload && (!payload.exp || payload.exp * 1000 > Date.now())) {
            const userId = payload.sub || '';
            const metadata = payload.user_metadata || {};
            const role = (metadata.role || payload.role || 'student') as UserRole;
            const fullName =
              metadata.full_name || (payload.email ? payload.email.split('@')[0] : 'User');
            const username =
              metadata.username || (payload.email ? payload.email.split('@')[0] : '');

            const localUser =
              db.findUserById(userId) || (username ? db.findUserByUsername(username) : null);

            if (localUser) {
              const { passwordHash: _, ...safe } = localUser;
              req.user = safe;
            } else {
              req.user = {
                id: userId,
                username,
                fullName,
                role,
                guideId: null,
                email: payload.email || null,
                createdAt: new Date().toISOString(),
              };
            }

            activeSessions.set(token, {
              userId,
              role: req.user ? req.user.role : role,
              createdAt: Date.now(),
            });
            return next();
          }
        }
      } catch {
        // ignore decoding errors
      }
    }

    next();
  } catch (err) {
    next();
  }
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
