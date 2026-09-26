import { Router } from 'express';
import { z } from 'zod';
import type { Category, Product, StockLevel } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, parse } from '../lib/http.js';
import { badRequest, notFound } from '../lib/errors.js';
import { managerOnly } from '../middleware/auth.js';
import { locationLabel, moveStock, stockStatus, writeLedger } from '../lib/stock.js';

export const productsRouter = Router();
export const categoriesRouter = Router();
export const stockRouter = Router();

type ProductRow = Product & { category: Category; stockLevels: Pick<StockLevel, 'quantity'>[] };

export function mapProduct(p: ProductRow) {
  const totalStock = p.stockLevels.reduce((s, l) => s + l.quantity, 0);
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category.name,
    unitOfMeasure: p.unitOfMeasure,
    totalStock,
    stockStatus: stockStatus(totalStock, p.reorderThreshold),
    isActive: p.isActive,
    reorderThreshold: p.reorderThreshold ?? undefined,
    reorderQty: p.reorderQty ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}

const productInclude = { category: true, stockLevels: { select: { quantity: true } } } as const;

async function categoryId(name: string) {
  const c = await prisma.category.upsert({ where: { name }, create: { name }, update: {} });
  return c.id;
}

// ---------- categories ----------
categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const cats = await prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });
    res.json(cats.map(c => ({ id: c.id, name: c.name, productCount: c._count.products })));
  }),
);

categoriesRouter.post(
  '/',
  managerOnly,
  asyncHandler(async (req, res) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(60) }), req.body);
    const c = await prisma.category.upsert({ where: { name: b.name }, create: { name: b.name }, update: {} });
    res.status(201).json({ id: c.id, name: c.name });
  }),
);

// ---------- products ----------
productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        search: z.string().trim().optional(),
        category: z.string().trim().optional(), // category name
        stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
        includeInactive: z.enum(['true', 'false']).optional(),
      }),
      req.query,
    );
    const products = await prisma.product.findMany({
      where: {
        ...(q.includeInactive === 'true' ? {} : { isActive: true }),
        ...(q.category && { category: { name: q.category } }),
        ...(q.search && {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { sku: { contains: q.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: productInclude,
      orderBy: { name: 'asc' },
    });
    const rows = products.map(mapProduct);
    res.json(q.stockStatus ? rows.filter(r => r.stockStatus === q.stockStatus) : rows);
  }),
);

const productBody = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(40).transform(s => s.toUpperCase()),
  category: z.string().trim().min(1).max(60),
  unitOfMeasure: z.string().trim().min(1).max(20).default('Units'),
  reorderThreshold: z.number().int().min(0).nullable().optional(),
  reorderQty: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

productsRouter.post(
  '/',
  managerOnly,
  asyncHandler(async (req, res) => {
    const b = parse(
      productBody.extend({
        initialStock: z.number().int().min(0).optional(),
        locationId: z.string().optional(), // where the initial stock sits; defaults to first location
      }),
      req.body,
    );
    const { initialStock, locationId, category, ...data } = b;

    const created = await prisma.$transaction(async tx => {
      const cat = await tx.category.upsert({ where: { name: category }, create: { name: category }, update: {} });
      const p = await tx.product.create({ data: { ...data, categoryId: cat.id } });
      if (initialStock && initialStock > 0) {
        const loc = locationId
          ? await tx.location.findUnique({ where: { id: locationId }, include: { warehouse: true } })
          : await tx.location.findFirst({ include: { warehouse: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        if (!loc) throw badRequest('Create a warehouse before adding initial stock');
        await moveStock(tx, p.id, loc.id, initialStock);
        await writeLedger(tx, {
          productId: p.id,
          movementType: 'ADJUSTMENT',
          reference: 'INITIAL',
          fromLabel: 'initial stock',
          toLabel: locationLabel(loc),
          quantity: initialStock,
          actorId: req.auth!.userId,
        });
      }
      return tx.product.findUniqueOrThrow({ where: { id: p.id }, include: productInclude });
    });
    res.status(201).json(mapProduct(created));
  }),
);

productsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const p = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        stockLevels: { include: { location: { include: { warehouse: true } } }, orderBy: { locationId: 'asc' } },
      },
    });
    if (!p) throw notFound('Product');
    res.json({
      ...mapProduct(p),
      stockByLocation: p.stockLevels
        .filter(l => l.quantity !== 0)
        .map(l => ({
          locationId: l.locationId,
          locationName: locationLabel(l.location),
          warehouseId: l.location.warehouseId,
          quantity: l.quantity,
        })),
    });
  }),
);

productsRouter.patch(
  '/:id',
  managerOnly,
  asyncHandler(async (req, res) => {
    const b = parse(productBody.partial(), req.body);
    const { category, ...data } = b;
    const p = await prisma.product.update({
      where: { id: req.params.id },
      data: { ...data, ...(category && { categoryId: await categoryId(category) }) },
      include: productInclude,
    });
    res.json(mapProduct(p));
  }),
);

// Soft delete: products referenced by documents / the ledger can't be hard-deleted.
productsRouter.delete(
  '/:id',
  managerOnly,
  asyncHandler(async (req, res) => {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  }),
);

// ---------- stock availability (product x location) ----------
stockRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        warehouseId: z.string().optional(),
        locationId: z.string().optional(),
        category: z.string().optional(),
        search: z.string().trim().optional(),
      }),
      req.query,
    );
    const rows = await prisma.stockLevel.findMany({
      where: {
        product: {
          isActive: true,
          ...(q.category && { category: { name: q.category } }),
          ...(q.search && {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { sku: { contains: q.search, mode: 'insensitive' } },
            ],
          }),
        },
        ...(q.locationId && { locationId: q.locationId }),
        ...(q.warehouseId && { location: { warehouseId: q.warehouseId } }),
      },
      include: { product: { include: { category: true } }, location: { include: { warehouse: true } } },
      orderBy: [{ product: { name: 'asc' } }, { locationId: 'asc' }],
    });
    res.json(
      rows.map(r => ({
        productId: r.productId,
        sku: r.product.sku,
        name: r.product.name,
        category: r.product.category.name,
        unitOfMeasure: r.product.unitOfMeasure,
        locationId: r.locationId,
        locationName: locationLabel(r.location),
        warehouseId: r.location.warehouseId,
        quantity: r.quantity,
      })),
    );
  }),
);
