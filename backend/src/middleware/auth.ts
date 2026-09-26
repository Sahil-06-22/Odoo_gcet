import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw unauthorized('Missing bearer token');
  const p = verifyAccessToken(h.slice(7));
  req.auth = { userId: p.sub, role: p.role };
  next();
}

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) throw forbidden('Your role cannot perform this action');
    next();
  };

export const managerOnly = requireRole('INVENTORY_MANAGER');
