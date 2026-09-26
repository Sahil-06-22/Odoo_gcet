import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, makeProduct, makeWarehouse, resetDb, signup, stockUp, totalStock, type Session } from './helpers.js';

let mgr: Session;
let wh: Awaited<ReturnType<typeof makeWarehouse>>;
let other: Awaited<ReturnType<typeof makeWarehouse>>;

beforeAll(async () => {
  await resetDb();
  mgr = await signup('INVENTORY_MANAGER');
  wh = await makeWarehouse(mgr);
  other = await makeWarehouse(mgr);
});

const deliver = (p: string, qty: number, extra: Record<string, unknown>) =>
  api().post('/api/deliveries').set(auth(mgr)).send({ contact: 'Client', lines: [{ productId: p, quantity: qty }], ...extra });

describe('warehouse-wide picking', () => {
  it('pulls from several locations, fullest first, with one ledger row per location', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 30);
    await stockUp(mgr, p.id, wh.rack, 20);

    const dl = await deliver(p.id, 40, { sourceWarehouseId: wh.id });
    expect(dl.status).toBe(201);
    expect(dl.body.sourceWarehouseId).toBe(wh.id);
    expect(dl.body.lines[0].isInsufficient).toBe(false);

    const v = await api().post(`/api/deliveries/${dl.body.id}/validate`).set(auth(mgr)).send({});
    expect(v.status).toBe(200);
    expect(await totalStock(mgr, p.id)).toBe(10);

    const levels = (await api().get(`/api/stock?warehouseId=${wh.id}`).set(auth(mgr))).body as any[];
    const qty = Object.fromEntries(levels.filter(l => l.productId === p.id).map(l => [l.locationId, l.quantity]));
    expect(qty).toEqual({ [wh.stock]: 0, [wh.rack]: 10 }); // drained Stock1 (30) first, then 10 from Rack

    const led = (await api().get(`/api/ledger?productId=${p.id}&type=DELIVERY`).set(auth(mgr))).body as any[];
    expect(led.map(e => e.quantity).sort((a, b) => a - b)).toEqual([-30, -10]);
    expect(led.every(e => e.reference === dl.body.reference)).toBe(true);
    expect(led.map(e => e.resultingQty).sort((a, b) => a - b)).toEqual([10, 20]); // running total: 50 -> 20 -> 10
  });

  it('counts the whole warehouse when flagging shortages, and refuses beyond it', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 5);
    await stockUp(mgr, p.id, wh.rack, 5);
    await stockUp(mgr, p.id, other.stock, 100); // stock elsewhere must not count

    const ok = await deliver(p.id, 10, { sourceWarehouseId: wh.id });
    expect(ok.body.lines[0].isInsufficient).toBe(false);
    const tooMuch = await deliver(p.id, 11, { sourceWarehouseId: wh.id });
    expect(tooMuch.body.lines[0].isInsufficient).toBe(true);

    expect((await api().post(`/api/deliveries/${tooMuch.body.id}/confirm`).set(auth(mgr))).body.status).toBe('WAITING');
    const v = await api().post(`/api/deliveries/${tooMuch.body.id}/validate`).set(auth(mgr)).send({});
    expect(v.status).toBe(409);
    expect(v.body.error.message).toMatch(/need 11, have 10/);
    expect(await totalStock(mgr, p.id)).toBe(110); // nothing moved, other warehouse untouched
  });

  it('a delivery pinned to a location still only uses that location', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 5);
    await stockUp(mgr, p.id, wh.rack, 50);
    const dl = await deliver(p.id, 10, { sourceLocationId: wh.stock });
    expect(dl.body.lines[0].isInsufficient).toBe(true);
    expect((await api().post(`/api/deliveries/${dl.body.id}/validate`).set(auth(mgr)).send({})).status).toBe(409);
  });

  it('needs a warehouse or a location, and shows up in per-warehouse lists', async () => {
    const p = await makeProduct(mgr);
    expect((await deliver(p.id, 1, {})).status).toBe(400);
    expect((await deliver(p.id, 1, { sourceWarehouseId: 'nope' })).status).toBe(400);

    const dl = await deliver(p.id, 1, { sourceWarehouseId: wh.id });
    const mine = (await api().get(`/api/deliveries?warehouseId=${wh.id}`).set(auth(mgr))).body.map((d: any) => d.id);
    const theirs = (await api().get(`/api/deliveries?warehouseId=${other.id}`).set(auth(mgr))).body.map((d: any) => d.id);
    expect(mine).toContain(dl.body.id);
    expect(theirs).not.toContain(dl.body.id);
    expect(dl.body.reference.startsWith(`${wh.code}/OUT/`)).toBe(true);
  });
});
