## Context

The Multi-Warehouse Tool Distribution Management System currently operates on Node.js using an embedded SQLite database (`node:sqlite` DatabaseSync). While lightweight and zero-configuration, SQLite's single-writer limitation and synchronous execution model prevent scalable multi-process deployments, distributed microservices, and enterprise database administration tools (e.g. replication, point-in-time recovery, connection pooling).

Migrating to PostgreSQL provides:
- True concurrent read/write transactions via Multi-Version Concurrency Control (MVCC).
- Native row-level locking (`SELECT ... FOR UPDATE`) across concurrent cashier/inventory operations.
- Asynchronous non-blocking I/O in Node.js event loop via `pg.Pool`.
- Rich data types (`TIMESTAMPTZ`, `NUMERIC(14,2)`, `BOOLEAN`, `JSONB`).
- Enterprise production readiness and Docker/cloud database integration (RDS, Cloud SQL, Supabase, self-hosted Postgres).

## Goals / Non-Goals

**Goals:**
- **PostgreSQL Data Access Layer**: Implement connection pooling (`pg.Pool`) and transactional helper `runTransaction` with automatic `BEGIN`, `COMMIT`, `ROLLBACK`, and connection release.
- **Asynchronous Route Refactoring**: Update all Express route handlers across 12 modules from synchronous `db.prepare(...).all/get/run` to asynchronous `await pool.query(...)` / `await client.query(...)` using standard `$1, $2, ...` parameter placeholders.
- **PostgreSQL Schema Definition**: Translate all table DDL to PostgreSQL (`SERIAL PRIMARY KEY`, `TIMESTAMPTZ DEFAULT NOW()`, `NUMERIC(14,2)`, `BOOLEAN`, composite B-tree indexes).
- **Auto-Generated Key Retrieval**: Use standard `INSERT ... RETURNING id, *` clauses to capture inserted record identifiers cleanly without relying on SQLite `lastInsertRowid`.
- **Zero API Contract Regressions**: Maintain 100% contract parity with the Vue 3 frontend (identical JSON envelopes, property casing, data types, and status codes).
- **Configuration via Environment**: Support `.env` variables (`DATABASE_URL` or `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).

**Non-Goals:**
- Introducing an ORM/ODM (Prisma/TypeORM/Drizzle) that alters domain architecture; preserving lightweight, explicit SQL query control.
- Modifying frontend Vue 3 components or business logic rules.

## Decisions

### 1. Database Driver: `node-postgres` (`pg`) with Connection Pooling
- **Choice**: Use the standard `pg` driver and `pg.Pool` connection pool.
- **Rationale**: `pg` is the battle-tested, high-performance PostgreSQL driver for Node.js with zero unnecessary abstractions and full TypeScript typing (`@types/pg`).
- **Connection Configuration**:
  ```typescript
  import pg from 'pg';
  import dotenv from 'dotenv';
  dotenv.config();

  export const pool = process.env.DATABASE_URL
    ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
    : new pg.Pool({
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT) || 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'root',
        database: process.env.PGDATABASE || 'distributor_db',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
  ```

### 2. Transaction Management Pattern
- **Choice**: Implement an asynchronous `runTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>` helper.
- **Pattern**:
  ```typescript
  export async function runTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  ```

### 3. Schema & Data Types Mapping
| SQLite Feature | PostgreSQL DDL |
| :--- | :--- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `datetime('now')` / `date('now')` | `TIMESTAMPTZ DEFAULT NOW()` / `CURRENT_DATE` |
| `REAL` (prices, totals) | `NUMERIC(14, 2)` (parsed to Number in queries) |
| `INTEGER` (0 / 1 boolean) | `BOOLEAN DEFAULT TRUE` |
| SQLite `?` placeholders | Positional `$1, $2, $3` parameters |
| `lastInsertRowid` | `INSERT INTO ... RETURNING id, ...` |

### 4. Numeric Column Parsing
- **Choice**: Configure `pg.types.setTypeParser` for numeric OID `1700` to return JavaScript numbers directly instead of strings, preserving arithmetic consistency across frontend and backend.
  ```typescript
  pg.types.setTypeParser(1700, (val: string) => parseFloat(val));
  ```

### 5. Asynchronous Route Handler Migration
- Every Express endpoint is updated to `async (req: AuthRequest, res) => { try { ... } catch (err) { sendError(res, err.message, 500); } }`.
- Concurrency-sensitive routes (sale checkout, stock adjustments, inter-warehouse transfer approvals and confirmations) execute inside `await runTransaction(async (client) => { ... })` acquiring row locks with `SELECT ... FOR UPDATE`.

## Risks / Trade-offs

- **[Risk] Decimal values returned as strings by default in `pg`** → **Mitigation**: Add global `pg.types.setTypeParser(1700, parseFloat)` in `database.ts` so numeric quantities and currency values maintain numeric types in JSON responses.
- **[Risk] Positional parameter indexing errors ($1 vs $2)** → **Mitigation**: Create query helpers with explicit parameter arrays and validate with end-to-end route tests.
- **[Risk] Asynchronous error handling unhandled rejections** → **Mitigation**: Wrap all route logic in try/catch blocks passing error responses cleanly through `sendError`.

## Migration Plan

1. Update `backend/package.json` with `pg`, `@types/pg`, and `dotenv`.
2. Configure `.env.example` and `database.ts` with connection pooling and numeric parser.
3. Rewrite `schema.ts` and `seed.ts` for PostgreSQL DDL and seeding.
4. Refactor `auth.ts` middleware and all 12 route files to asynchronous parameterized queries.
5. Create a SQLite-to-PostgreSQL data migration script for optional existing database export.
6. Verify database connectivity, table initialization, seed data, and execute API test suite.
