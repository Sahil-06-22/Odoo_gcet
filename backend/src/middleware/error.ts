import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/errors.js';
import { env } from '../lib/env.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Route not found' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: { message: 'Already exists', details: err.meta } });
    if (err.code === 'P2025') return res.status(404).json({ error: { message: 'Not found' } });
  }
  console.error(err);
  res.status(500).json({ error: { message: env.isProd ? 'Internal server error' : String((err as Error)?.message ?? err) } });
}
