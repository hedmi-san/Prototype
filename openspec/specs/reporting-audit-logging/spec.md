# reporting-audit-logging Specification

## Purpose
TBD - created by archiving change multi-warehouse-tool-distribution-system. Update Purpose after archive.
## Requirements
### Requirement: Role-Based Dashboard Metrics
The system SHALL provide customized dashboards displaying operational KPIs for Admins across all warehouses, and for Managers and Accountants filtered to their assigned warehouse, synchronized with the reusable ERP period navigator component.

#### Scenario: Admin views global dashboard
- **WHEN** an Admin accesses the dashboard
- **THEN** the system SHALL display consolidated KPIs including total stock value, today's sales, monthly sales, low/out-of-stock counts, total operating expenses, total salaries, and warehouse performance comparisons

#### Scenario: Manager views warehouse dashboard
- **WHEN** a Manager accesses the dashboard
- **THEN** the system SHALL display KPIs scoped exclusively to their warehouse (today's sales, monthly sales, warehouse stock valuation, and local expenses)

#### Scenario: Dashboard refreshes on period change
- **WHEN** the user shifts the period navigator to a new date range (e.g. "T2 2025")
- **THEN** the dashboard SHALL automatically fetch and display sales, expenses, net profits, and performance comparisons computed for that exact time boundary

### Requirement: Stock Valuation using Current Purchase Prices
The system SHALL calculate the monetary valuation of inventory using the product's current purchase price multiplied by its current physical stock quantity.

#### Scenario: Calculate warehouse stock valuation
- **WHEN** a stock report is generated for a warehouse having 20 units of Product A (purchase price 5,000 DZD) and 10 units of Product B (purchase price 2,000 DZD)
- **THEN** the system SHALL calculate the total stock valuation as (20 * 5,000) + (10 * 2,000) = 120,000 DZD

### Requirement: Immutable Audit Trail Logging
The system SHALL automatically capture and persist structured audit logs for critical operations (sale creation/edit/void, stock adjustments, price changes, transfer actions, expenses, HR modifications) capturing actor, action, timestamp, warehouse, and before/after values.

#### Scenario: Audit entry generated on sale edit
- **WHEN** an Accountant modifies the quantity of an item in an existing sale
- **THEN** the system SHALL create an audit log entry recording the user ID, action `SALE_EDITED`, the sale ID, warehouse ID, previous line item quantity in `old_values`, and updated quantity in `new_values`

### Requirement: Server-Side Paginated Audit Logs with Period Navigation
The system SHALL provide server-side pagination, search filtering, and historical period filtering for the audit logs endpoint (`GET /api/admin/audit-logs`), replacing unbounded and hardcoded limit queries with `page`, `limit`, `startDate`, `endDate`, `search`, and `warehouseId` query parameters.

#### Scenario: Query audit logs with pagination and search
- **WHEN** an Admin requests page 1 of audit logs with `limit=50`, `search="SALE"`, and `startDate="2025-01-01"`
- **THEN** the system SHALL return matching audit events up to the limit, total count, and total pages

#### Scenario: Audit logs view renders period navigator and pagination controls
- **WHEN** an Admin opens the audit logs view (`/audit-logs`)
- **THEN** the interface SHALL render `AppPeriodNavigator` and `AppPagination`, enabling inspection of past audit events across specific days, weeks, months, or years without performance degradation

### Requirement: High-Performance Database Indexing for Audit Logs
The system SHALL maintain composite database indexes on `audit_logs(created_at, warehouse_id)` and `audit_logs(action, created_at)` to support rapid audit timeline inspection across large datasets.

#### Scenario: Sub-millisecond audit trail queries
- **WHEN** an administrator views historical audit logs on a database with 500,000+ entries
- **THEN** the query SHALL execute against the `created_at` index and return in under 10 milliseconds

### Requirement: Printable Inventory and Valuation Statement
The system SHALL provide high-fidelity printable layouts for the Stock Valuation report (`StockValuationView.vue`), including an official company and warehouse header, generation timestamp, valuation metric summary, and full tabular breakdown optimized for landscape A4 rendering without horizontal truncation.

#### Scenario: User prints stock valuation report
- **WHEN** the user clicks "Imprimer le Bilan" on the Stock Valuation report page
- **THEN** the system SHALL launch the browser print preview displaying the full stock valuation summary, company entity, warehouse scope, and complete product table on white background with navigation elements excluded

### Requirement: Printable Income and Financial Statement
The system SHALL provide high-fidelity printable layouts for the Financial P&L report (`FinancialReportsView.vue`), displaying the selected period, warehouse entity, revenue, COGS, itemized operating expenses, salaries, and net profit with clean tabular borders and page-break optimization.

#### Scenario: User prints financial statement
- **WHEN** the user clicks "Imprimer le Bilan" on the Financial Reports page
- **THEN** the system SHALL launch the browser print preview displaying the complete statement breakdown without navigation bars, period switchers, or action buttons

