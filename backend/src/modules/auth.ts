import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { asyncHandler, parse } from '../lib/http.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';
import { newOtp, newRefreshToken, sha256, signAccessToken } from '../lib/tokens.js';
import { isMailConfigured, sendOtpEmail } from '../lib/mail.js';
import { loginLimiter, otpLimiter, signupLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'ss_refresh';
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const REFRESH_REUSE_WINDOW_MS = 30 * 1000;

export const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt.toISOString(),
});

async function issueSession(res: Response, user: User) {
  const refresh = newRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refresh),
      expiresAt: new Date(Date.now() + env.refreshTtlDays * 86_400_000),
    },
  });
  res.cookie(REFRESH_COOKIE, refresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/api/auth',
    maxAge: env.refreshTtlDays * 86_400_000,
  });
  return { user: publicUser(user), accessToken: signAccessToken({ sub: user.id, role: user.role }) };
}

const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const email = z.string().trim().toLowerCase().email();

authRouter.post(
  '/signup',
  signupLimiter,
  asyncHandler(async (req, res) => {
    const b = parse(
      z.object({
        name: z.string().trim().min(1).max(100),
        email,
        password,
        role: z.enum(['INVENTORY_MANAGER', 'WAREHOUSE_STAFF']).default('WAREHOUSE_STAFF'),
      }),
      req.body,
    );
    if (await prisma.user.findUnique({ where: { email: b.email } })) throw conflict('Email already registered');
    const user = await prisma.user.create({
      data: { name: b.name, email: b.email, role: b.role, passwordHash: await bcrypt.hash(b.password, 10) },
    });
    res.status(201).json(await issueSession(res, user));
  }),
);

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ email, password: z.string().min(1) }), req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email } });
    // Same error for unknown email and wrong password.
    if (!user || !(await bcrypt.compare(b.password, user.passwordHash))) throw unauthorized('Invalid email or password');
    res.json(await issueSession(res, user));
  }),
);

// Rotates the refresh token. The presented token isn't killed instantly but shortened to a
// small reuse window: a page reload or second tab that fires before the browser has stored the
// new cookie would otherwise present a dead token and get logged out.
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw unauthorized('No refresh token');
    const now = new Date();
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!row || row.expiresAt < now) throw unauthorized('Refresh token invalid or expired');
    const graceEnd = new Date(now.getTime() + REFRESH_REUSE_WINDOW_MS);
    await prisma.$transaction([
      prisma.refreshToken.updateMany({ where: { id: row.id, expiresAt: { gt: graceEnd } }, data: { expiresAt: graceEnd } }),
      prisma.refreshToken.deleteMany({ where: { userId: row.userId, expiresAt: { lt: now } } }), // tidy up
    ]);
    res.json(await issueSession(res, row.user));
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) await prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(token) } });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(204).end();
  }),
);

// Step 1 of reset. Always answers 200 so emails can't be enumerated.
// The OTP is emailed when SMTP_HOST is configured. Without SMTP it is printed to the server
// console and returned as `devOtp` (never in production) so the demo still works.
authRouter.post(
  '/forgot-password',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ email }), req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email } });
    let devOtp: string | undefined;
    if (user) {
      const otp = newOtp();
      await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
      await prisma.passwordReset.create({
        data: { userId: user.id, otpHash: sha256(otp), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      });
      if (isMailConfigured()) {
        // Not awaited: response time must not reveal whether the address is registered.
        sendOtpEmail(user.email, otp, OTP_TTL_MS / 60000).catch(err => console.error('[password-reset] email failed:', err));
      } else {
        console.log(`[password-reset] SMTP not configured. OTP for ${user.email}: ${otp}`);
        if (!env.isProd) devOtp = otp;
      }
    }
    res.json({ message: 'If that email exists, an OTP has been sent.', ...(devOtp && { devOtp }) });
  }),
);

// Optional step: lets the UI check the OTP before showing the new-password field.
async function checkOtp(emailAddr: string, otp: string) {
  const user = await prisma.user.findUnique({ where: { email: emailAddr } });
  const reset = user
    ? await prisma.passwordReset.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: 'desc' } })
    : null;
  if (!user || !reset || reset.expiresAt < new Date() || reset.attempts >= OTP_MAX_ATTEMPTS) {
    throw badRequest('OTP invalid or expired');
  }
  if (reset.otpHash !== sha256(otp)) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    throw badRequest('OTP invalid or expired');
  }
  return { user, reset };
}

authRouter.post(
  '/verify-otp',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ email, otp: z.string().length(6) }), req.body);
    await checkOtp(b.email, b.otp);
    res.json({ valid: true });
  }),
);

authRouter.post(
  '/reset-password',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ email, otp: z.string().length(6), newPassword: password }), req.body);
    const { user, reset } = await checkOtp(b.email, b.otp);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(b.newPassword, 10) } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }), // sign out everywhere
    ]);
    res.json({ message: 'Password updated. Please log in.' });
  }),
);
