import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, makeProduct, makeWarehouse, resetDb, signup, stockUp, totalStock, type Session } from './helpers.js';

let mgr: Session;
let wh: Awaited<ReturnType<typeof makeWarehouse>>;

beforeAll(async () => {
  await resetDb();
  mgr = await signup('INVENTORY_MANAGER');
  wh = await makeWarehouse(mgr);
});

const newDelivery = async (productId: string, qty: number, extra: Record<string, unknown> = {}) =>
  (await api().post('/api/deliveries').set(auth(mgr)).send({ contact: 'C', sourceLocationId: wh.stock, lines: [{ productId, quantity: qty }], ...extra })).body.id as string;

describe('concurrent stock changes', () => {
  it('validating the same document many times at once applies it exactly once', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 100);
    const id = await newDelivery(p.id, 30);

    const results = await Promise.all(Array.from({ length: 8 }, () => api().post(`/api/deliveries/${id}/validate`).set(auth(mgr)).send({})));
    const codes = results.map(r => r.status).sort();
    expect(codes.filter(c => c === 200)).toHaveLength(1);
    expect(codes.filter(c => c === 409)).toHaveLength(7);
    expect(await totalStock(mgr, p.id)).toBe(70);
    expect((await api().get(`/api/ledger?productId=${p.id}&type=DELIVERY`).set(auth(mgr))).body).toHaveLength(1);
  });

  it('two deliveries that together exceed stock cannot both succeed (no negative stock)', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 100);
    const a = await newDelivery(p.id, 60);
    const b = await newDelivery(p.id, 60);

    const [ra, rb] = await Promise.all([
      api().post(`/api/deliveries/${a}/validate`).set(auth(mgr)).send({}),
      api().post(`/api/deliveries/${b}/validate`).set(auth(mgr)).send({}),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    expect(await totalStock(mgr, p.id)).toBe(40);
  });

  it('the same holds for warehouse-wide picks racing each other', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 30);
    await stockUp(mgr, p.id, wh.rack, 30);
    const ids = await Promise.all([1, 2, 3].map(() => newDelivery(p.id, 25, { sourceLocationId: undefined, sourceWarehouseId: wh.id })));

    const res = await Promise.all(ids.map(id => api().post(`/api/deliveries/${id}/validate`).set(auth(mgr)).send({})));
    const won = res.filter(r => r.status === 200).length;
    expect(won).toBe(2); // 60 in stock: two orders of 25 fit, the third can't
    expect(await totalStock(mgr, p.id)).toBe(10);
    const levels = (await api().get('/api/stock').set(auth(mgr))).body as any[];
    expect(levels.filter(l => l.productId === p.id).every(l => l.quantity >= 0)).toBe(true);
  });

  it('parallel receipts and adjustments all land (no lost updates)', async () => {
    const p = await makeProduct(mgr);
    const receipts = await Promise.all(
      Array.from({ length: 6 }, async () => (await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [{ productId: p.id, expectedQty: 10 }] })).body.id as string),
    );
    await Promise.all(receipts.map(id => api().post(`/api/receipts/${id}/validate`).set(auth(mgr)).send({}).expect(200)));
    expect(await totalStock(mgr, p.id)).toBe(60);
  });

  it('document references stay unique under parallel creation', async () => {
    const refs = await Promise.all(Array.from({ length: 10 }, async () => (await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [] })).body.reference as string));
    expect(new Set(refs).size).toBe(10);
  });
});
