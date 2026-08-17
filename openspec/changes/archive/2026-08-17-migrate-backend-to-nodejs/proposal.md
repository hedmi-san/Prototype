## Why

The current backend architecture using Spring Boot (Java 21), Maven, and external Dockerized PostgreSQL requires complex developer tooling, heavy memory footprints, and multi-service orchestration that creates friction for local development.

Migrating the backend to a lightweight, fast **Node.js + TypeScript (Express + Better-SQLite3 / Prisma / SQLite WAL)** architecture allows running both frontend and backend seamlessly with standard `npm` commands, zero Docker setup required, instant hot reloading, and simple single-language (TypeScript) full-stack maintenance, while fully preserving all business rules, concurrency invariants, transaction safety, and API contracts expected by the Vue 3 frontend.

## What Changes

- **Backend Architecture Replacement**: Replace the Spring Boot / Maven backend with a modular Node.js / TypeScript Express REST API located in `backend/` (or unified monorepo structure).
- **Embedded Zero-Config Database**: Use SQLite (with Write-Ahead Logging `WAL` mode and immediate transactions) or modular SQLite/Postgres adapters, enabling instant local startup with 0 external dependencies.
- **Strict Concurrency & Inventory Invariants**: Implement synchronous atomic transactions / immediate write transactions (`BEGIN IMMEDIATE`) guaranteeing row-level isolation and zero negative stock under concurrent sales and adjustments.
- **Identical REST Contract & Route Mapping**: Provide 1:1 identical endpoints (`/api/auth/*`, `/api/warehouses/*`, `/api/products/*`, `/api/inventory/*`, `/api/sales/*`, `/api/transfers/*`, `/api/expenses/*`, `/api/employees/*`, `/api/salaries/*`, `/api/reports/*`, `/api/admin/*`, `/api/audit-logs/*`) with matching `{ success, message, data, timestamp }` envelope.
- **Identical JWT & RBAC Model**: Maintain role-based access control (`ADMIN`, `SUPER_MANAGER`, `MANAGER`, `ACCOUNTANT`) and regional warehouse access isolation.
- **Seeded Sample Data**: Automatic database initialization on startup with demo users (`admin`, `supermanager`, `manager_algiers`, `accountant_constantine`), regional warehouses, products, and initial stock receipts matching the frontend quick-access buttons.
- **Simplified Development Scripts**: Root-level package scripts (`npm run dev` to start both frontend and backend concurrently, or individual `npm run dev:backend` / `npm run dev:frontend`).

## Capabilities

### New Capabilities
- `nodejs-backend-core`: Lightweight Node.js/TypeScript backend runtime with Express, Better-SQLite3 WAL transactions, JWT authentication, and zero-Docker local execution.

### Modified Capabilities
<!-- No requirement changes to business logic; this preserves existing contracts -->

## Impact

- **Developer Experience**: No Docker, Java SDK, or Maven needed; runs anywhere Node.js is installed (`npm install && npm run dev`).
- **Backend Codebase**: `backend/` will contain clean, typed TypeScript modules (`auth`, `warehouses`, `products`, `inventory`, `sales`, `transfers`, `expenses`, `employees`, `salaries`, `reports`, `audit`).
- **Frontend Codebase**: Zero breaking changes to Vue 3 frontend; all Axios API routes and payloads remain 100% compatible.
