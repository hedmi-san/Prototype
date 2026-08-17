## ADDED Requirements

### Requirement: Node.js REST API Server and Router Setup
The system SHALL provide a lightweight Express + TypeScript HTTP server listening on port 8080 (or configurable `PORT`) with CORS, JSON body parser, request logging, and unified error handling middleware.

#### Scenario: Server starts and responds to health check
- **WHEN** the server is launched with `npm run dev` in the backend directory
- **THEN** it initializes the embedded database and responds to `GET /actuator/health` or `GET /api/auth/me` with status 200 or 401.

### Requirement: Database Initialization and Atomic Transactions
The system SHALL use SQLite with Write-Ahead Logging (`WAL`) mode and immediate write transactions (`BEGIN IMMEDIATE`) to enforce strict concurrency invariants without external database daemons.

#### Scenario: Database schema and seed data setup on boot
- **WHEN** the backend boots up with an empty database file
- **THEN** it automatically creates tables for users, roles, warehouses, products, stock, movements, sales, sale_items, transfers, transfer_items, expenses, employees, salaries, and audit_logs, and seeds demo accounts and initial stock.

### Requirement: Pessimistic Concurrency and Inventory Invariants
The system SHALL enforce atomic stock reduction in write transactions preventing physical quantity from dropping below 0, and maintaining separate physical and reserved stock quantities during inter-warehouse transfers.

#### Scenario: Concurrent sale attempt with insufficient stock
- **WHEN** two simultaneous sale transactions attempt to deduct stock exceeding available quantity
- **THEN** the first transaction succeeds and the second transaction fails immediately with `400 Bad Request` and message `Insufficient stock`.

### Requirement: Authentication and Role-Based Access Control
The system SHALL provide JWT authentication issuing standard tokens upon valid login, verifying tokens on protected `/api/*` endpoints, and enforcing warehouse isolation for `MANAGER` and `ACCOUNTANT` roles.

#### Scenario: Quick demo login authentication
- **WHEN** user posts credentials for `admin`, `manager_algiers`, `super_oran`, or `accountant_constantine` to `POST /api/auth/login`
- **THEN** the system returns HTTP 200 with JWT token, user id, full name, role, and warehouse context.

### Requirement: Business Modules API Parity
The system SHALL implement all endpoints for Warehouses, Products, Stock & Adjustments, Sales & Invoices, Inter-Warehouse Transfers, Expenses, Employees & Salaries, Financial Reports, and Audit Logging with exact contract parity to the Vue 3 frontend.

#### Scenario: Dashboard metrics calculation
- **WHEN** an authenticated user calls `GET /api/reports/dashboard`
- **THEN** the system returns calculated metrics including total stock valuation (using current purchase prices), sales today, monthly sales, gross profit, expenses, salaries, and net profit.
