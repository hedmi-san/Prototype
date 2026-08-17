## 1. Node.js Backend Scaffolding & Dependencies

- [x] 1.1 Initialize Node.js TypeScript project in `backend/` with `package.json`, `tsconfig.json`, Express, SQLite, jsonwebtoken, bcryptjs, cors, and `tsx` hot reload
- [x] 1.2 Implement core response envelope helper `ApiResponse` and unified error-handling middleware

## 2. Database Schema, WAL Mode & Seeding

- [x] 2.1 Create SQLite database initialization module with `WAL` journal mode and foreign keys enabled
- [x] 2.2 Define database schema tables (users, roles, warehouses, products, stock, movements, sales, sale_items, transfers, transfer_items, expenses, employees, salaries, audit_logs)
- [x] 2.3 Implement automatic seeding for demo roles, warehouses, users with hashed passwords, product catalog, and initial stock receipts

## 3. Authentication & Security Middleware

- [x] 3.1 Implement JWT token generation and verification middleware
- [x] 3.2 Implement role-based access control (`ADMIN`, `SUPER_MANAGER`, `MANAGER`, `ACCOUNTANT`) and warehouse scoping utilities
- [x] 3.3 Implement `POST /api/auth/login` and `GET /api/auth/me` endpoints matching frontend auth store contracts

## 4. Warehouse & Product Catalog APIs

- [x] 4.1 Implement `GET /api/warehouses`, `POST /api/warehouses`, `PUT /api/warehouses/:id`
- [x] 4.2 Implement `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`, `GET /api/products/:id`

## 5. Inventory & Concurrency Invariants

- [x] 5.1 Implement `GET /api/inventory/stock` and `GET /api/inventory/movements` with warehouse filtering
- [x] 5.2 Implement `POST /api/inventory/adjustments` with atomic stock update and audit logging
- [x] 5.3 Implement `POST /api/inventory/initial-receipt` with movement tracking

## 6. Sales, Delta Reconciliation & Invoicing

- [x] 6.1 Implement `POST /api/sales` with atomic stock deduction and insufficient stock protection
- [x] 6.2 Implement `GET /api/sales` and `GET /api/sales/:id`
- [x] 6.3 Implement `PUT /api/sales/:id` with automatic delta inventory reconciliation
- [x] 6.4 Implement `POST /api/sales/:id/cancel` with non-destructive voiding and stock reversal

## 7. Inter-Warehouse Transfers & Stock Reservations

- [x] 7.1 Implement `POST /api/transfers` (creation in `REQUESTED` status)
- [x] 7.2 Implement `POST /api/transfers/:id/approve` (reserves stock at source warehouse)
- [x] 7.3 Implement `POST /api/transfers/:id/confirm` (deducts physical/reserved at source, increments at destination)
- [x] 7.4 Implement `POST /api/transfers/:id/decline` and `POST /api/transfers/:id/cancel` (releases reserved stock)
- [x] 7.5 Implement `GET /api/transfers` and `GET /api/transfers/:id`

## 8. Expenses, Employees & Salaries

- [x] 8.1 Implement `GET /api/expenses`, `POST /api/expenses`, `PUT /api/expenses/:id`
- [x] 8.2 Implement `GET /api/employees`, `POST /api/employees`, `PUT /api/employees/:id`
- [x] 8.3 Implement `GET /api/salaries` and `POST /api/salaries`

## 9. Reports, Analytics & Audit Logs

- [x] 9.1 Implement `GET /api/reports/dashboard` calculating real-time inventory valuation, daily sales, monthly sales, gross profit, operating expenses, payroll, and net profit
- [x] 9.2 Implement `GET /api/reports/stock-valuation` with current purchase prices
- [x] 9.3 Implement `GET /api/reports/sales` and `GET /api/reports/financial`
- [x] 9.4 Implement `GET /api/audit-logs` (and `/api/admin/audit-logs`) and `GET /api/admin/users`

## 10. Root Scripts, Integration & Verification

- [x] 10.1 Configure root `package.json` with `npm run dev` to start both frontend and backend concurrently
- [x] 10.2 Verify full application in browser (login, dashboard, stock, POS checkout, transfers, reports)
