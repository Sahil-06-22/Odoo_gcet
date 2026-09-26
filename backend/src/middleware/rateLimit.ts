import rateLimit from 'express-rate-limit';
import { env } from '../lib/env.js';

const make = (opts: { windowMs: number; limit: number; skipSuccessfulRequests?: boolean }) =>
  rateLimit({
    ...opts,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Off during tests (they hammer auth endpoints); the rate-limit test opts back in.
    skip: () => process.env.RATE_LIMIT_DISABLED === 'true' || (env.nodeEnv === 'test' && process.env.RATE_LIMIT_IN_TEST !== 'true'),
    handler: (_req, res) =>
      res.status(429).json({ error: { message: 'Too many attempts. Please wait a few minutes and try again.' } }),
  });

const FIFTEEN_MIN = 15 * 60 * 1000;

/** Login: only failed attempts count, so normal use never trips it but password guessing does. */
export const loginLimiter = make({ windowMs: FIFTEEN_MIN, limit: 10, skipSuccessfulRequests: true });
export const signupLimiter = make({ windowMs: FIFTEEN_MIN, limit: 20 });
/** OTP endpoints: each guess or email request counts. */
export const otpLimiter = make({ windowMs: FIFTEEN_MIN, limit: 10 });
