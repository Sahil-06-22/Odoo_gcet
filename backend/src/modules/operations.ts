import { Router } from 'express';
import { z } from 'zod';
import type { DocumentStatus, OperationType, Prisma } from '@prisma/client';
import { prisma, type Tx } from '../lib/prisma.js';
import { asyncHandler, pageQuery, paging, parse } from '../lib/http.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { managerOnly } from '../middleware/auth.js';
import { nextReference } from '../lib/refs.js';
import { locationLabel, moveStock, takeStock, writeLedger } from '../lib/stock.js';

/**
 * Receipts, delivery orders and internal transfers are the same state machine:
 *   DRAFT -> (confirm) -> READY | WAITING -> (validate) -> DONE      any non-DONE -> CANCELLED
 * WAITING means a delivery/transfer whose source location doesn't hold enough stock yet.
 * Stock only moves on validate, inside one transaction together with the ledger rows.
 */

const include = {
  lines: { include: { product: true }, orderBy: { id: 'asc' } },
  responsible: true,
  warehouse: true,
  sourceLocation: { include: { warehouse: true } },
  destLocation: { include: { warehouse: true } },
} satisfies Prisma.OperationInclude;

type OpRow = Prisma.OperationGetPayload<{ include: typeof include }>;
// `${locationId}:${productId}` (delivery from one location) or `wh:${warehouseId}:${productId}` (whole warehouse) -> qty
type Availability = Map<string, number>;
const OPEN: DocumentStatus[] = ['DRAFT', 'WAITING', 'READY'];

// ---------- input schemas ----------
// Receipts speak `expectedQty` / `receivedQty`; deliveries and transfers speak `quantity`. Accept either.
const line = z
  .object({
    productId: z.string().min(1),
    expectedQty: z.number().int().positive().optional(),
    quantity: z.number().int().positive().optional(),
    receivedQty: z.number().int().min(0).optional(),
  })
  .refine(l => l.expectedQty ?? l.quantity, { message: 'quantity is required' });
const lines = z.array(line).max(200);
const date = z.string().refine(s => !Number.isNaN(Date.parse(s)), 'Invalid date').transform(s => new Date(s));

const createSchemas = {
  RECEIPT: z.object({
    supplier: z.string().trim().min(1).max(120),
    warehouseId: z.string().optional(),
    locationId: z.string().optional(),
    scheduledDate: date.optional(),
    lines: lines.default([]),
  }),
  DELIVERY: z.object({
    contact: z.string().trim().min(1).max(120),
    deliveryAddress: z.string().trim().max(250).default(''),
    sourceWarehouseId: z.string().optional(),
    sourceLocationId: z.string().optional(),
    scheduledDate: date.optional(),
    lines: lines.default([]),
  }),
  TRANSFER: z.object({
    sourceLocationId: z.string(),
    destLocationId: z.string(),
    contact: z.string().trim().max(120).default('Internal'),
    scheduledDate: date.optional(),
    lines: lines.default([]),
  }),
} as const;

// ---------- helpers ----------
async function resolveLocation(tx: Tx, warehouseId?: string, locationId?: string) {
  if (locationId) {
    const l = await tx.location.findUnique({ where: { id: locationId }, include: { warehouse: true } });
    if (!l) throw badRequest('Location not found');
    if (warehouseId && l.warehouseId !== warehouseId) throw badRequest('Location does not belong to that warehouse');
    return l;
  }
  if (!warehouseId) throw badRequest('warehouseId or locationId is required');
  const l = await tx.location.findFirst({ where: { warehouseId }, include: { warehouse: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  if (!l) throw badRequest('Warehouse not found or has no locations');
  return l;
}

async function assertProducts(tx: Tx, ids: string[]) {
  const unique = [...new Set(ids)];
  const found = await tx.product.count({ where: { id: { in: unique }, isActive: true } });
  if (found !== unique.length) throw badRequest('One or more products do not exist or are inactive');
}

type LineIn = z.infer<typeof line>;
const lineData = (l: LineIn) => ({ productId: l.productId, expectedQty: (l.expectedQty ?? l.quantity)!, doneQty: l.receivedQty ?? null });

const availKey = (o: OpRow, productId: string) =>
  o.sourceLocationId ? `${o.sourceLocationId}:${productId}` : `wh:${o.warehouseId}:${productId}`;

async function availability(rows: OpRow[]): Promise<Availability> {
  const open = rows.filter(r => r.type !== 'RECEIPT' && OPEN.includes(r.status));
  const map: Availability = new Map();
  if (!open.length) return map;
  const locIds = [...new Set(open.map(o => o.sourceLocationId).filter((x): x is string => !!x))];
  const whIds = [...new Set(open.filter(o => !o.sourceLocationId && o.warehouseId).map(o => o.warehouseId!))];
  const levels = await prisma.stockLevel.findMany({
    where: {
      productId: { in: [...new Set(open.flatMap(o => o.lines.map(l => l.productId)))] },
      OR: [{ locationId: { in: locIds } }, { location: { warehouseId: { in: whIds } } }],
    },
    include: { location: { select: { warehouseId: true } } },
  });
  for (const l of levels) {
    if (locIds.includes(l.locationId)) map.set(`${l.locationId}:${l.productId}`, l.quantity);
    if (whIds.includes(l.location.warehouseId)) {
      const k = `wh:${l.location.warehouseId}:${l.productId}`;
      map.set(k, (map.get(k) ?? 0) + l.quantity);
    }
  }
  return map;
}

// ---------- mapping to the frontend's shapes ----------
function mapLines(o: OpRow, avail: Availability) {
  return o.lines.map(l => {
    const base = { id: l.id, productId: l.productId, productName: l.product.name, productSku: l.product.sku };
    if (o.type === 'RECEIPT') return { ...base, expectedQty: l.expectedQty, receivedQty: l.doneQty ?? l.expectedQty };
    const isInsufficient = OPEN.includes(o.status) && (avail.get(availKey(o, l.productId)) ?? 0) < l.expectedQty;
    return { ...base, quantity: l.expectedQty, isInsufficient };
  });
}

function mapOp(o: OpRow, avail: Availability) {
  const common = {
    id: o.id,
    reference: o.reference,
    status: o.status,
    scheduledDate: o.scheduledDate.toISOString(),
    lines: mapLines(o, avail),
    createdAt: o.createdAt.toISOString(),
  };
  switch (o.type) {
    case 'RECEIPT':
      return {
        ...common,
        supplier: o.contact,
        warehouseId: o.destLocation!.warehouseId,
        warehouseName: locationLabel(o.destLocation!),
        locationId: o.destLocationId,
        responsible: o.responsible.name,
      };
    case 'DELIVERY':
      return {
        ...common,
        deliveryAddress: o.address,
        contact: o.contact,
        sourceWarehouseId: o.warehouseId ?? o.sourceLocation!.warehouseId,
        sourceWarehouseName: o.sourceLocation ? locationLabel(o.sourceLocation) : o.warehouse!.name,
        sourceLocationId: o.sourceLocationId,
        operationType: 'Delivery Orders',
        responsible: o.responsible.name,
      };
    case 'TRANSFER':
      return {
        ...common,
        sourceLocationId: o.sourceLocationId,
        sourceLocationName: locationLabel(o.sourceLocation!),
        destLocationId: o.destLocationId,
        destLocationName: locationLabel(o.destLocation!),
        contact: o.contact,
        responsible: o.responsible.name,
      };
  }
}

async function load(id: string, type: OperationType, tx: Tx | typeof prisma = prisma) {
  const o = await tx.operation.findFirst({ where: { id, type }, include });
  if (!o) throw notFound('Document');
  return o;
}

const present = async (o: OpRow) => mapOp(o, await availability([o]));

// ---------- router factory ----------
export function operationsRouter(type: OperationType) {
  const r = Router();
  // Who may create/edit/cancel: managers run receipts & deliveries; transfers are open to warehouse staff.
  const writers = type === 'TRANSFER' ? [] : [managerOnly];

  r.get(
    '/',
    asyncHandler(async (req, res) => {
      const q = parse(
        z.object({
          status: z.enum(['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELLED']).optional(),
          warehouseId: z.string().optional(),
          search: z.string().trim().optional(),
          dateFrom: date.optional(),
          dateTo: date.optional(),
          ...pageQuery,
        }),
        req.query,
      );
      const where: Prisma.OperationWhereInput = {
        type,
        ...(q.status && { status: q.status }),
        ...(q.warehouseId && {
          OR: [
            { warehouseId: q.warehouseId },
            { sourceLocation: { warehouseId: q.warehouseId } },
            { destLocation: { warehouseId: q.warehouseId } },
          ],
        }),
        ...(q.search && {
          AND: [
            {
              OR: [
                { reference: { contains: q.search, mode: 'insensitive' } },
                { contact: { contains: q.search, mode: 'insensitive' } },
                { lines: { some: { product: { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { sku: { contains: q.search, mode: 'insensitive' } }] } } } },
              ],
            },
          ],
        }),
        ...((q.dateFrom || q.dateTo) && { scheduledDate: { ...(q.dateFrom && { gte: q.dateFrom }), ...(q.dateTo && { lte: q.dateTo }) } }),
      };
      const rows = await prisma.operation.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...paging(q) });
      if (q.limit) res.setHeader('X-Total-Count', String(await prisma.operation.count({ where })));
      const avail = await availability(rows);
      res.json(rows.map(o => mapOp(o, avail)));
    }),
  );

  r.get('/:id', asyncHandler(async (req, res) => res.json(await present(await load(req.params.id, type)))));

  r.post(
    '/',
    ...writers,
    asyncHandler(async (req, res) => {
      const b = parse(createSchemas[type], req.body) as Record<string, any>;
      const created = await prisma.$transaction(async tx => {
        let sourceLocationId: string | null = null;
        let destLocationId: string | null = null;
        let warehouseId: string | null = null;
        let refCode: string;
        let contact = '';
        let address = '';

        if (type === 'RECEIPT') {
          const dest = await resolveLocation(tx, b.warehouseId, b.locationId);
          destLocationId = dest.id;
          refCode = dest.warehouse.shortCode;
          contact = b.supplier;
        } else if (type === 'DELIVERY') {
          // A specific location pins the pick to it; a bare warehouse means "pull from wherever it's stocked".
          if (b.sourceLocationId) {
            const src = await resolveLocation(tx, b.sourceWarehouseId, b.sourceLocationId);
            sourceLocationId = src.id;
            warehouseId = src.warehouseId;
            refCode = src.warehouse.shortCode;
          } else {
            if (!b.sourceWarehouseId) throw badRequest('sourceWarehouseId or sourceLocationId is required');
            const wh = await tx.warehouse.findUnique({ where: { id: b.sourceWarehouseId } });
            if (!wh) throw badRequest('Warehouse not found');
            warehouseId = wh.id;
            refCode = wh.shortCode;
          }
          contact = b.contact;
          address = b.deliveryAddress;
        } else {
          if (b.sourceLocationId === b.destLocationId) throw badRequest('Source and destination must differ');
          const src = await resolveLocation(tx, undefined, b.sourceLocationId);
          const dst = await resolveLocation(tx, undefined, b.destLocationId);
          sourceLocationId = src.id;
          destLocationId = dst.id;
          refCode = src.warehouse.shortCode;
          contact = b.contact;
        }

        await assertProducts(tx, b.lines.map((l: LineIn) => l.productId));
        const op = await tx.operation.create({
          data: {
            type,
            reference: await nextReference(tx, type, refCode),
            contact,
            address,
            sourceLocationId,
            destLocationId,
            warehouseId,
            responsibleId: req.auth!.userId,
            ...(b.scheduledDate && { scheduledDate: b.scheduledDate }),
            lines: { create: b.lines.map(lineData) },
          },
        });
        return load(op.id, type, tx);
      });
      res.status(201).json(await present(created));
    }),
  );

  // Edit header and/or replace lines while the document is still open.
  r.patch(
    '/:id',
    ...writers,
    asyncHandler(async (req, res) => {
      const b = parse(
        z.object({
          supplier: z.string().trim().min(1).max(120).optional(),
          contact: z.string().trim().max(120).optional(),
          deliveryAddress: z.string().trim().max(250).optional(),
          scheduledDate: date.optional(),
          lines: lines.optional(),
        }),
        req.body,
      );
      const updated = await prisma.$transaction(async tx => {
        const op = await load(req.params.id, type, tx);
        if (!OPEN.includes(op.status)) throw conflict(`A ${op.status} document can't be edited`);
        if (b.lines) await assertProducts(tx, b.lines.map(l => l.productId));
        await tx.operation.update({
          where: { id: op.id },
          data: {
            ...(b.scheduledDate && { scheduledDate: b.scheduledDate }),
            ...(type === 'RECEIPT' && b.supplier && { contact: b.supplier }),
            ...(type !== 'RECEIPT' && b.contact && { contact: b.contact }),
            ...(type === 'DELIVERY' && b.deliveryAddress !== undefined && { address: b.deliveryAddress }),
            ...(b.lines && { lines: { deleteMany: {}, create: b.lines.map(lineData) } }),
          },
        });
        return load(op.id, type, tx);
      });
      res.json(await present(updated));
    }),
  );

  r.delete(
    '/:id',
    ...writers,
    asyncHandler(async (req, res) => {
      const op = await load(req.params.id, type);
      if (op.status !== 'DRAFT') throw conflict('Only draft documents can be deleted — cancel it instead');
      await prisma.operation.delete({ where: { id: op.id } });
      res.status(204).end();
    }),
  );

  // DRAFT -> READY, or WAITING if the source can't cover it yet.
  r.post(
    '/:id/confirm',
    ...writers,
    asyncHandler(async (req, res) => {
      const op = await load(req.params.id, type);
      if (op.status !== 'DRAFT') throw conflict(`Only draft documents can be confirmed (this one is ${op.status})`);
      if (!op.lines.length) throw badRequest('Add at least one product line first');
      const short = mapLines({ ...op, status: 'DRAFT' }, await availability([op])).some(l => 'isInsufficient' in l && l.isInsufficient);
      const status: DocumentStatus = short ? 'WAITING' : 'READY';
      const claimed = await prisma.operation.updateMany({ where: { id: op.id, status: 'DRAFT' }, data: { status } });
      if (!claimed.count) throw conflict('Document changed, reload and retry');
      res.json(await present(await load(op.id, type)));
    }),
  );

  r.post(
    '/:id/cancel',
    ...writers,
    asyncHandler(async (req, res) => {
      const claimed = await prisma.operation.updateMany({ where: { id: req.params.id, type, status: { in: OPEN } }, data: { status: 'CANCELLED' } });
      if (!claimed.count) {
        await load(req.params.id, type); // 404 if missing
        throw conflict("Only open documents can be cancelled");
      }
      res.json(await present(await load(req.params.id, type)));
    }),
  );

  // Applies stock changes + writes ledger, all-or-nothing. Body may carry final received quantities.
  r.post(
    '/:id/validate',
    asyncHandler(async (req, res) => {
      const b = parse(
        z.object({ lines: z.array(z.object({ id: z.string(), receivedQty: z.number().int().min(0) })).optional() }),
        req.body ?? {},
      );
      const actorId = req.auth!.userId;

      const done = await prisma.$transaction(async tx => {
        // Claim first: a concurrent second validate sees count 0 and can't double-apply.
        const claimed = await tx.operation.updateMany({ where: { id: req.params.id, type, status: { in: OPEN } }, data: { status: 'DONE' } });
        if (!claimed.count) {
          await load(req.params.id, type, tx);
          throw conflict('Document is already done or cancelled');
        }
        if (type === 'RECEIPT' && b.lines) {
          for (const l of b.lines) {
            const u = await tx.operationLine.updateMany({ where: { id: l.id, operationId: req.params.id }, data: { doneQty: l.receivedQty } });
            if (!u.count) throw badRequest(`Unknown line ${l.id}`);
          }
        }
        const op = await load(req.params.id, type, tx);
        if (!op.lines.length) throw badRequest('Nothing to validate: add at least one product line');

        const src = op.sourceLocation && locationLabel(op.sourceLocation);
        const dst = op.destLocation && locationLabel(op.destLocation);
        const ordered = [...op.lines].sort((a, z) => a.productId.localeCompare(z.productId)); // stable lock order

        for (const l of ordered) {
          const qty = type === 'RECEIPT' ? (l.doneQty ?? l.expectedQty) : l.expectedQty;
          await tx.operationLine.update({ where: { id: l.id }, data: { doneQty: qty } });
          if (qty === 0) continue;
          const ledger = { productId: l.productId, reference: op.reference, contact: op.contact, actorId };

          if (type === 'RECEIPT') {
            await moveStock(tx, l.productId, op.destLocationId!, qty);
            await writeLedger(tx, { ...ledger, movementType: 'RECEIPT', fromLabel: 'vendor', toLabel: dst!, quantity: qty });
          } else if (type === 'DELIVERY' && op.sourceLocationId) {
            await moveStock(tx, l.productId, op.sourceLocationId, -qty, `${l.product.name} (${l.product.sku})`);
            await writeLedger(tx, { ...ledger, movementType: 'DELIVERY', fromLabel: src!, toLabel: 'customer', quantity: -qty });
          } else if (type === 'DELIVERY') {
            // Warehouse-wide pick: plan to drain the fullest locations first, one ledger row per location used.
            // Plans are re-made from fresh stock if a concurrent order takes stock from under us, and the
            // updates run in a fixed location order so two competing picks can't deadlock.
            const what = `${l.product.name} (${l.product.sku})`;
            let left = qty;
            for (let attempt = 0; attempt < 5 && left > 0; attempt++) {
              const pools = await tx.stockLevel.findMany({
                where: { productId: l.productId, quantity: { gt: 0 }, location: { warehouseId: op.warehouseId! } },
                include: { location: { include: { warehouse: true } } },
                orderBy: [{ quantity: 'desc' }, { locationId: 'asc' }],
              });
              const plan: { pool: (typeof pools)[number]; take: number }[] = [];
              let need = left;
              for (const pool of pools) {
                if (need <= 0) break;
                const take = Math.min(need, pool.quantity);
                plan.push({ pool, take });
                need -= take;
              }
              if (need > 0) {
                throw conflict(`Insufficient stock for ${what}: need ${qty}, have ${qty - left + (left - need)}`, {
                  productId: l.productId, need: qty, have: qty - left + (left - need),
                });
              }
              plan.sort((a, b) => a.pool.locationId.localeCompare(b.pool.locationId));
              for (const { pool, take } of plan) {
                if (!(await takeStock(tx, l.productId, pool.locationId, take))) break; // stock moved; re-plan
                await writeLedger(tx, { ...ledger, movementType: 'DELIVERY', fromLabel: locationLabel(pool.location), toLabel: 'customer', quantity: -take });
                left -= take;
              }
            }
            if (left > 0) throw conflict(`Insufficient stock for ${what}: stock changed while picking, please retry`, { productId: l.productId });
          } else {
            await moveStock(tx, l.productId, op.sourceLocationId!, -qty, `${l.product.name} (${l.product.sku})`);
            await moveStock(tx, l.productId, op.destLocationId!, qty);
            await writeLedger(tx, { ...ledger, movementType: 'TRANSFER', fromLabel: src!, toLabel: dst!, quantity: qty });
          }
        }
        return load(op.id, type, tx);
      });
      res.json(await present(done));
    }),
  );

  return r;
}
