import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, parse } from '../lib/http.js';
import { badRequest, notFound } from '../lib/errors.js';
import { publicUser } from './auth.js';

export const usersRouter = Router();

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!u) throw notFound('User');
    res.json(publicUser(u));
  }),
);

usersRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const b = parse(
      z.object({
        name: z.string().trim().min(1).max(100).optional(),
        email: z.string().trim().toLowerCase().email().optional(),
      }),
      req.body,
    );
    const u = await prisma.user.update({ where: { id: req.auth!.userId }, data: b });
    res.json(publicUser(u));
  }),
);

usersRouter.post(
  '/me/password',
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(128) }), req.body);
    const u = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!u) throw notFound('User');
    if (!(await bcrypt.compare(b.currentPassword, u.passwordHash))) throw badRequest('Current password is incorrect');
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(b.newPassword, 10) } });
    res.status(204).end();
  }),
);

// Lightweight list for "Responsible" dropdowns.
usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    res.json(users.map(publicUser));
  }),
);
