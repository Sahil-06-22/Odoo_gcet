# StockSense — Backend

Express + TypeScript + Prisma + PostgreSQL. Response shapes match `frontend/src/types/index.ts`.

## Run it

```bash
cd backend
npm install
npm run db:up          # Postgres in Docker on localhost:5442 (see docker-compose.yml)
cp .env.example .env   # already matches the compose DB
npx prisma migrate dev # create tables
npm run db:seed        # demo data (optional)
npm run dev            # http://localhost:4000/api
npm test               # 49 integration tests (uses its own stocksense_test database)
```

Seeded logins (password `password123`): `priya@stocksense.io` (Inventory Manager), `arun@stocksense.io` (Warehouse Staff).

### Production

```bash
npm run build          # compiles src/ to dist/
npm run db:deploy      # apply migrations
NODE_ENV=production npm start
```

In production the server refuses to start with placeholder JWT secrets (use 32+ random characters), sets the refresh cookie `Secure`, and never returns the OTP in API responses. Set `CORS_ORIGIN` to your frontend's origin, and `TRUST_PROXY=1` if you're behind a reverse proxy (so rate limiting sees real client IPs).

### Email (password-reset OTP)

Set `SMTP_HOST` (plus `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) in `.env` and the OTP is emailed. With `SMTP_HOST` empty, the OTP is printed in the server console and — outside production — returned as `devOtp` so the demo works without a mail account. The server warns at startup if production has no SMTP.

## Conventions

- Base URL `/api`. JSON in/out. Everything except `/auth/*` and `/health` needs `Authorization: Bearer <accessToken>`.
- Errors: `{ "error": { "message": "...", "details": [...] } }` with 400 (validation) / 401 / 403 / 404 / 409 (state or stock conflict) / 429 (rate limited).
- Lists return plain arrays. Dates are ISO strings.
- **Pagination is optional**: add `?page=1&limit=50` to products, receipts, deliveries, transfers, adjustments or ledger; the total comes back in the `X-Total-Count` header and the body stays a plain array. Without `limit`, lists return up to 500 rows (ledger: 200).
- CORS allows `http://localhost:5173` with credentials (set `CORS_ORIGIN` to change).

## Auth

| | |
|---|---|
| `POST /auth/signup` `{name,email,password,role}` | → `{user, accessToken}`; sets httpOnly refresh cookie |
| `POST /auth/login` `{email,password}` | same |
| `POST /auth/refresh` | cookie → new `accessToken` (refresh token is rotated). Call `fetch` with `credentials: 'include'` |
| `POST /auth/logout` | clears the cookie |
| `POST /auth/forgot-password` `{email}` | Always 200 (no account enumeration). Emails the OTP; see Email above |
| `POST /auth/verify-otp` `{email,otp}` | optional pre-check |
| `POST /auth/reset-password` `{email,otp,newPassword}` | OTP: 6 digits, 10 min, 5 tries, single-use; signs out all sessions |

Access token lives 15 min — keep it in memory and call `/auth/refresh` on 401.
Refresh tokens rotate on every use; the previous one stays valid for 30 s so a page reload or second tab that races the cookie update doesn't log the user out.

**Rate limits** (per IP, 15 min window): login 10 *failed* attempts, signup 20, OTP endpoints (forgot / verify / reset) 10 combined. Exceeding returns 429.

## Resources

| Path | Notes |
|---|---|
| `GET/PATCH /users/me`, `POST /users/me/password`, `GET /users` | profile |
| `GET /products?search=&category=&stockStatus=&includeInactive=` | `Product[]` (with `totalStock`, `stockStatus`, `unitCost`) |
| `POST /products` | `{name,sku,category,unitOfMeasure,unitCost?,reorderThreshold?,reorderQty?,initialStock?,locationId?}`; category is created by name |
| `GET /products/:id` | adds `stockByLocation[]` |
| `PATCH/DELETE /products/:id` | delete = deactivate |
| `GET/POST /categories` | |
| `GET /stock?warehouseId=&locationId=&category=&search=` | product × location quantities |
| `GET/POST /warehouses`, `PATCH /warehouses/:id`, `POST /warehouses/:id/locations` | new warehouse gets a `Stock1` location |
| `GET/POST /receipts`, `/deliveries`, `/transfers` | list filters: `status, warehouseId, search, dateFrom, dateTo` |
| `GET/PATCH/DELETE /<docs>/:id` | edit/delete only while open (delete: draft only) |
| `POST /<docs>/:id/confirm` | DRAFT → READY (or WAITING if the source lacks stock) |
| `POST /<docs>/:id/validate` | applies stock + ledger atomically → DONE. Receipts accept `{lines:[{id,receivedQty}]}` |
| `POST /<docs>/:id/cancel` | any open doc → CANCELLED |
| `GET/POST /adjustments` | POST `{productId,locationId,countedQty,reason}` — applies immediately. `GET /adjustments/recorded/qty?productId=&locationId=` pre-fills "recorded" |
| `GET /ledger?type=&status=&productId=&warehouseCode=&search=&dateFrom=&dateTo=` | read-only, newest first |
| `GET /dashboard/kpis?warehouseId=&category=` | `DashboardKPIs` (+ `inStockProducts`) |
| `GET /dashboard/low-stock` | alert list with `suggestedOrderQty` |
| `GET /dashboard/operations` | counts by document type × status |
| `POST /reorder/draft-receipt` | manager only. `{warehouseId, supplier?, productIds?}` → drafts one receipt for every product at/below its reorder threshold (see below) |

### Creating documents

Receipt lines use `expectedQty`; delivery/transfer lines use `quantity` (either name is accepted on any of them).

```jsonc
POST /receipts    { "supplier": "Azure Interior", "warehouseId": "…", "locationId": "… (optional)", "lines": [{ "productId": "…", "expectedQty": 50 }] }
POST /deliveries  { "contact": "Client", "deliveryAddress": "…", "sourceWarehouseId": "…", "sourceLocationId": "… (optional)", "lines": [{ "productId": "…", "quantity": 10 }] }
POST /transfers   { "sourceLocationId": "…", "destLocationId": "…", "lines": [{ "productId": "…", "quantity": 5 }] }
```

- **Receipts** with only a warehouse go to its first-created location.
- **Deliveries** with only a warehouse pick from *any* of its locations, fullest first, writing one ledger row per location used. Give `sourceLocationId` to pin the pick to one location.
- Delivery/transfer lines come back with `isInsufficient` while the doc is open (for a warehouse-wide delivery it counts the whole warehouse).

### Reorder rules

A product with a `reorderThreshold` is **low** when its total stock is at or below it. `POST /reorder/draft-receipt` creates one DRAFT receipt containing every low product (quantity = `reorderQty`, or enough to reach 2× the threshold). Products already on an open receipt are skipped, so pressing it twice never double-orders. A person still reviews and validates the receipt. Response: `{ receipt | null, skipped: [{productId, sku, reason}] }`.

## Behaviour worth knowing

- **Stock moves only on validate**, in one DB transaction with the ledger rows; any failure rolls back everything. Stock can never go negative: the check is part of the UPDATE, and tests hammer it with parallel validations. Warehouse-wide picks re-plan if a competing order takes stock mid-pick.
- `validate` also works straight from DRAFT (it skips the confirm step).
- **Roles**: `INVENTORY_MANAGER` creates/edits/cancels products, categories, warehouses, receipts and deliveries. `WAREHOUSE_STAFF` can view everything, run transfers, validate any document, and do adjustments.
- References are per-warehouse counters: `WH/IN/0001`, `WH/OUT/0001`, `WH/INT/0001`, `WH/ADJ/0001`.
- Ledger `quantity` is signed (+ receipt, − delivery/loss); transfers show the moved quantity and don't change `resultingQty` (company-wide total).
- Not built: Redis/BullMQ. Nothing here needs a cache or job queue (email is sent inline), and it would add a service everyone has to run.

## Tests

`npm test` runs 7 files / 49 tests with vitest + supertest against a separate `stocksense_test` database that it creates and migrates by itself (your dev data is untouched). They cover auth and OTP, real email delivery to a local SMTP server, rate limiting, the full receive → transfer → deliver → adjust flow, roles, warehouse-wide picking, concurrency (double-validate, competing deliveries, parallel receipts, unique references), reorder, unit cost and pagination.
