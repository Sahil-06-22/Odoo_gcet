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
npm run smoke          # end-to-end check against the running server
```

Seeded logins (password `password123`): `priya@stocksense.io` (Inventory Manager), `arun@stocksense.io` (Warehouse Staff).

## Conventions

- Base URL `/api`. JSON in/out. Everything except `/auth/*` and `/health` needs `Authorization: Bearer <accessToken>`.
- Errors: `{ "error": { "message": "...", "details": [...] } }` with 400 (validation) / 401 / 403 / 404 / 409 (state or stock conflict).
- Lists return plain arrays. Dates are ISO strings.
- CORS allows `http://localhost:5173` with credentials (set `CORS_ORIGIN` to change).

## Auth

| | |
|---|---|
| `POST /auth/signup` `{name,email,password,role}` | → `{user, accessToken}`; sets httpOnly refresh cookie |
| `POST /auth/login` `{email,password}` | same |
| `POST /auth/refresh` | cookie → new `accessToken` (refresh token is rotated). Call `fetch` with `credentials: 'include'` |
| `POST /auth/logout` | clears the cookie |
| `POST /auth/forgot-password` `{email}` | Always 200. **No email provider**: OTP is printed in the server console and returned as `devOtp` when `NODE_ENV != production` |
| `POST /auth/verify-otp` `{email,otp}` | optional pre-check |
| `POST /auth/reset-password` `{email,otp,newPassword}` | OTP: 6 digits, 10 min, 5 tries, single-use |

Access token lives 15 min — keep it in memory and call `/auth/refresh` on 401.
Refresh tokens rotate on every use; the previous one stays valid for 30 s so a page reload or second tab that races the cookie update doesn't log the user out.

## Resources

| Path | Notes |
|---|---|
| `GET/PATCH /users/me`, `POST /users/me/password`, `GET /users` | profile |
| `GET /products?search=&category=&stockStatus=&includeInactive=` | `Product[]` (with `totalStock`, `stockStatus`) |
| `POST /products` | `{name,sku,category,unitOfMeasure,reorderThreshold?,reorderQty?,initialStock?,locationId?}`; category is created by name |
| `GET /products/:id` | adds `stockByLocation[]` |
| `PATCH/DELETE /products/:id` | delete = deactivate |
| `GET/POST /categories` | |
| `GET /stock?warehouseId=&locationId=&category=&search=` | product × location quantities |
| `GET/POST /warehouses`, `PATCH /warehouses/:id`, `POST /warehouses/:id/locations` | new warehouse gets a `Stock1` location |
| `GET/POST /receipts`, `/deliveries`, `/transfers` | list filters: `status, warehouseId, search, dateFrom, dateTo` |
| `GET/PATCH/DELETE /<docs>/:id` | edit/delete only while open (delete: draft only) |
| `POST /<docs>/:id/confirm` | DRAFT → READY (or WAITING if source lacks stock) |
| `POST /<docs>/:id/validate` | applies stock + ledger atomically → DONE. Receipts accept `{lines:[{id,receivedQty}]}` |
| `POST /<docs>/:id/cancel` | any open doc → CANCELLED |
| `GET/POST /adjustments` | POST `{productId,locationId,countedQty,reason}` — applies immediately. `GET /adjustments/recorded/qty?productId=&locationId=` pre-fills "recorded" |
| `GET /ledger?type=&status=&productId=&warehouseCode=&search=&dateFrom=&dateTo=&limit=` | read-only, newest first |
| `GET /dashboard/kpis?warehouseId=&category=` | `DashboardKPIs` (+ `inStockProducts`) |
| `GET /dashboard/low-stock` | alert list with `suggestedOrderQty` |
| `GET /dashboard/operations` | counts by document type × status |

### Creating documents

Receipt lines use `expectedQty`; delivery/transfer lines use `quantity` (either name is accepted on any of them).

```jsonc
POST /receipts    { "supplier": "Azure Interior", "warehouseId": "…", "locationId": "… (optional)", "lines": [{ "productId": "…", "expectedQty": 50 }] }
POST /deliveries  { "contact": "Client", "deliveryAddress": "…", "sourceWarehouseId": "…", "sourceLocationId": "… (optional)", "lines": [{ "productId": "…", "quantity": 10 }] }
POST /transfers   { "sourceLocationId": "…", "destLocationId": "…", "lines": [{ "productId": "…", "quantity": 5 }] }
```

If only a warehouse is given, its first-created location is used. Delivery/transfer lines come back with `isInsufficient` while the doc is open.

## Behaviour worth knowing

- **Stock moves only on validate**, in one DB transaction with the ledger rows; failure rolls back everything. Stock can never go negative (checked in the UPDATE, safe under concurrency).
- `validate` also works straight from DRAFT (it skips the confirm step).
- **Roles**: `INVENTORY_MANAGER` creates/edits/cancels products, categories, warehouses, receipts and deliveries. `WAREHOUSE_STAFF` can view everything, run transfers, validate any document, and do adjustments.
- References are per-warehouse counters: `WH/IN/0001`, `WH/OUT/0001`, `WH/INT/0001`, `WH/ADJ/0001`.
- Ledger `quantity` is signed (+ receipt, − delivery/loss); transfers show the moved quantity and don't change `resultingQty` (company-wide total).
- Not built: Redis/BullMQ, real email delivery, pagination (lists cap at 500 rows).
