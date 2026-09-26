import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, makeProduct, makeWarehouse, resetDb, signup, stockUp, totalStock, uid, type Session } from './helpers.js';

let mgr: Session;
let staff: Session;
let wh: Awaited<ReturnType<typeof makeWarehouse>>;

beforeAll(async () => {
  await resetDb();
  mgr = await signup('INVENTORY_MANAGER');
  staff = await signup('WAREHOUSE_STAFF');
  wh = await makeWarehouse(mgr);
});

describe('the problem-statement flow: receive 100 -> move -> deliver 20 -> adjust -3', () => {
  it('keeps stock, locations and the ledger consistent at every step', async () => {
    const p = await makeProduct(mgr, { name: 'Steel', unitOfMeasure: 'kg', reorderThreshold: 10 });
    expect(p.totalStock).toBe(0);

    // 1. receive 100
    const rc = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'Vendor', locationId: wh.stock, lines: [{ productId: p.id, expectedQty: 100 }] });
    expect(rc.status).toBe(201);
    expect(rc.body.status).toBe('DRAFT');
    expect(rc.body.reference).toMatch(new RegExp(`^${wh.code}/IN/0001$`));
    expect(await totalStock(mgr, p.id)).toBe(0); // drafts don't move stock
    const done = await api().post(`/api/receipts/${rc.body.id}/validate`).set(auth(mgr)).send({});
    expect(done.body.status).toBe('DONE');
    expect(await totalStock(mgr, p.id)).toBe(100);

    // 2. internal transfer: total unchanged, location split
    const tr = await api().post('/api/transfers').set(auth(staff)).send({ sourceLocationId: wh.stock, destLocationId: wh.rack, lines: [{ productId: p.id, quantity: 40 }] });
    expect(tr.status).toBe(201);
    await api().post(`/api/transfers/${tr.body.id}/confirm`).set(auth(staff)).expect(200);
    await api().post(`/api/transfers/${tr.body.id}/validate`).set(auth(staff)).send({}).expect(200);
    const detail = (await api().get(`/api/products/${p.id}`).set(auth(mgr))).body;
    expect(detail.totalStock).toBe(100);
    expect(Object.fromEntries(detail.stockByLocation.map((l: any) => [l.locationId, l.quantity]))).toEqual({ [wh.stock]: 60, [wh.rack]: 40 });

    // 3. deliver 20 from Stock1
    const dl = await api().post('/api/deliveries').set(auth(mgr)).send({ contact: 'Client', deliveryAddress: 'Noida', sourceLocationId: wh.stock, lines: [{ productId: p.id, quantity: 20 }] });
    await api().post(`/api/deliveries/${dl.body.id}/confirm`).set(auth(mgr)).expect(200);
    await api().post(`/api/deliveries/${dl.body.id}/validate`).set(auth(mgr)).send({}).expect(200);
    expect(await totalStock(mgr, p.id)).toBe(80);

    // 4. adjust: 3 damaged
    const adj = await api().post('/api/adjustments').set(auth(staff)).send({ productId: p.id, locationId: wh.stock, countedQty: 37, reason: 'damaged' });
    expect(adj.status).toBe(201);
    expect(adj.body).toMatchObject({ recordedQty: 40, countedQty: 37, difference: -3, status: 'DONE' });
    expect(await totalStock(mgr, p.id)).toBe(77);

    // everything is in the ledger, in order, with running totals
    const led = (await api().get(`/api/ledger?productId=${p.id}`).set(auth(mgr))).body as any[];
    const chrono = [...led].reverse();
    expect(chrono.map(e => `${e.movementType}:${e.quantity}`)).toEqual(['RECEIPT:100', 'TRANSFER:40', 'DELIVERY:-20', 'ADJUSTMENT:-3']);
    expect(chrono.map(e => e.resultingQty)).toEqual([100, 100, 80, 77]);
    expect(chrono.every(e => e.actor)).toBe(true);
    expect((await api().get(`/api/ledger?productId=${p.id}&type=INTERNAL_TRANSFER`).set(auth(mgr))).body).toHaveLength(1);
  });
});

describe('document state machine', () => {
  it('cannot validate or cancel twice, or edit a finished document', async () => {
    const p = await makeProduct(mgr);
    const rc = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [{ productId: p.id, expectedQty: 5 }] });
    await api().post(`/api/receipts/${rc.body.id}/validate`).set(auth(mgr)).send({}).expect(200);
    expect((await api().post(`/api/receipts/${rc.body.id}/validate`).set(auth(mgr)).send({})).status).toBe(409);
    expect((await api().post(`/api/receipts/${rc.body.id}/cancel`).set(auth(mgr))).status).toBe(409);
    expect((await api().patch(`/api/receipts/${rc.body.id}`).set(auth(mgr)).send({ supplier: 'Other' })).status).toBe(409);
    expect((await api().delete(`/api/receipts/${rc.body.id}`).set(auth(mgr))).status).toBe(409);
    expect(await totalStock(mgr, p.id)).toBe(5); // applied exactly once
  });

  it('a cancelled document moves no stock and cannot be validated', async () => {
    const p = await makeProduct(mgr);
    const rc = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [{ productId: p.id, expectedQty: 5 }] });
    await api().post(`/api/receipts/${rc.body.id}/cancel`).set(auth(mgr)).expect(200);
    expect((await api().post(`/api/receipts/${rc.body.id}/validate`).set(auth(mgr)).send({})).status).toBe(409);
    expect(await totalStock(mgr, p.id)).toBe(0);
  });

  it('receipts honour the received quantity (partial receipt)', async () => {
    const p = await makeProduct(mgr);
    const rc = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [{ productId: p.id, expectedQty: 10 }] });
    const lineId = rc.body.lines[0].id;
    const v = await api().post(`/api/receipts/${rc.body.id}/validate`).set(auth(mgr)).send({ lines: [{ id: lineId, receivedQty: 6 }] });
    expect(v.body.lines[0]).toMatchObject({ expectedQty: 10, receivedQty: 6 });
    expect(await totalStock(mgr, p.id)).toBe(6);
  });

  it('confirm needs lines; empty documents cannot be validated', async () => {
    const rc = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [] });
    expect((await api().post(`/api/receipts/${rc.body.id}/confirm`).set(auth(mgr))).status).toBe(400);
    expect((await api().post(`/api/receipts/${rc.body.id}/validate`).set(auth(mgr)).send({})).status).toBe(400);
    const after = await api().get(`/api/receipts/${rc.body.id}`).set(auth(mgr));
    expect(after.body.status).toBe('DRAFT'); // the failed validate rolled back its status claim
  });

  it('editing replaces the lines while the document is open', async () => {
    const a = await makeProduct(mgr);
    const b = await makeProduct(mgr);
    const rc = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [{ productId: a.id, expectedQty: 1 }] });
    const upd = await api().patch(`/api/receipts/${rc.body.id}`).set(auth(mgr)).send({ supplier: 'V2', lines: [{ productId: b.id, expectedQty: 7 }] });
    expect(upd.body.supplier).toBe('V2');
    expect(upd.body.lines).toHaveLength(1);
    expect(upd.body.lines[0]).toMatchObject({ productId: b.id, expectedQty: 7 });
  });
});

describe('stock safety', () => {
  it('flags, waits, refuses and rolls back a delivery that stock cannot cover', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 10);
    const dl = await api().post('/api/deliveries').set(auth(mgr)).send({ contact: 'C', sourceLocationId: wh.stock, lines: [{ productId: p.id, quantity: 50 }] });
    expect(dl.body.lines[0].isInsufficient).toBe(true);
    const c = await api().post(`/api/deliveries/${dl.body.id}/confirm`).set(auth(mgr));
    expect(c.body.status).toBe('WAITING');
    const v = await api().post(`/api/deliveries/${dl.body.id}/validate`).set(auth(mgr)).send({});
    expect(v.status).toBe(409);
    expect(v.body.error.message).toMatch(/Insufficient stock/);
    expect((await api().get(`/api/deliveries/${dl.body.id}`).set(auth(mgr))).body.status).toBe('WAITING');
    expect(await totalStock(mgr, p.id)).toBe(10);
  });

  it('a multi-line delivery is all-or-nothing', async () => {
    const enough = await makeProduct(mgr);
    const short = await makeProduct(mgr);
    await stockUp(mgr, enough.id, wh.stock, 10);
    await stockUp(mgr, short.id, wh.stock, 1);
    const dl = await api().post('/api/deliveries').set(auth(mgr)).send({
      contact: 'C', sourceLocationId: wh.stock,
      lines: [{ productId: enough.id, quantity: 5 }, { productId: short.id, quantity: 9 }],
    });
    expect((await api().post(`/api/deliveries/${dl.body.id}/validate`).set(auth(mgr)).send({})).status).toBe(409);
    expect(await totalStock(mgr, enough.id)).toBe(10); // the satisfiable line was rolled back too
    expect((await api().get(`/api/ledger?productId=${enough.id}`).set(auth(mgr))).body.filter((e: any) => e.movementType === 'DELIVERY')).toHaveLength(0);
  });

  it('transfers cannot move stock that is not at the source, or to the same place', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 5);
    const tr = await api().post('/api/transfers').set(auth(staff)).send({ sourceLocationId: wh.rack, destLocationId: wh.stock, lines: [{ productId: p.id, quantity: 1 }] });
    expect((await api().post(`/api/transfers/${tr.body.id}/validate`).set(auth(staff)).send({})).status).toBe(409);
    expect((await api().post('/api/transfers').set(auth(staff)).send({ sourceLocationId: wh.stock, destLocationId: wh.stock, lines: [] })).status).toBe(400);
  });

  it('adjustments can raise stock as well as lower it, and a no-op writes no ledger row', async () => {
    const p = await makeProduct(mgr);
    await stockUp(mgr, p.id, wh.stock, 10);
    const up = await api().post('/api/adjustments').set(auth(staff)).send({ productId: p.id, locationId: wh.stock, countedQty: 14, reason: 'found 4' });
    expect(up.body.difference).toBe(4);
    expect(await totalStock(mgr, p.id)).toBe(14);
    const same = await api().post('/api/adjustments').set(auth(staff)).send({ productId: p.id, locationId: wh.stock, countedQty: 14, reason: 'recount' });
    expect(same.body.difference).toBe(0);
    const adjRows = (await api().get(`/api/ledger?productId=${p.id}&type=ADJUSTMENT`).set(auth(mgr))).body;
    expect(adjRows).toHaveLength(1);
    expect((await api().post('/api/adjustments').set(auth(staff)).send({ productId: p.id, locationId: wh.stock, countedQty: -1 })).status).toBe(400);
  });

  it('rejects unknown or inactive products on documents', async () => {
    const res = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [{ productId: 'nope', expectedQty: 1 }] });
    expect(res.status).toBe(400);
    const p = await makeProduct(mgr);
    await api().delete(`/api/products/${p.id}`).set(auth(mgr)).expect(204);
    const res2 = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [{ productId: p.id, expectedQty: 1 }] });
    expect(res2.status).toBe(400);
  });
});

describe('roles', () => {
  it('warehouse staff can operate but not administer', async () => {
    const p = await makeProduct(mgr);
    expect((await api().post('/api/products').set(auth(staff)).send({ name: 'x', sku: `x-${uid()}`, category: 'c' })).status).toBe(403);
    expect((await api().patch(`/api/products/${p.id}`).set(auth(staff)).send({ name: 'y' })).status).toBe(403);
    expect((await api().post('/api/warehouses').set(auth(staff)).send({ name: 'n', shortCode: 'nn' })).status).toBe(403);
    expect((await api().post('/api/categories').set(auth(staff)).send({ name: 'c' })).status).toBe(403);
    expect((await api().post('/api/receipts').set(auth(staff)).send({ supplier: 'V', locationId: wh.stock, lines: [] })).status).toBe(403);
    expect((await api().post('/api/deliveries').set(auth(staff)).send({ contact: 'V', sourceLocationId: wh.stock, lines: [] })).status).toBe(403);
    // ...but can read, transfer and adjust
    expect((await api().get('/api/products').set(auth(staff))).status).toBe(200);
    expect((await api().post('/api/transfers').set(auth(staff)).send({ sourceLocationId: wh.stock, destLocationId: wh.rack, lines: [] })).status).toBe(201);
  });
});

describe('catalog and filters', () => {
  it('upper-cases SKUs, rejects duplicates, filters by search / category / stock status', async () => {
    const sku = `abc-${uid()}`;
    const p = await api().post('/api/products').set(auth(mgr)).send({ name: 'Findable Widget', sku, category: 'Widgets', reorderThreshold: 5 });
    expect(p.body.sku).toBe(sku.toUpperCase());
    expect(p.body.stockStatus).toBe('OUT_OF_STOCK');
    expect((await api().post('/api/products').set(auth(mgr)).send({ name: 'dup', sku, category: 'Widgets' })).status).toBe(409);

    expect((await api().get('/api/products?search=findable').set(auth(mgr))).body.map((x: any) => x.id)).toContain(p.body.id);
    expect((await api().get(`/api/products?search=${sku}`).set(auth(mgr))).body).toHaveLength(1);
    expect((await api().get('/api/products?category=Widgets').set(auth(mgr))).body.every((x: any) => x.category === 'Widgets')).toBe(true);

    await stockUp(mgr, p.body.id, wh.stock, 3); // 3 <= threshold 5
    expect((await api().get(`/api/products?search=${sku}&stockStatus=LOW_STOCK`).set(auth(mgr))).body).toHaveLength(1);
    await stockUp(mgr, p.body.id, wh.stock, 100);
    expect((await api().get(`/api/products?search=${sku}&stockStatus=IN_STOCK`).set(auth(mgr))).body).toHaveLength(1);
  });

  it('creates products with initial stock (and a ledger row) at a chosen location', async () => {
    const p = await makeProduct(mgr, { initialStock: 12, locationId: wh.rack });
    expect(p.totalStock).toBe(12);
    const d = (await api().get(`/api/products/${p.id}`).set(auth(mgr))).body;
    expect(d.stockByLocation).toEqual([expect.objectContaining({ locationId: wh.rack, quantity: 12 })]);
    const led = (await api().get(`/api/ledger?productId=${p.id}`).set(auth(mgr))).body;
    expect(led).toHaveLength(1);
    expect(led[0].quantity).toBe(12);
  });

  it('stores and returns the unit cost with two decimals', async () => {
    const p = await makeProduct(mgr, { unitCost: 12.5 });
    expect(p.unitCost).toBe(12.5);
    const upd = await api().patch(`/api/products/${p.id}`).set(auth(mgr)).send({ unitCost: 99.99 });
    expect(upd.body.unitCost).toBe(99.99);
    expect((await api().patch(`/api/products/${p.id}`).set(auth(mgr)).send({ unitCost: -1 })).status).toBe(400);
    const cleared = await api().patch(`/api/products/${p.id}`).set(auth(mgr)).send({ unitCost: null });
    expect(cleared.body.unitCost).toBeUndefined();
  });

  it('warehouse and location codes are unique', async () => {
    expect((await api().post('/api/warehouses').set(auth(mgr)).send({ name: 'dup', shortCode: wh.code })).status).toBe(409);
    expect((await api().post(`/api/warehouses/${wh.id}/locations`).set(auth(mgr)).send({ name: 'dup', shortCode: 'Rack' })).status).toBe(409);
  });
});

describe('dashboard', () => {
  it('reports KPIs, pending documents and the low-stock list', async () => {
    const k0 = (await api().get('/api/dashboard/kpis').set(auth(mgr))).body;
    const p = await makeProduct(mgr, { reorderThreshold: 10, reorderQty: 40 });
    await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'V', locationId: wh.stock, lines: [{ productId: p.id, expectedQty: 1 }] });
    const k1 = (await api().get('/api/dashboard/kpis').set(auth(mgr))).body;
    expect(k1.totalProducts).toBe(k0.totalProducts + 1);
    expect(k1.outOfStockItems).toBe(k0.outOfStockItems + 1);
    expect(k1.pendingReceipts).toBe(k0.pendingReceipts + 1);

    const low = (await api().get('/api/dashboard/low-stock').set(auth(mgr))).body;
    expect(low.find((r: any) => r.productId === p.id)).toMatchObject({ stockStatus: 'OUT_OF_STOCK', suggestedOrderQty: 40 });

    const ops = (await api().get('/api/dashboard/operations').set(auth(mgr))).body;
    expect(ops.byTypeAndStatus.some((g: any) => g.type === 'RECEIPT' && g.status === 'DRAFT')).toBe(true);
  });

  it('scopes KPIs to a warehouse', async () => {
    const w2 = await makeWarehouse(mgr);
    const p = await makeProduct(mgr, { initialStock: 5, locationId: w2.stock });
    const scoped = (await api().get(`/api/dashboard/kpis?warehouseId=${w2.id}`).set(auth(mgr))).body;
    const whole = (await api().get('/api/dashboard/kpis').set(auth(mgr))).body;
    expect(scoped.inStockProducts).toBe(1);
    expect(whole.inStockProducts).toBeGreaterThan(scoped.inStockProducts);
    expect((await api().get(`/api/stock?warehouseId=${w2.id}`).set(auth(mgr))).body).toEqual([expect.objectContaining({ productId: p.id, quantity: 5 })]);
  });
});
