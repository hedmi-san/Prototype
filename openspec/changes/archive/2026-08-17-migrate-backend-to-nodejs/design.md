## Context

The initial backend implementation was constructed using Spring Boot 3 (Java 21), Maven, and PostgreSQL. While robust, running it locally requires Java 21 SDK configurations, Maven binary setups, and external PostgreSQL database containers, creating friction and operational overhead.

By replacing the backend with a Node.js + TypeScript REST architecture using SQLite with Write-Ahead Logging (`WAL`) mode, the full system runs natively via `npm install && npm run dev` with zero Docker or Java runtime prerequisites.

## Goals / Non-Goals

**Goals:**
- Provide a lightweight, zero-configuration Node.js + TypeScript backend in `backend/`.
- Use SQLite (via `better-sqlite3` or `sqlite3` + typed query helpers) with `PRAGMA journal_mode = WAL;` and atomic transactions (`db.transaction(...)`) for immediate write locking.
- Preserve 100% API contract parity with the Vue 3 frontend across all modules (`auth`, `warehouses`, `products`, `inventory`, `sales`, `transfers`, `expenses`, `employees`, `salaries`, `reports`, `audit-logs`).
- Seed realistic demo data (roles, warehouses, products, initial stock receipts, demo users) on first boot.
- Configure root npm scripts to run frontend and backend simultaneously or independently.

**Non-Goals:**
- Rewriting or modifying the frontend UI components (the monochromatic Vue 3 application remains completely untouched).
- Changing business logic invariants (strict non-negative stock, transfer reservation stages, sales delta reconciliation remain strictly enforced).

## Decisions

### 1. Framework: Express + TypeScript
- *Rationale*: Express is the standard, battle-tested minimal HTTP framework in the Node.js ecosystem. Paired with TypeScript and `tsx` / `ts-node-dev`, it provides instant startup (<500ms), fast hot-reloading, and strong typing.
- *Alternatives considered*: Fastify (great, but Express is more universal and simpler to inspect), NestJS (heavy OOP boilerplate similar to Spring Boot, which defeats the user's goal of simplicity).

### 2. Database: SQLite with WAL & Atomic Transactions
- *Rationale*: SQLite stores the database in a local `.db` file (e.g. `backend/data/distributor.db`), requiring 0 background daemons. With `WAL` mode and `db.transaction(() => { ... })`, write operations are strictly serialized with ACID guarantees, mimicking PostgreSQL pessimistic locking.
- *Alternatives considered*: PostgreSQL (requires Docker or local service), In-memory mock (loses persistence on restart).

### 3. Password Hashing & JWT Authentication
- *Rationale*: Use `bcryptjs` and `jsonwebtoken` matching the Spring Boot security claims (`userId`, `username`, `role`, `warehouseId`, `warehouseName`).
- *Token Expiration*: 24 hours.

### 4. Database Migrations & Schema Bootstrap
- *Rationale*: Synchronous initialization script on server startup (`schema.sql`) creating all tables and seeding default records if tables are empty.

## Risks / Trade-offs

- [High concurrency multi-node write scale] → SQLite supports one writer at a time with instant WAL queuing. For local development and departmental multi-warehouse operations, this easily supports hundreds of requests per second without locks contention.
- [Data types & decimals in SQLite] → SQLite numbers are stored as REAL or INTEGER. Financial totals and prices will use standard 2-decimal rounding (`Math.round(val * 100) / 100` or numeric strings) to prevent floating-point inaccuracies.
