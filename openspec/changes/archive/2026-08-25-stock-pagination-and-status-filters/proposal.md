## Why

The current stock inventory view loads all stock rows in a single unpaginated API query and performs search filtering entirely on the client side. As the product catalog scales beyond 1,000 references across multiple warehouses with heavy concurrent read and write operations (sales, transfers, receipts, adjustments), this architecture leads to bloated payloads, high database join overhead, and lack of essential operational filtering for low-stock and out-of-stock items.

Introducing server-side pagination, status-based filtering (Tous, En stock, Stock faible, Rupture), instant KPI summary counts, and database indexing will ensure the application remains fast, responsive, and robust under high concurrent load.

## What Changes

- **Server-Side Stock Pagination & Filtering API**: Upgrade `GET /inventory/stock` to support `page`, `limit`, `status` (`all`, `normal`, `low`, `out`), `search`, and `warehouseId` parameters, returning paginated items alongside pagination metadata and summary status counters.
- **Stock Status Filter Pills / Tabs**: Add interactive quick-filter tabs to `StockView.vue` with live count badges for Total, En Stock (Normal), Stock Faible, and Rupture de Stock.
- **Debounced Server-Side Search**: Integrate server-side search across product name, reference, brand, and warehouse code with a 300ms debounce.
- **Standardized Pagination Component**: Integrate `AppPagination` into `StockView.vue` with configurable page sizes (25, 50, 100).
- **Smart Loading & Catalog Decoupling**: Remove eager fetching of the entire product catalog (`productStore.fetchProducts()`) on stock view mount, deferring product loading to modal interactions.
- **High-Performance Database Indexing & Concurrency Support**: Add targeted PostgreSQL indexes (`idx_stock_product_id`, `idx_products_lookup`) and optimize queries using non-locking snapshot reads for queries and pessimistic row locks for transactions.
- **Aligned CSV Export**: Ensure `GET /inventory/export/csv` respects active status filters, search queries, and warehouse scope.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `inventory-management`: Add requirements for server-side paginated stock list, status-based filtering (`normal`, `low`, `out`), aggregate status counts, and database indexing for high concurrency stock queries.
- `ui-design-system`: Add requirements for stock management status filter tabs and standardized pagination integration on the stock page.

## Impact

- **Backend**: `backend/src/routes/inventory.routes.ts`, `backend/src/db/schema.ts`.
- **Frontend**: `frontend/src/views/inventory/StockView.vue`, `frontend/src/services/operations.service.ts`, `frontend/src/types/index.ts`.
- **Database**: New indexes on `stock` and `products` tables.
- **APIs**: `GET /inventory/stock` returns paginated structure `{ items, pagination, counts }` (with backward compatibility normalization in `operations.service.ts`).
