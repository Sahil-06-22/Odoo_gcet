import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, parse } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { nextReference } from '../lib/refs.js';
import { locationLabel, locationQty, moveStock, writeLedger } from '../lib/stock.js';

export const adjustmentsRouter = Router();

const include = { product: true, location: { include: { warehouse: true } } } as const;

type Row = Awaited<ReturnType<typeof prisma.adjustment.findFirstOrThrow<{ include: typeof include }>>>;

const mapAdjustment = (a: Row) => ({
  id: a.id,
  reference: a.reference,
  productId: a.productId,
  productName: a.product.name,
  productSku: a.product.sku,
  locationId: a.locationId,
  locationName: locationLabel(a.location),
  recordedQty: a.recordedQty,
  countedQty: a.countedQty,
  difference: a.difference,
  reason: a.reason,
  status: a.status,
  createdAt: a.createdAt.toISOString(),
});

adjustmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ productId: z.string().optional(), locationId: z.string().optional() }), req.query);
    const rows = await prisma.adjustment.findMany({ where: q, include, orderBy: { createdAt: 'desc' }, take: 500 });
    res.json(rows.map(mapAdjustment));
  }),
);

adjustmentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const a = await prisma.adjustment.findUnique({ where: { id: req.params.id }, include });
    if (!a) throw notFound('Adjustment');
    res.json(mapAdjustment(a));
  }),
);

// Read-only helper for the form: what does the system think is on hand right now?
adjustmentsRouter.get(
  '/recorded/qty',
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ productId: z.string(), locationId: z.string() }), req.query);
    res.json({ recordedQty: await locationQty(prisma, q.productId, q.locationId) });
  }),
);

// Enter the physical count; the system computes the difference, corrects stock and logs it — in one step.
adjustmentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = parse(
      z.object({
        productId: z.string(),
        locationId: z.string(),
        countedQty: z.number().int().min(0),
        reason: z.string().trim().max(500).default(''),
      }),
      req.body,
    );
    const created = await prisma.$transaction(async tx => {
      const [product, loc] = await Promise.all([
        tx.product.findUnique({ where: { id: b.productId } }),
        tx.location.findUnique({ where: { id: b.locationId }, include: { warehouse: true } }),
      ]);
      if (!product) throw notFound('Product');
      if (!loc) throw notFound('Location');

      const recordedQty = await locationQty(tx, b.productId, b.locationId);
      const difference = b.countedQty - recordedQty;
      const reference = await nextReference(tx, 'ADJUSTMENT', loc.warehouse.shortCode);

      const adj = await tx.adjustment.create({
        data: {
          reference,
          productId: b.productId,
          locationId: b.locationId,
          recordedQty,
          countedQty: b.countedQty,
          difference,
          reason: b.reason,
          createdById: req.auth!.userId,
        },
        include,
      });

      if (difference !== 0) {
        await moveStock(tx, b.productId, b.locationId, difference);
        const label = locationLabel(loc);
        await writeLedger(tx, {
          productId: b.productId,
          movementType: 'ADJUSTMENT',
          reference,
          fromLabel: difference < 0 ? label : 'inventory adjustment',
          toLabel: difference < 0 ? 'inventory adjustment' : label,
          quantity: difference,
          actorId: req.auth!.userId,
        });
      }
      return adj;
    });
    res.status(201).json(mapAdjustment(created));
  }),
);
