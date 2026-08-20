## Context

In an enterprise tool distribution system, operational activity accumulates massive datasets over years of continuous invoicing, stock adjustments, inter-warehouse transfers, and system audits. Within 5 years, the `sales`, `stock_movements`, `transfers`, and `audit_logs` tables are expected to reach 500,000+ rows each.

Currently, several backend endpoints (`GET /api/sales`, `GET /api/transfers`, `GET /api/inventory/movements`, `GET /api/admin/audit-logs`) execute unbounded queries or arbitrary hardcoded `LIMIT` clauses (e.g., `LIMIT 150` or `LIMIT 200`) without date filtering or pagination parameters. In addition, sales and transfer endpoints perform N+1 queries in loops to fetch item details for every single row. On the frontend, record lists lack the period navigator filters already present on the Dashboard and Financial Reports views.

To ensure instant responsiveness, zero memory leaks, sub-10ms queries, and seamless historical browsing across 5+ years of records, we are implementing database B-tree indexing, batch item queries, server-side pagination, and the `AppPeriodNavigator` across all core records views.

## Goals / Non-Goals

**Goals:**
- **Database Scalability**: Add composite B-tree indexes on `(created_at, warehouse_id)`, `(sale_date, warehouse_id)`, and foreign keys (`sale_id`, `transfer_id`) to ensure sub-10ms query execution across 500,000+ rows.
- **Server-Side Pagination**: Support `page`, `limit`, `startDate`, `endDate`, `search`, and `warehouseId` query parameters across sales, stock movements, transfers, and audit logs.
- **N+1 Query Elimination**: Batch load child line items in a single SQL query (`WHERE sale_id IN (...)` and `WHERE transfer_id IN (...)`) for paginated rows.
- **Universal Period Navigation**: Integrate the existing `AppPeriodNavigator` into `SalesListView.vue`, `StockMovementsView.vue`, `TransferListView.vue`, and `AuditLogsView.vue`.
- **Reusable Pagination Component**: Build `AppPagination.vue` in the design system to provide clean, responsive page stepping, page size selection, and record count badges.

**Non-Goals:**
- Partitioning or cold-storage archiving tables to external databases (SQLite with B-tree indexes easily handles millions of rows when properly indexed and paginated).
- Modifying stock calculation transaction logic or pricing rules.

## Decisions

### 1. Paginated Query Architecture with B-Tree Indexing
- **Choice**: Implement parameterized `LIMIT :limit OFFSET :offset` combined with `COUNT(*)` windowing filtered by indexed date range (`startDate <= created_at/sale_date <= endDate`) and warehouse scope.
- **Index Definitions**:
  - `idx_sales_date_wh`: `CREATE INDEX IF NOT EXISTS idx_sales_date_wh ON sales(sale_date, warehouse_id);`
  - `idx_sales_created_wh`: `CREATE INDEX IF NOT EXISTS idx_sales_created_wh ON sales(created_at, warehouse_id);`
  - `idx_sale_items_sale`: `CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);`
  - `idx_movements_date_wh`: `CREATE INDEX IF NOT EXISTS idx_movements_date_wh ON stock_movements(created_at, warehouse_id);`
  - `idx_transfers_date`: `CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(created_at, source_warehouse_id, destination_warehouse_id);`
  - `idx_transfer_items_transfer`: `CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);`
  - `idx_audit_date_wh`: `CREATE INDEX IF NOT EXISTS idx_audit_date_wh ON audit_logs(created_at, warehouse_id);`
- **Alternatives Considered**:
  - *Cursor-based pagination*: While cursor pagination is great for infinite feeds, users in ERP systems need jump-to-page navigation and total record counts per selected fiscal period (e.g. "Page 3 of 12 for March 2025"). Date-bounded offset pagination on indexed columns provides both features with sub-millisecond execution.

### 2. Batch Item Querying for Sales and Transfers
- **Choice**: Instead of executing `db.prepare(...).all(id)` inside a `.map()` loop for each parent record (N+1 queries), collect all parent IDs from the paginated slice and run one query:
  `SELECT * FROM sale_items WHERE sale_id IN (?, ?, ...)`
  and group items by parent ID in memory.
- **Alternatives Considered**:
  - *Single Large SQL JOIN with row deduplication*: Generates duplicated parent row data across network/memory when sales have multiple items. Batch query is cleaner and faster.

### 3. Paginated API Response Format
- **Choice**: Standardize the response structure:
  ```json
  {
    "success": true,
    "data": {
      "items": [ ... ],
      "pagination": {
        "page": 1,
        "limit": 25,
        "total": 142,
        "totalPages": 6
      }
    }
  }
  ```
  If `page` parameter is omitted, default to `page=1, limit=50` or support seamless fallback.

### 4. UI Architecture with `AppPeriodNavigator` and `AppPagination`
- **Choice**: 
  - Standardize all 4 record view templates:
    1. Page Header (Title + Actions)
    2. `AppPeriodNavigator` (Granularities: Day, Week, Month, Quarter, Year, Today shortcut)
    3. Filter Bar (Search input, Type/Status filter, Page count indicator)
    4. `AppTable` (Records table with loading skeleton & empty state)
    5. `AppPagination` (Page size dropdown: 25, 50, 100, Steppers ◀ ▶, Page numbers)
  - Whenever period changes or search filter changes, the active `page` resets to 1 and the view fetches the fresh dataset.

## Risks / Trade-offs

- **[Risk] High count computation on unfiltered tables** → **Mitigation**: All queries filter by default within the active period from `AppPeriodNavigator` (e.g., current month) which limits row scanning to indexed ranges.
- **[Risk] Search term filtering on non-indexed text fields** → **Mitigation**: Search queries are combined with the indexed period filter and warehouse scope, drastically narrowing the SQLite candidate set before applying text matches.
- **[Risk] Existing frontend callers expecting raw arrays instead of `{ items, pagination }`** → **Mitigation**: Update frontend service helpers (`operations.service.ts`, `admin-reports.service.ts`) to return typed paginated responses or handle both structures gracefully.

## Migration Plan

1. Update `backend/src/db/schema.ts` to create the B-tree indexes during database initialization.
2. Update backend route handlers in `sale.routes.ts`, `inventory.routes.ts`, `transfer.routes.ts`, and `audit.routes.ts` with pagination and date filter logic.
3. Add `AppPagination.vue` component to `frontend/src/components/common/`.
4. Update frontend service layer (`operations.service.ts`, `admin-reports.service.ts`) and TypeScript types (`types/index.ts`).
5. Update `SalesListView.vue`, `StockMovementsView.vue`, `TransferListView.vue`, and `AuditLogsView.vue` with `AppPeriodNavigator` and `AppPagination`.
6. Run comprehensive verification tests with both date range filters and multi-page navigation.
