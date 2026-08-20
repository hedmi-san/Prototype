## Why

As the enterprise distribution database accumulates high transaction volumes over multi-year operations (hundreds of thousands to millions of rows across sales, stock movements, transfers, and audit logs), current unbounded `SELECT *` in-memory loading, N+1 query patterns, and hardcoded `LIMIT` clauses create severe memory pressure, slow query times, and potential node process crashes. 

Furthermore, historical record discovery is constrained: users cannot easily browse back to past periods or navigate large historical record archives across Sales, Stock Movements, Transfers, and Audit Logs. 

Introducing database indexing, server-side pagination with smart pagination controls, and seamless date-period filtering via `AppPeriodNavigator` ensures sub-millisecond query performance, bounded memory footprint, and effortless historical navigation even at 5+ year scale.

## What Changes

- **Database Performance & Indexing**:
  - Add composite B-tree indexes across `sales`, `sale_items`, `stock_movements`, `transfers`, `transfer_items`, and `audit_logs` targeting date ranges (`sale_date`, `created_at`) and warehouse IDs.
  - Optimize SQL queries to use indexed `COUNT(*)` windowing / paginated queries (`LIMIT ? OFFSET ?`) and eliminate N+1 queries by batch-fetching line items only for the paginated slice of sales and transfers.

- **Server-Side Pagination & Range Filtering APIs**:
  - Update `GET /api/sales`, `GET /api/inventory/movements`, `GET /api/transfers`, and `GET /api/admin/audit-logs` endpoints to accept optional query parameters: `page`, `limit` (defaulting to 25 or 50), `startDate`, `endDate`, `search`, and `warehouseId`.
  - Standardize paginated API response payload structure with metadata: `{ items: T[], pagination: { page, limit, total, totalPages } }`. Maintain backwards-compatibility for existing consumers where applicable.

- **Reusable Pagination UI Component**:
  - Create `AppPagination.vue` component within the design system featuring page size selection (25, 50, 100), current range indicators ("1-25 of 1,420"), and page stepper buttons with accessible keyboard/click controls.

- **Historical Navigation Across Records Views**:
  - Integrate `AppPeriodNavigator` into `SalesListView.vue`, `StockMovementsView.vue`, `TransferListView.vue`, and `AuditLogsView.vue` alongside search bars and warehouse filters.
  - Synchronize period changes (`Jour`, `Semaine`, `Mois`, `Trimestre`, `Année`, custom date ranges) and page changes with backend API calls to fetch only the requested page of data within the selected time period.

## Capabilities

### New Capabilities
- None (all new functionality extends existing domain modules and UI design system).

### Modified Capabilities
- `sales-management`: Support server-side paginated queries, date-range filtering with `AppPeriodNavigator`, and optimized item retrieval on the sales list.
- `inventory-management`: Support server-side paginated queries and date-range filtering with `AppPeriodNavigator` on the stock movement ledger.
- `transfers-management`: Support server-side paginated queries and date-range filtering with `AppPeriodNavigator` on the transfer records list.
- `reporting-audit-logging`: Support server-side paginated queries and date-range filtering with `AppPeriodNavigator` on the audit log ledger.
- `ui-design-system`: Add reusable `AppPagination.vue` component with standard pagination controls and data count indicators.

## Impact

- **Backend**:
  - Schema migrations in `backend/src/db/schema.ts` for database indexes.
  - Route handlers in `backend/src/routes/sale.routes.ts`, `backend/src/routes/inventory.routes.ts`, `backend/src/routes/transfer.routes.ts`, and `backend/src/routes/audit.routes.ts`.
- **Frontend**:
  - New component `frontend/src/components/common/AppPagination.vue`.
  - Views: `SalesListView.vue`, `StockMovementsView.vue`, `TransferListView.vue`, `AuditLogsView.vue`.
  - Services: `operations.service.ts` and `admin-reports.service.ts` updated with pagination and date filter query parameters.
  - Types in `frontend/src/types/index.ts` updated to declare `PaginatedResponse<T>` and pagination metadata.
