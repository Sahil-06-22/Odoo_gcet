import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodTypeAny } from 'zod';
import { badRequest } from './errors.js';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw badRequest(
      'Validation failed',
      r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}
