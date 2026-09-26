import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, parse } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { managerOnly } from '../middleware/auth.js';

export const warehousesRouter = Router();

const include = { locations: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } satisfies Prisma.WarehouseInclude;

type WarehouseRow = Awaited<ReturnType<typeof prisma.warehouse.findFirstOrThrow<{ include: typeof include }>>>;

const mapWarehouse = (w: WarehouseRow) => ({
  id: w.id,
  name: w.name,
  shortCode: w.shortCode,
  address: w.address,
  locations: w.locations.map(l => ({ id: l.id, name: l.name, shortCode: l.shortCode, warehouseId: l.warehouseId })),
});

warehousesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const ws = await prisma.warehouse.findMany({ include, orderBy: { name: 'asc' } });
    res.json(ws.map(mapWarehouse));
  }),
);

warehousesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const w = await prisma.warehouse.findUnique({ where: { id: req.params.id }, include });
    if (!w) throw notFound('Warehouse');
    res.json(mapWarehouse(w));
  }),
);

const shortCode = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, - and _ only');

// A new warehouse gets a default "Stock1" location so documents can use it immediately.
warehousesRouter.post(
  '/',
  managerOnly,
  asyncHandler(async (req, res) => {
    const b = parse(
      z.object({ name: z.string().trim().min(1).max(80), shortCode: shortCode.transform(s => s.toUpperCase()), address: z.string().trim().max(200).default('') }),
      req.body,
    );
    const w = await prisma.warehouse.create({
      data: { ...b, locations: { create: { name: 'Stock 1', shortCode: 'Stock1' } } },
      include,
    });
    res.status(201).json(mapWarehouse(w));
  }),
);

warehousesRouter.patch(
  '/:id',
  managerOnly,
  asyncHandler(async (req, res) => {
    const b = parse(
      z.object({ name: z.string().trim().min(1).max(80), address: z.string().trim().max(200) }).partial(),
      req.body,
    );
    const w = await prisma.warehouse.update({ where: { id: req.params.id }, data: b, include });
    res.json(mapWarehouse(w));
  }),
);

warehousesRouter.post(
  '/:id/locations',
  managerOnly,
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(80), shortCode }), req.body);
    const l = await prisma.location.create({ data: { ...b, warehouseId: req.params.id } });
    res.status(201).json({ id: l.id, name: l.name, shortCode: l.shortCode, warehouseId: l.warehouseId });
  }),
);
