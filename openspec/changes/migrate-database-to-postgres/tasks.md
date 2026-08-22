## 1. Dependencies & Configuration

- [x] 1.1 Add `pg`, `@types/pg`, and `dotenv` to `backend/package.json` and install dependencies
- [x] 1.2 Create `backend/.env.example` and `backend/.env` with PostgreSQL connection settings

## 2. Database Connection & Schema Setup

- [x] 2.1 Implement PostgreSQL connection pooling and transaction manager in `backend/src/db/database.ts`
- [x] 2.2 Define PostgreSQL DDL tables, foreign keys, and indexes in `backend/src/db/schema.ts`
- [x] 2.3 Implement asynchronous seed data generator in `backend/src/db/seed.ts`
- [x] 2.4 Update `backend/src/server.ts` to initialize PostgreSQL schema and seed data asynchronously on boot

## 3. Middleware & Core Routes Migration

- [x] 3.1 Refactor `backend/src/middleware/auth.ts` for async user authentication and async audit logging
- [x] 3.2 Refactor `backend/src/routes/auth.routes.ts` and `backend/src/routes/user.routes.ts` to async PostgreSQL queries
- [x] 3.3 Refactor `backend/src/routes/warehouse.routes.ts` and `backend/src/routes/product.routes.ts` to async PostgreSQL queries

## 4. Operational & Transactional Routes Migration

- [x] 4.1 Refactor `backend/src/routes/inventory.routes.ts` (stock & movements) to async PostgreSQL queries with transaction locking
- [x] 4.2 Refactor `backend/src/routes/sale.routes.ts` to async PostgreSQL queries with batch item insertion and transaction locking
- [x] 4.3 Refactor `backend/src/routes/transfer.routes.ts` to async PostgreSQL queries with transaction locking
- [x] 4.4 Refactor `backend/src/routes/expense.routes.ts`, `backend/src/routes/employee.routes.ts`, and `backend/src/routes/salary.routes.ts` to async PostgreSQL queries
- [x] 4.5 Refactor `backend/src/routes/report.routes.ts` and `backend/src/routes/audit.routes.ts` to async PostgreSQL queries

## 5. Verification & Testing

- [x] 5.1 Test PostgreSQL connection, schema initialization, and demo data seeding
- [x] 5.2 Validate end-to-end API endpoints (auth, sales, inventory, transfers, reports) and build status
