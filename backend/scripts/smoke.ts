// End-to-end check against a running server: `npm run dev` in one terminal, `npm run smoke` in another.
// Walks the flow from the problem statement (receive 100 -> transfer -> deliver 20 -> adjust -3).
const BASE = process.env.API ?? 'http://localhost:4000/api';
const run = Date.now().toString(36);
let failed = 0;

async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

async function main() {
  console.log('auth');
  const mEmail = `mgr-${run}@test.io`;
  const sEmail = `staff-${run}@test.io`;
  const m = await call('POST', '/auth/signup', { name: 'Mgr', email: mEmail, password: 'password123', role: 'INVENTORY_MANAGER' });
  check('manager signup 201', m.status === 201, m.body);
  const s = await call('POST', '/auth/signup', { name: 'Staff', email: sEmail, password: 'password123', role: 'WAREHOUSE_STAFF' });
  const T = m.body.accessToken as string;
  const ST = s.body.accessToken as string;
  check('duplicate signup 409', (await call('POST', '/auth/signup', { name: 'x', email: mEmail, password: 'password123' })).status === 409);
  check('bad login 401', (await call('POST', '/auth/login', { email: mEmail, password: 'wrongpass1' })).status === 401);
  check('no token 401', (await call('GET', '/products')).status === 401);
  check('login 200', (await call('POST', '/auth/login', { email: mEmail, password: 'password123' })).status === 200);

  const cookie = m.headers.get('set-cookie')?.split(';')[0] ?? '';
  const rf = await call('POST', '/auth/refresh', undefined, undefined, { Cookie: cookie });
  check('refresh rotates 200', rf.status === 200 && !!rf.body.accessToken, rf.body);
  // Reuse window: the rotated-out token still works briefly so reloads/second tabs don't log the user out.
  check('just-rotated token still works within the reuse window', (await call('POST', '/auth/refresh', undefined, undefined, { Cookie: cookie })).status === 200);
  const rfCookie = rf.headers.get('set-cookie')?.split(';')[0] ?? '';
  await call('POST', '/auth/logout', undefined, undefined, { Cookie: rfCookie });
  check('token is dead after logout', (await call('POST', '/auth/refresh', undefined, undefined, { Cookie: rfCookie })).status === 401);

  console.log('password reset (OTP)');
  const fp = await call('POST', '/auth/forgot-password', { email: sEmail });
  check('forgot-password 200 + devOtp', fp.status === 200 && /^\d{6}$/.test(fp.body.devOtp), fp.body);
  check('wrong OTP 400', (await call('POST', '/auth/verify-otp', { email: sEmail, otp: '000000' })).status === 400);
  check('right OTP valid', (await call('POST', '/auth/verify-otp', { email: sEmail, otp: fp.body.devOtp })).status === 200);
  check('reset 200', (await call('POST', '/auth/reset-password', { email: sEmail, otp: fp.body.devOtp, newPassword: 'newpassword1' })).status === 200);
  check('OTP single-use', (await call('POST', '/auth/reset-password', { email: sEmail, otp: fp.body.devOtp, newPassword: 'another1234' })).status === 400);
  check('login with new password', (await call('POST', '/auth/login', { email: sEmail, password: 'newpassword1' })).status === 200);
  check('unknown email still 200', (await call('POST', '/auth/forgot-password', { email: 'nobody@nowhere.io' })).status === 200);

  console.log('setup');
  const wh = await call('POST', '/warehouses', { name: `Main ${run}`, shortCode: `M${run}`.slice(0, 10), address: 'x' }, T);
  check('warehouse created with default location', wh.status === 201 && wh.body.locations.length === 1, wh.body);
  const store = wh.body.locations[0].id as string;
  const rack = (await call('POST', `/warehouses/${wh.body.id}/locations`, { name: 'Production Rack', shortCode: 'Rack' }, T)).body.id as string;
  check('staff cannot create warehouse 403', (await call('POST', '/warehouses', { name: 'n', shortCode: 'zz' }, ST)).status === 403);

  const prod = await call('POST', '/products', { name: `Steel ${run}`, sku: `steel-${run}`, category: 'Raw Material', unitOfMeasure: 'kg', reorderThreshold: 10 }, T);
  check('product created (sku upper-cased, 0 stock, out of stock)', prod.status === 201 && prod.body.sku === `STEEL-${run}`.toUpperCase() && prod.body.stockStatus === 'OUT_OF_STOCK', prod.body);
  const pid = prod.body.id as string;
  check('duplicate sku 409', (await call('POST', '/products', { name: 'd', sku: `steel-${run}`, category: 'x' }, T)).status === 409);
  check('staff cannot create product 403', (await call('POST', '/products', { name: 'n', sku: 'n1', category: 'c' }, ST)).status === 403);

  console.log('step 1: receive 100 kg');
  const rc = await call('POST', '/receipts', { supplier: 'Vendor A', warehouseId: wh.body.id, lines: [{ productId: pid, expectedQty: 100 }] }, T);
  check('receipt draft', rc.status === 201 && rc.body.status === 'DRAFT' && /IN\/0001$/.test(rc.body.reference), rc.body);
  check('validate before confirm is allowed but stock 0 until then', (await call('GET', `/products/${pid}`, undefined, T)).body.totalStock === 0);
  const rcv = await call('POST', `/receipts/${rc.body.id}/validate`, {}, T);
  check('receipt done', rcv.status === 200 && rcv.body.status === 'DONE', rcv.body);
  check('stock +100', (await call('GET', `/products/${pid}`, undefined, T)).body.totalStock === 100);
  check('double validate 409', (await call('POST', `/receipts/${rc.body.id}/validate`, {}, T)).status === 409);
  check('cannot cancel done 409', (await call('POST', `/receipts/${rc.body.id}/cancel`, undefined, T)).status === 409);

  console.log('step 2: internal transfer store -> rack');
  const tr = await call('POST', '/transfers', { sourceLocationId: store, destLocationId: rack, lines: [{ productId: pid, quantity: 40 }] }, ST);
  check('staff can create transfer', tr.status === 201, tr.body);
  const trc = await call('POST', `/transfers/${tr.body.id}/confirm`, undefined, ST);
  check('transfer READY', trc.body.status === 'READY', trc.body);
  await call('POST', `/transfers/${tr.body.id}/validate`, {}, ST);
  const pd = (await call('GET', `/products/${pid}`, undefined, T)).body;
  check('total unchanged (100), split across 2 locations', pd.totalStock === 100 && pd.stockByLocation.length === 2, pd);
  check('same-location transfer 400', (await call('POST', '/transfers', { sourceLocationId: store, destLocationId: store, lines: [] }, ST)).status === 400);

  console.log('step 3: deliver 20');
  const dl = await call('POST', '/deliveries', { contact: 'Customer X', deliveryAddress: 'Noida', sourceLocationId: store, lines: [{ productId: pid, quantity: 20 }] }, T);
  check('delivery draft', dl.status === 201 && dl.body.lines[0].isInsufficient === false, dl.body);
  await call('POST', `/deliveries/${dl.body.id}/confirm`, undefined, T);
  const dlv = await call('POST', `/deliveries/${dl.body.id}/validate`, {}, T);
  check('delivery done', dlv.body.status === 'DONE', dlv.body);
  check('stock now 80', (await call('GET', `/products/${pid}`, undefined, T)).body.totalStock === 80);

  console.log('insufficient stock');
  const big = await call('POST', '/deliveries', { contact: 'Big', sourceLocationId: store, lines: [{ productId: pid, quantity: 999 }] }, T);
  check('flagged insufficient', big.body.lines[0].isInsufficient === true, big.body);
  const bigc = await call('POST', `/deliveries/${big.body.id}/confirm`, undefined, T);
  check('confirm -> WAITING', bigc.body.status === 'WAITING', bigc.body);
  const bigv = await call('POST', `/deliveries/${big.body.id}/validate`, {}, T);
  check('validate refused 409, stock untouched', bigv.status === 409 && (await call('GET', `/products/${pid}`, undefined, T)).body.totalStock === 80, bigv.body);
  check('doc still open after failed validate (rolled back)', (await call('GET', `/deliveries/${big.body.id}`, undefined, T)).body.status === 'WAITING');
  check('cancel works', (await call('POST', `/deliveries/${big.body.id}/cancel`, undefined, T)).body.status === 'CANCELLED');

  console.log('step 4: adjust 3 damaged');
  const cur = (await call('GET', `/adjustments/recorded/qty?productId=${pid}&locationId=${store}`, undefined, T)).body.recordedQty;
  const adj = await call('POST', '/adjustments', { productId: pid, locationId: store, countedQty: cur - 3, reason: 'damaged' }, ST);
  check('adjustment -3', adj.status === 201 && adj.body.difference === -3 && adj.body.recordedQty === cur, adj.body);
  check('stock now 77', (await call('GET', `/products/${pid}`, undefined, T)).body.totalStock === 77);

  console.log('ledger + dashboard');
  const led = (await call('GET', `/ledger?productId=${pid}`, undefined, T)).body as any[];
  const qtys = led.map(e => `${e.movementType}:${e.quantity}`).reverse();
  check('ledger has every movement in order', JSON.stringify(qtys) === JSON.stringify(['RECEIPT:100', 'TRANSFER:40', 'DELIVERY:-20', 'ADJUSTMENT:-3']), qtys);
  check('ledger resultingQty tracks totals', JSON.stringify(led.map(e => e.resultingQty).reverse()) === JSON.stringify([100, 100, 80, 77]), led.map(e => e.resultingQty));
  check('ledger filter INTERNAL_TRANSFER alias', (await call('GET', `/ledger?productId=${pid}&type=INTERNAL_TRANSFER`, undefined, T)).body.length === 1);
  const kpi = await call('GET', '/dashboard/kpis', undefined, T);
  check('kpis shape', ['totalProducts', 'lowStockItems', 'outOfStockItems', 'pendingReceipts', 'pendingDeliveries', 'scheduledTransfers'].every(k => typeof kpi.body[k] === 'number'), kpi.body);
  check('low stock alert on threshold', (await call('PATCH', `/products/${pid}`, { reorderThreshold: 100 }, T)).body.stockStatus === 'LOW_STOCK');
  const low = await call('GET', '/dashboard/low-stock', undefined, T);
  check('low-stock list contains product', low.body.some((r: any) => r.productId === pid), low.body);
  check('list filters (stockStatus)', (await call('GET', `/products?stockStatus=LOW_STOCK&search=steel-${run}`, undefined, T)).body.length === 1);
  check('validation error 400', (await call('POST', '/receipts', { supplier: '' }, T)).status === 400);

  console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
