# StockSense — Backend

This directory will contain the Node.js + TypeScript backend (Express or NestJS modular monolith).

## Planned Stack
- **Runtime**: Node.js + TypeScript
- **Framework**: Express or NestJS (TBD)
- **Database**: PostgreSQL via Prisma ORM
- **Cache**: Redis (TanStack Query + BullMQ)
- **Auth**: JWT (short-lived access) + rotated refresh tokens (httpOnly cookie)
- **Password Hashing**: bcrypt / argon2id

## Modules (planned)
- `auth` — signup, login, OTP reset, token refresh, logout
- `users` — profile management
- `products` — products, categories, reordering rules
- `warehouses` — warehouses, locations
- `receipts` — incoming stock
- `deliveries` — outgoing delivery orders
- `transfers` — internal transfers
- `adjustments` — stock adjustments
- `ledger` — append-only stock ledger
- `dashboard` — KPI aggregation
- `alerts` — low-stock evaluation

> **Note**: Backend implementation is pending. See `.antigravity/` docs for full specs.
