## 1. Database Indexing & Optimizations

- [x] 1.1 Add composite B-tree indexes for `sales`, `sale_items`, `stock_movements`, `transfers`, `transfer_items`, and `audit_logs` in `backend/src/db/schema.ts`

## 2. Backend Server-Side Pagination & Query Optimizations

- [x] 2.1 Update `backend/src/routes/sale.routes.ts` to implement pagination (`page`, `limit`), date-range filtering (`startDate`, `endDate`), search, and batch line-item loading
- [x] 2.2 Update `backend/src/routes/inventory.routes.ts` to implement pagination, date-range filtering, and type/search filters on `/movements`
- [x] 2.3 Update `backend/src/routes/transfer.routes.ts` to implement pagination, date-range filtering, status/search filters, and batch line-item loading
- [x] 2.4 Update `backend/src/routes/audit.routes.ts` to implement pagination, date-range filtering, warehouse scoping, and search

## 3. Frontend Design System & Service Layer

- [x] 3.1 Update `frontend/src/types/index.ts` to define `PaginationMeta`, `PaginatedResponse<T>`, and query parameters
- [x] 3.2 Create `frontend/src/components/common/AppPagination.vue` with page size selector (25, 50, 100), record indicators, and stepper controls
- [x] 3.3 Update `frontend/src/services/operations.service.ts` and `frontend/src/services/admin-reports.service.ts` to support paginated query params and response envelopes

## 4. UI View Modernization & Period Navigation

- [x] 4.1 Update `frontend/src/views/sales/SalesListView.vue` to integrate `AppPeriodNavigator` and `AppPagination` with server-side querying
- [x] 4.2 Update `frontend/src/views/inventory/StockMovementsView.vue` to integrate `AppPeriodNavigator` and `AppPagination` with server-side querying
- [x] 4.3 Update `frontend/src/views/transfers/TransferListView.vue` to integrate `AppPeriodNavigator` and `AppPagination` with server-side querying
- [x] 4.4 Update `frontend/src/views/admin/AuditLogsView.vue` to integrate `AppPeriodNavigator` and `AppPagination` with server-side querying

## 5. Verification & Testing

- [x] 5.1 Test backend index creation and verify API responses for sales, movements, transfers, and audit logs
- [x] 5.2 Validate frontend period stepping, quick jump popovers, search filtering, and pagination across all updated views
