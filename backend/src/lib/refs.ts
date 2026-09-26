import type { OperationType } from '@prisma/client';
import type { Tx } from './prisma.js';

const PREFIX: Record<OperationType | 'ADJUSTMENT', string> = {
  RECEIPT: 'IN',
  DELIVERY: 'OUT',
  TRANSFER: 'INT',
  ADJUSTMENT: 'ADJ',
};

/** Atomically allocates the next reference, e.g. WH/IN/0007. */
export async function nextReference(tx: Tx, kind: OperationType | 'ADJUSTMENT', whCode = 'WH') {
  const key = `${whCode}/${PREFIX[kind]}`;
  const c = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}/${String(c.value).padStart(4, '0')}`;
}
