import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from './env.js';
import { unauthorized } from './errors.js';

export interface AccessPayload {
  sub: string;
  role: UserRole;
}

export const signAccessToken = (p: AccessPayload) =>
  jwt.sign(p, env.accessSecret, { expiresIn: env.accessTtl as jwt.SignOptions['expiresIn'] });

export function verifyAccessToken(token: string): AccessPayload {
  try {
    return jwt.verify(token, env.accessSecret) as AccessPayload;
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');
export const newOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
