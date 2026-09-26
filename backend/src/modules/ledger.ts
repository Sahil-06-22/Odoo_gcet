import { Router } from 'express';
import { z } from 'zod';
import type { MovementType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, pageQuery, paging, parse } from '../lib/http.js';

// Read-only on purpose: the ledger is append-only and only written by stock-changing transactions.
export const ledgerRouter = Router();

const date = z.string().refine(s => !Number.isNaN(Date.parse(s)), 'Invalid date').transform(s => new Date(s));

ledgerRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        // The frontend type also has INTERNAL_TRANSFER; treat it as TRANSFER.
        type: z.enum(['RECEIPT', 'DELIVERY', 'TRANSFER', 'INTERNAL_TRANSFER', 'ADJUSTMENT']).optional(),
        status: z.enum(['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELLED']).optional(),
        productId: z.string().optional(),
        warehouseCode: z.string().optional(), // e.g. "WH": matches entries touching WH/...
        search: z.string().trim().optional(),
        dateFrom: date.optional(),
        dateTo: date.optional(),
        ...pageQuery,
      }),
      req.query,
    );
    const movementType = q.type && ((q.type === 'INTERNAL_TRANSFER' ? 'TRANSFER' : q.type) as MovementType);
    const where: Prisma.LedgerEntryWhereInput = {
      ...(movementType && { movementType }),
      ...(q.status && { status: q.status }),
      ...(q.productId && { productId: q.productId }),
      ...(q.warehouseCode && {
        OR: [{ fromLabel: { startsWith: `${q.warehouseCode}/` } }, { toLabel: { startsWith: `${q.warehouseCode}/` } }],
      }),
      ...(q.search && {
        AND: [
          {
            OR: [
              { reference: { contains: q.search, mode: 'insensitive' } },
              { contact: { contains: q.search, mode: 'insensitive' } },
              { product: { name: { contains: q.search, mode: 'insensitive' } } },
              { product: { sku: { contains: q.search, mode: 'insensitive' } } },
            ],
          },
        ],
      }),
      ...((q.dateFrom || q.dateTo) && { createdAt: { ...(q.dateFrom && { gte: q.dateFrom }), ...(q.dateTo && { lte: q.dateTo }) } }),
    };
    const rows = await prisma.ledgerEntry.findMany({
      where,
      include: { product: true, actor: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paging(q, 200),
    });
    res.setHeader('X-Total-Count', String(await prisma.ledgerEntry.count({ where })));
    res.json(
      rows.map(e => ({
        id: e.id,
        date: e.createdAt.toISOString(),
        product: e.product.name,
        productId: e.productId,
        productSku: e.product.sku,
        from: e.fromLabel,
        to: e.toLabel,
        contact: e.contact,
        quantity: e.quantity,
        movementType: e.movementType,
        status: e.status,
        reference: e.reference,
        actor: e.actor.name,
        resultingQty: e.resultingQty,
      })),
    );
  }),
);
