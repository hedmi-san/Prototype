## 1. Backend Warehouse Safety Checks & Management

- [x] 1.1 In `backend/src/routes/warehouse.routes.ts`, implement pre-deactivation validation in `PUT /:id` to verify no pending transfers (`REQUESTED` or `APPROVED` status) involve the warehouse as source or destination, returning HTTP 400 if any exist
- [x] 1.2 In `backend/src/routes/warehouse.routes.ts`, update audit logging to record `WAREHOUSE_DEACTIVATED` or `WAREHOUSE_REACTIVATED` when the `active` status is modified

## 2. Backend Bulk Stock Relocation & Mutation Guards

- [x] 2.1 In `backend/src/routes/transfer.routes.ts`, implement `POST /bulk-relocation` accepting multi-destination allocations with transactional row locking, batch transfer creation, and immediate/standard execution modes
- [x] 2.2 In `backend/src/routes/sale.routes.ts`, add active warehouse validation to `POST /` to reject new sale creation targeting an inactive warehouse with HTTP 400
- [x] 2.3 In `backend/src/routes/transfer.routes.ts`, add active warehouse validation to `POST /` to reject transfer creation if either source or destination warehouse is inactive
- [x] 2.4 In `backend/src/routes/expense.routes.ts` and `backend/src/routes/salary.routes.ts`, ensure expense and salary payments cannot be submitted for inactive warehouses

## 3. Frontend Store & Context State

- [x] 3.1 In `frontend/src/stores/warehouse.store.ts`, add computed properties for `activeWarehouses` (for operational forms) and `allWarehousesFormatted` (with `(Inactif)` label for reporting selectors)
- [x] 3.2 In `frontend/src/stores/auth.store.ts`, add `isCurrentWarehouseInactive` and `isReadOnly` computed states for non-admin users bound to an inactive warehouse context
- [x] 3.3 In `frontend/src/services/catalog.service.ts` / transfer service, add `bulkRelocateStock` API method

## 4. Frontend UI & Multi-Warehouse Relocation Matrix

- [x] 4.1 Implement `frontend/src/components/transfers/StockRelocationModal.vue` featuring source warehouse selection, multi-destination columns, SKU rows, quick-fill helpers ("Tout vider", "Répartir équitablement", "Vider les restes"), validation badges, and immediate execution option
- [x] 4.2 In `frontend/src/views/admin/WarehousesView.vue`, add a status toggle button with confirmation and pending transfer error feedback, plus a "Relocaliser le Stock" action button opening the relocation matrix
- [x] 4.3 In `frontend/src/views/transfers/TransfersView.vue`, add a "Relocalisation Multi-Dépôts" action button
- [x] 4.4 In `frontend/src/layouts/DashboardLayout.vue`, add a persistent alert banner informing users when their assigned warehouse is in read-only consultation mode
- [x] 4.5 In `frontend/src/views/sales/SalesView.vue` and `frontend/src/views/transfers/TransfersView.vue`, disable or hide creation action buttons when `isReadOnly` is active
- [x] 4.6 In operational creation forms (Standard transfer modal, User modal, Employee modal), use `activeWarehouses` to prevent selecting inactive sites

## 5. Verification & Testing

- [x] 5.1 Test the Multi-Warehouse Relocation Matrix by distributing stock from one warehouse to multiple destinations with immediate execution, verifying inventory counts at source and destinations
- [x] 5.2 Verify that attempting to deactivate a warehouse with pending transfers is rejected with an informative error message
- [x] 5.3 Verify that deactivating a clean warehouse succeeds and places assigned managers and accountants into read-only mode with the warning banner
- [x] 5.4 Verify that historical sales, A4 invoices, and reports remain fully accessible and printable for deactivated warehouses
- [x] 5.5 Verify that reactivating the warehouse immediately restores full operational write access
