## Why

The national tool distributor in Algeria operates multiple independent warehouses and requires a centralized, reliable source of truth for inventory, sales, warehouse-to-warehouse transfers, HR/salaries, operating expenses, and financial reporting. Without a unified system, managing multi-warehouse stock consistency, pricing, transfer approvals, and financial consolidation leads to stock discrepancies, lost traceability, and operational friction.

## What Changes

- Introduce centralized multi-warehouse data model with strict warehouse-level isolation and server-side authorization.
- Implement transactional inventory tracking with physical, reserved, and available stock quantities, pessimistic row locking (`SELECT FOR UPDATE`), and negative stock prevention constraints (`CHECK (physical_quantity >= 0)`).
- Implement stock movement logging for `INITIAL_STOCK`, `SALE`, `TRANSFER_IN`, `TRANSFER_OUT`, and `ADJUSTMENT`.
- Establish editable sales workflow with item price snapshots, invoice generation, live stock availability validation, delta-based quantity reconciliation, and non-destructive sale voiding/cancellation with compensating stock reversals.
- Establish an inter-warehouse transfer workflow supporting partial approval, source stock reservation, destination confirmation, and requester cancellation.
- Implement product catalog management with dual pricing (purchase price and sale price) accessible and editable by both Managers and Accountants.
- Implement warehouse HR (employees, fixed monthly salaries, two holiday bonuses) and categorized operational expenses.
- Implement global and warehouse-level reporting (current purchase price stock valuation, sales, profit & loss) and a comprehensive audit trail.
- Implement a premium, monochromatic enterprise UI design system (deep charcoal `#171717`, light gray `#f3f3f3`, pure white `#ffffff`) with variable typography, skeleton loading states, refined micro-interactions, and accessible controls.

## Capabilities

### New Capabilities
- `auth-access-control`: User authentication (JWT), role-based permissions (`ADMIN`, `MANAGER`, `SUPER_MANAGER`, `ACCOUNTANT`), and warehouse data isolation.
- `warehouse-management`: Multi-warehouse registry, warehouse metadata, and cross-warehouse visibility rules.
- `product-management`: Product catalog management (reference, name, brand, purchase/sale pricing, unit) with price modification capabilities for Managers and Accountants.
- `inventory-management`: Multi-warehouse stock tracking (`physical`, `reserved`, `available`), pessimistic locking, negative stock prevention, mandatory-reason manual adjustments, and stock movement auditing (`INITIAL_STOCK`, `SALE`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`).
- `sales-management`: Order entry, stock availability checks, snapshot unit pricing, invoice generation, delta inventory reconciliation on edit, and void/cancellation with stock reversal.
- `transfers-management`: Multi-step warehouse transfer lifecycle (`REQUESTED`, `APPROVED`, `CONFIRMED`, `DECLINED`, `CANCELLED`), partial approval, stock reservation on approval, destination confirmation, and cancellation rules.
- `expense-management`: Warehouse-specific operational expense logging and categorisation.
- `employee-salary-management`: Warehouse employee management, fixed monthly salaries, and holiday bonuses.
- `reporting-audit-logging`: Consolidated and warehouse dashboards, dynamic stock valuation using current purchase prices, sales and financial reports, and structured audit logs.
- `ui-design-system`: Monochromatic enterprise design system with defined color tokens, InterVariable typography stack, spacing/layout tokens, refined border-radii, multi-layer elevation shadows, skeleton loading patterns, and accessibility standards.

### Modified Capabilities
<!-- No existing capabilities being modified -->

## Impact

- **Backend (Spring Boot)**: New REST APIs, Spring Security JWT filters, JPA repositories, transactional service layer, row-level locking queries, and Flyway/Liquibase database migrations.
- **Database (PostgreSQL)**: New schema covering users, roles, warehouses, products, stock, stock movements, sales, sale items, transfers, transfer items, employees, salary records, expenses, and audit logs with check constraints.
- **Frontend (Vue 3 + TypeScript)**: Full web UI with Vite, Pinia stores, Vue Router with role guards, layouts (Auth vs. Dashboard), forms, data tables, invoice preview/print, responsive dashboard widgets, and custom CSS design system implementing the monochromatic palette.
- **Operations & Infrastructure**: Docker and Docker Compose setup for local development and server deployment.
