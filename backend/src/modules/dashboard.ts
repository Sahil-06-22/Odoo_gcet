import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, parse } from '../lib/http.js';
import { stockStatus } from '../lib/stock.js';

export const dashboardRouter = Router();

const OPEN = ['DRAFT', 'WAITING', 'READY'] as const;
const filters = z.object({ warehouseId: z.string().optional(), category: z.string().optional() });

/** Per-product on-hand totals (optionally limited to one warehouse), with alert status. */
async function productStock(q: z.infer<typeof filters>) {
  const [products, sums] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, ...(q.category && { category: { name: q.category } }) },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.stockLevel.groupBy({
      by: ['productId'],
      where: q.warehouseId ? { location: { warehouseId: q.warehouseId } } : undefined,
      _sum: { quantity: true },
    }),
  ]);
  const total = new Map(sums.map(s => [s.productId, s._sum.quantity ?? 0]));
  return products.map(p => {
    const totalStock = total.get(p.id) ?? 0;
    return { p, totalStock, status: stockStatus(totalStock, p.reorderThreshold) };
  });
}

dashboardRouter.get(
  '/kpis',
  asyncHandler(async (req, res) => {
    const q = parse(filters, req.query);
    const rows = await productStock(q);

    const opWhere = (type: 'RECEIPT' | 'DELIVERY' | 'TRANSFER'): Prisma.OperationWhereInput => ({
      type,
      status: { in: [...OPEN] },
      ...(q.warehouseId && {
        OR: [{ warehouseId: q.warehouseId }, { sourceLocation: { warehouseId: q.warehouseId } }, { destLocation: { warehouseId: q.warehouseId } }],
      }),
      ...(q.category && { lines: { some: { product: { category: { name: q.category } } } } }),
    });
    const [pendingReceipts, pendingDeliveries, scheduledTransfers] = await Promise.all([
      prisma.operation.count({ where: opWhere('RECEIPT') }),
      prisma.operation.count({ where: opWhere('DELIVERY') }),
      prisma.operation.count({ where: opWhere('TRANSFER') }),
    ]);

    res.json({
      totalProducts: rows.length,
      inStockProducts: rows.filter(r => r.totalStock > 0).length,
      lowStockItems: rows.filter(r => r.status === 'LOW_STOCK').length,
      outOfStockItems: rows.filter(r => r.status === 'OUT_OF_STOCK').length,
      pendingReceipts,
      pendingDeliveries,
      scheduledTransfers,
    });
  }),
);

// Low-stock / out-of-stock alert list, with a suggested reorder quantity.
dashboardRouter.get(
  '/low-stock',
  asyncHandler(async (req, res) => {
    const q = parse(filters, req.query);
    const rows = (await productStock(q)).filter(r => r.status !== 'IN_STOCK');
    res.json(
      rows
        .map(({ p, totalStock, status }) => ({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category.name,
          totalStock,
          stockStatus: status,
          reorderThreshold: p.reorderThreshold ?? null,
          suggestedOrderQty: p.reorderQty ?? Math.max((p.reorderThreshold ?? 0) * 2 - totalStock, 0),
        }))
        .sort((a, b) => a.totalStock - b.totalStock),
    );
  }),
);

// Counts of documents by type and status — drives the dashboard's type/status filters.
dashboardRouter.get(
  '/operations',
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ warehouseId: z.string().optional() }), req.query);
    const groups = await prisma.operation.groupBy({
      by: ['type', 'status'],
      where: q.warehouseId
        ? { OR: [{ warehouseId: q.warehouseId }, { sourceLocation: { warehouseId: q.warehouseId } }, { destLocation: { warehouseId: q.warehouseId } }] }
        : undefined,
      _count: { _all: true },
    });
    const adj = await prisma.adjustment.count({
      where: q.warehouseId ? { location: { warehouseId: q.warehouseId } } : undefined,
    });
    res.json({
      byTypeAndStatus: groups.map(g => ({ type: g.type, status: g.status, count: g._count._all })),
      adjustments: adj,
    });
  }),
);
