## Why

As the multi-warehouse tool distribution system scales to multi-user concurrent operations, multi-year historical auditing, and production enterprise deployments, the single-process embedded SQLite storage engine must be transitioned to a robust, scalable PostgreSQL relational database. PostgreSQL provides true multi-connection client concurrency, row-level locking (`SELECT ... FOR UPDATE`), rich ACID transaction isolation, native date/time arithmetic with timezone support, and seamless cloud deployment readiness.

## What Changes

- **PostgreSQL Client & Connection Pooling**:
  - Install `pg`, `@types/pg`, and `dotenv` in `backend/package.json`.
  - Replace `node:sqlite` DatabaseSync with an asynchronous `pg.Pool` connection manager reading configuration from environment variables (`DATABASE_URL` or `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).
  - Implement async transaction helper `runTransaction` with automatic `BEGIN`, `COMMIT`, and `ROLLBACK` handling via dedicated pool client checkouts.

- **PostgreSQL Schema Definition & Seed Script**:
  - Rewrite `schema.ts` to use PostgreSQL DDL: `SERIAL PRIMARY KEY`, `TIMESTAMPTZ DEFAULT NOW()`, `BOOLEAN`, `NUMERIC(14,2)`, foreign keys with cascading options, and composite B-tree indexes.
  - Create idempotent schema initialization and demo data seeding in `seed.ts` (roles, warehouses, demo accounts, product catalog, initial stock).

- **Asynchronous Route Handlers & Parameterized Queries**:
  - Convert all synchronous database calls across all 12 backend route modules to asynchronous `async (req, res) => { ... }` handlers utilizing async/await queries with standard `$1, $2, ...` positional parameters.
  - Update `auth.ts` middleware for asynchronous token user validation and asynchronous audit logging.
  - Implement `RETURNING *` / `RETURNING id` pattern for INSERT statements to retrieve auto-generated IDs reliably.

## Capabilities

### New Capabilities
- None (all new functionality replaces and upgrades the underlying backend database engine).

### Modified Capabilities
- `nodejs-backend-core`: Update database engine requirement from embedded SQLite with synchronous WAL to asynchronous PostgreSQL with connection pooling, parameterized queries, and ACID transaction isolation.

## Impact

- **Backend Dependencies**: `package.json` updated with `pg`, `@types/pg`, `dotenv`.
- **Database Layer**: `backend/src/db/database.ts`, `backend/src/db/schema.ts`, `backend/src/db/seed.ts`.
- **Middleware**: `backend/src/middleware/auth.ts`.
- **Route Handlers**: `auth.routes.ts`, `warehouse.routes.ts`, `product.routes.ts`, `inventory.routes.ts`, `sale.routes.ts`, `transfer.routes.ts`, `expense.routes.ts`, `employee.routes.ts`, `salary.routes.ts`, `report.routes.ts`, `audit.routes.ts`, `user.routes.ts`.
- **Environment**: Added `backend/.env.example` and `backend/.env` for PostgreSQL connection parameters.
- **Frontend**: Zero breaking changes; exact JSON REST API response payload structure is preserved.
