import type { DocumentStatus, MovementType } from '@prisma/client';
import type { Tx } from './prisma.js';
import { conflict } from './errors.js';

/** "WH/Stock1" style label for a location. */
export const locationLabel = (l: { shortCode: string; warehouse: { shortCode: string } }) =>
  `${l.warehouse.shortCode}/${l.shortCode}`;

export async function productTotal(tx: Tx, productId: string): Promise<number> {
  const r = await tx.stockLevel.aggregate({ where: { productId }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}

export async function locationQty(tx: Tx, productId: string, locationId: string): Promise<number> {
  const r = await tx.stockLevel.findUnique({ where: { productId_locationId: { productId, locationId } } });
  return r?.quantity ?? 0;
}

/** Atomically take `need` from a location if it has that much. The check is part of the UPDATE, so concurrent takers can't overdraw. */
export async function takeStock(tx: Tx, productId: string, locationId: string, need: number): Promise<boolean> {
  const r = await tx.stockLevel.updateMany({
    where: { productId, locationId, quantity: { gte: need } },
    data: { quantity: { decrement: need } },
  });
  return r.count > 0;
}

/**
 * Change on-hand stock at a location by `delta`. Never lets stock go negative;
 * the check is part of the UPDATE so concurrent validations can't overdraw.
 */
export async function moveStock(tx: Tx, productId: string, locationId: string, delta: number, what = 'product') {
  if (delta === 0) return;
  if (delta > 0) {
    await tx.stockLevel.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: { productId, locationId, quantity: delta },
      update: { quantity: { increment: delta } },
    });
    return;
  }
  const need = -delta;
  if (!(await takeStock(tx, productId, locationId, need))) {
    const have = await locationQty(tx, productId, locationId);
    throw conflict(`Insufficient stock for ${what}: need ${need}, have ${have}`, { productId, locationId, need, have });
  }
}

export interface LedgerInput {
  productId: string;
  movementType: MovementType;
  reference: string;
  fromLabel: string;
  toLabel: string;
  contact?: string;
  quantity: number;
  actorId: string;
  status?: DocumentStatus;
}

/** Append a ledger row. Call AFTER moveStock so resultingQty reflects the new total. */
export async function writeLedger(tx: Tx, e: LedgerInput) {
  const resultingQty = await productTotal(tx, e.productId);
  return tx.ledgerEntry.create({ data: { ...e, contact: e.contact ?? '', status: e.status ?? 'DONE', resultingQty } });
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export function stockStatus(total: number, threshold?: number | null): StockStatus {
  if (total <= 0) return 'OUT_OF_STOCK';
  if (threshold != null && total <= threshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}
