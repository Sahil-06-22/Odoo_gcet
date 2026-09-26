import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, parse } from '../lib/http.js';
import { badRequest } from '../lib/errors.js';
import { managerOnly } from '../middleware/auth.js';
import { nextReference } from '../lib/refs.js';
import { stockStatus } from '../lib/stock.js';

export const reorderRouter = Router();

const OPEN = ['DRAFT', 'WAITING', 'READY'] as const;

/**
 * Turns reorder rules into action: every product at/below its threshold gets a line on a new DRAFT receipt
 * (quantity = reorderQty, or enough to reach 2x the threshold). Products already on an open receipt are skipped
 * so pressing the button twice doesn't double-order. A person still reviews and validates the receipt.
 */
reorderRouter.post(
  '/draft-receipt',
  managerOnly,
  asyncHandler(async (req, res) => {
    const b = parse(
      z.object({
        warehouseId: z.string(),
        supplier: z.string().trim().min(1).max(120).default('Reorder'),
        productIds: z.array(z.string()).optional(), // limit to these products; default = all that need reordering
      }),
      req.body,
    );

    const result = await prisma.$transaction(async tx => {
      const loc = await tx.location.findFirst({
        where: { warehouseId: b.warehouseId },
        include: { warehouse: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (!loc) throw badRequest('Warehouse not found or has no locations');

      const [products, sums, onOrder] = await Promise.all([
        tx.product.findMany({ where: { isActive: true, reorderThreshold: { not: null }, ...(b.productIds && { id: { in: b.productIds } }) } }),
        tx.stockLevel.groupBy({ by: ['productId'], _sum: { quantity: true } }),
        tx.operationLine.findMany({
          where: { operation: { type: 'RECEIPT', status: { in: [...OPEN] } } },
          select: { productId: true },
        }),
      ]);
      const total = new Map(sums.map(s => [s.productId, s._sum.quantity ?? 0]));
      const alreadyOrdered = new Set(onOrder.map(l => l.productId));

      const lines: { productId: string; sku: string; name: string; quantity: number }[] = [];
      const skipped: { productId: string; sku: string; reason: string }[] = [];
      for (const p of products) {
        const t = total.get(p.id) ?? 0;
        if (stockStatus(t, p.reorderThreshold) === 'IN_STOCK') continue;
        const quantity = p.reorderQty ?? Math.max((p.reorderThreshold ?? 0) * 2 - t, 0);
        if (quantity <= 0) skipped.push({ productId: p.id, sku: p.sku, reason: 'no reorder quantity could be worked out' });
        else if (alreadyOrdered.has(p.id)) skipped.push({ productId: p.id, sku: p.sku, reason: 'already on an open receipt' });
        else lines.push({ productId: p.id, sku: p.sku, name: p.name, quantity });
      }
      if (!lines.length) return { receipt: null, skipped };

      const op = await tx.operation.create({
        data: {
          type: 'RECEIPT',
          reference: await nextReference(tx, 'RECEIPT', loc.warehouse.shortCode),
          contact: b.supplier,
          destLocationId: loc.id,
          responsibleId: req.auth!.userId,
          lines: { create: lines.map(l => ({ productId: l.productId, expectedQty: l.quantity })) },
        },
      });
      return { receipt: { id: op.id, reference: op.reference, status: op.status, lines }, skipped };
    });

    res.status(result.receipt ? 201 : 200).json(result);
  }),
);
