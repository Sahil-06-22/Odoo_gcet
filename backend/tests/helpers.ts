import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export const api = () => request(app);
export { prisma };

let seq = 0;
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Empty every table so each test file starts from a known state. */
export async function resetDb() {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  const names = rows.map(r => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}

export interface Session {
  token: string;
  cookie: string;
  user: { id: string; email: string; role: string; name: string };
}

export async function signup(role: 'INVENTORY_MANAGER' | 'WAREHOUSE_STAFF' = 'INVENTORY_MANAGER', password = 'password123'): Promise<Session & { password: string }> {
  const email = `${role === 'INVENTORY_MANAGER' ? 'mgr' : 'staff'}-${uid()}@test.io`;
  const res = await api().post('/api/auth/signup').send({ name: role === 'INVENTORY_MANAGER' ? 'Mgr' : 'Staff', email, password, role });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken, cookie: (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0], user: res.body.user, password };
}

export const auth = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

/** A warehouse (default location "Stock1") plus an extra location "Rack". */
export async function makeWarehouse(mgr: Session, code = `W${uid()}`.slice(0, 10).toUpperCase()) {
  const wh = await api().post('/api/warehouses').set(auth(mgr)).send({ name: `WH ${code}`, shortCode: code });
  const rack = await api().post(`/api/warehouses/${wh.body.id}/locations`).set(auth(mgr)).send({ name: 'Rack', shortCode: 'Rack' });
  return { id: wh.body.id as string, code, stock: wh.body.locations[0].id as string, rack: rack.body.id as string };
}

export async function makeProduct(mgr: Session, extra: Record<string, unknown> = {}) {
  const res = await api().post('/api/products').set(auth(mgr)).send({ name: `Item ${uid()}`, sku: `sku-${uid()}`, category: 'Test', ...extra });
  if (res.status !== 201) throw new Error(`product failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; sku: string; totalStock: number; unitCost?: number };
}

/** Put stock somewhere by running a real receipt through the API. */
export async function stockUp(mgr: Session, productId: string, locationId: string, qty: number) {
  const r = await api().post('/api/receipts').set(auth(mgr)).send({ supplier: 'Seed', locationId, lines: [{ productId, expectedQty: qty }] });
  const v = await api().post(`/api/receipts/${r.body.id}/validate`).set(auth(mgr)).send({});
  if (v.status !== 200) throw new Error(`stockUp failed: ${v.status} ${JSON.stringify(v.body)}`);
}

export const totalStock = async (s: Session, productId: string) =>
  (await api().get(`/api/products/${productId}`).set(auth(s))).body.totalStock as number;
