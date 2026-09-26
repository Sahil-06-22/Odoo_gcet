import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodTypeAny } from 'zod';
import { badRequest } from './errors.js';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Optional pagination for list endpoints: ?page=1&limit=50. Without `limit` the endpoint's default cap applies. */
export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).optional(),
};
export function paging(q: { page: number; limit?: number }, cap = 500) {
  const take = q.limit ?? cap;
  return { take, skip: (q.page - 1) * take };
}

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
