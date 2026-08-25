## 1. Database Indexing & Concurrency Optimization

- [x] 1.1 Add performance composite indexes (`idx_stock_product_id`, `idx_products_search`) to `backend/src/db/schema.ts`
- [x] 1.2 Validate index creation and non-blocking query execution in PostgreSQL

## 2. Backend Paginated Stock API & Status Filtering

- [x] 2.1 Update `GET /inventory/stock` in `backend/src/routes/inventory.routes.ts` to accept `page`, `limit`, `status`, `search`, and `warehouseId`
- [x] 2.2 Implement single-pass status counts aggregation (`total`, `normal`, `low`, `out`) using `COUNT(*) FILTER (...)`
- [x] 2.3 Implement dynamic parameterized SQL query builder with limit/offset pagination and search filters
- [x] 2.4 Update `GET /inventory/export/csv` to support status filtering (`normal`, `low`, `out`) alongside search query

## 3. Frontend Types & Service Layer

- [x] 3.1 Define `StockStatusCounts` interface and extend `PaginatedData<Stock>` in `frontend/src/types/index.ts`
- [x] 3.2 Update `inventoryService.getStock` in `frontend/src/services/operations.service.ts` to accept pagination and status parameters and normalize responses

## 4. StockView UI Enhancement

- [x] 4.1 Implement interactive status filter pill tabs (`Tous`, `En stock`, `Stock faible`, `En rupture`) with live count badges in `StockView.vue`
- [x] 4.2 Integrate `AppPagination` component with page size options (25, 50, 100) and page state tracking
- [x] 4.3 Implement debounced server-side search input (300ms) with automatic page reset

## 5. Smart Loading & Modal Decoupling

- [x] 5.1 Remove blocking eager `productStore.fetchProducts()` call from `StockView.vue` `onMounted`
- [x] 5.2 Defer product catalog loading to receipt modal opening or on-demand interaction

## 6. Verification & Validation

- [x] 6.1 Verify pagination and status filtering across all tabs (`Tous`, `En stock`, `Stock faible`, `En rupture`)
- [x] 6.2 Verify server-side search performance and responsive state transitions
- [x] 6.3 Verify manual stock adjustment and stock receipt workflows refresh the current page and live counts correctly
