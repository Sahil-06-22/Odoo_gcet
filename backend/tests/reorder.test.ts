import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, makeProduct, makeWarehouse, resetDb, signup, stockUp, type Session } from './helpers.js';

let mgr: Session;
let staff: Session;
let wh: Awaited<ReturnType<typeof makeWarehouse>>;

beforeAll(async () => {
  await resetDb();
  mgr = await signup('INVENTORY_MANAGER');
  staff = await signup('WAREHOUSE_STAFF');
  wh = await makeWarehouse(mgr);
});

describe('reorder rules -> draft receipt', () => {
  it('orders what is at or below its threshold, once', async () => {
    const low = await makeProduct(mgr, { reorderThreshold: 10, reorderQty: 50 });
    const gap = await makeProduct(mgr, { reorderThreshold: 10 }); // no reorderQty: top up to 2x threshold
    const fine = await makeProduct(mgr, { reorderThreshold: 10 });
    const noRule = await makeProduct(mgr);
    await stockUp(mgr, low.id, wh.stock, 4);
    await stockUp(mgr, gap.id, wh.stock, 6);
    await stockUp(mgr, fine.id, wh.stock, 500);
    await stockUp(mgr, noRule.id, wh.stock, 0 + 1);

    const res = await api().post('/api/reorder/draft-receipt').set(auth(mgr)).send({ warehouseId: wh.id, supplier: 'Acme Supply' });
    expect(res.status).toBe(201);
    expect(res.body.receipt.status).toBe('DRAFT');
    const qty = Object.fromEntries(res.body.receipt.lines.map((l: any) => [l.productId, l.quantity]));
    expect(qty).toEqual({ [low.id]: 50, [gap.id]: 14 }); // 2*10 - 6

    const receipt = (await api().get(`/api/receipts/${res.body.receipt.id}`).set(auth(mgr))).body;
    expect(receipt.supplier).toBe('Acme Supply');
    expect(receipt.lines.map((l: any) => l.expectedQty).sort((a: number, b: number) => a - b)).toEqual([14, 50]);

    // pressing it again must not double-order
    const again = await api().post('/api/reorder/draft-receipt').set(auth(mgr)).send({ warehouseId: wh.id });
    expect(again.status).toBe(200);
    expect(again.body.receipt).toBeNull();
    expect(again.body.skipped.map((s: any) => s.reason)).toEqual(['already on an open receipt', 'already on an open receipt']);

    // validating the receipt restocks; nothing is left to reorder
    await api().post(`/api/receipts/${receipt.id}/validate`).set(auth(mgr)).send({}).expect(200);
    const after = await api().post('/api/reorder/draft-receipt').set(auth(mgr)).send({ warehouseId: wh.id });
    expect(after.body.receipt).toBeNull();
    expect(after.body.skipped).toEqual([]);
  });

  it('can be limited to chosen products, and needs a real warehouse', async () => {
    const a = await makeProduct(mgr, { reorderThreshold: 5, reorderQty: 20 });
    const b = await makeProduct(mgr, { reorderThreshold: 5, reorderQty: 20 });
    const res = await api().post('/api/reorder/draft-receipt').set(auth(mgr)).send({ warehouseId: wh.id, productIds: [a.id] });
    expect(res.body.receipt.lines.map((l: any) => l.productId)).toEqual([a.id]);
    expect(b.id).toBeTruthy();
    expect((await api().post('/api/reorder/draft-receipt').set(auth(mgr)).send({ warehouseId: 'nope' })).status).toBe(400);
  });

  it('is manager-only', async () => {
    expect((await api().post('/api/reorder/draft-receipt').set(auth(staff)).send({ warehouseId: wh.id })).status).toBe(403);
  });
});

describe('pagination', () => {
  it('pages products and reports the total in X-Total-Count', async () => {
    for (let i = 0; i < 5; i++) await makeProduct(mgr, { category: 'PageTest' });
    const p1 = await api().get('/api/products?category=PageTest&limit=2&page=1').set(auth(mgr));
    const p3 = await api().get('/api/products?category=PageTest&limit=2&page=3').set(auth(mgr));
    expect(p1.body).toHaveLength(2);
    expect(p1.headers['x-total-count']).toBe('5');
    expect(p3.body).toHaveLength(1);
    const ids = [...p1.body, ...(await api().get('/api/products?category=PageTest&limit=2&page=2').set(auth(mgr))).body, ...p3.body].map((x: any) => x.id);
    expect(new Set(ids).size).toBe(5); // no overlaps, nothing missing
  });

  it('pages documents and the ledger, and leaves un-paged calls as plain arrays', async () => {
    const p = await makeProduct(mgr);
    for (let i = 0; i < 3; i++) await stockUp(mgr, p.id, wh.stock, 1);
    const docs = await api().get('/api/receipts?limit=2').set(auth(mgr));
    expect(docs.body).toHaveLength(2);
    expect(Number(docs.headers['x-total-count'])).toBeGreaterThanOrEqual(3);

    const led = await api().get(`/api/ledger?productId=${p.id}&limit=2&page=2`).set(auth(mgr));
    expect(led.body).toHaveLength(1);
    expect(led.headers['x-total-count']).toBe('3');
    expect(Array.isArray((await api().get('/api/receipts').set(auth(mgr))).body)).toBe(true);
    expect((await api().get('/api/products?limit=0').set(auth(mgr))).status).toBe(400);
  });
});
