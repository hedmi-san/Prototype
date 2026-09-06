## 1. Database Schema & Data Models

- [x] 1.1 Add `tva NUMERIC(5, 2) NOT NULL DEFAULT 19.00` migration and column definition in `backend/src/db/schema.ts`
- [x] 1.2 Update backend and frontend TypeScript `Product` types to include `tva?: number`
- [x] 1.3 Update product retrieval, creation, and update handlers in `backend/src/routes/product.routes.ts` to accept and return `tva`

## 2. Backend Bulk Import API Engine

- [x] 2.1 Increase Express JSON body limit to `10mb` in `backend/src/server.ts` to accommodate 1,000-item chunks
- [x] 2.2 Implement `POST /api/products/import-batch` in `backend/src/routes/product.routes.ts` with role authentication (`ADMIN`, `MANAGER`) and warehouse scoping
- [x] 2.3 Implement single-transaction set-based bulk upsert in PostgreSQL: insert new products with `ON CONFLICT (reference) DO NOTHING`, preserve existing master product info, and upsert warehouse `stock` records
- [x] 2.4 Add bulk audit movement creation in `stock_movements` with `movement_type = 'INITIAL_STOCK'` for imported stock

## 3. Frontend Excel Processing & Service Layer

- [x] 3.1 Install `xlsx` (SheetJS) package in `frontend`
- [x] 3.2 Implement client-side Excel parsing and data sanitization utility in `frontend/src/services/excelImport.service.ts` to handle column mapping, comma decimals, and zero-stock clamping for corrupted data
- [x] 3.3 Add `importBatch` API call in frontend catalog/inventory service with chunking support

## 4. UI Components & Workflow Integration

- [x] 4.1 Create `ProductImportModal.vue` with drag-and-drop `.xlsx` upload, warehouse selector, pre-flight data preview, anomaly diagnostics, and animated progress bar
- [x] 4.2 Add "Importer Excel" button to `ProductListView.vue` header toolbar
- [x] 4.3 Add "Importer Excel" button to `StockView.vue` header toolbar
- [x] 4.4 Connect modal completion to automated table refreshes and notification alerts

## 5. Verification & Testing

- [x] 5.1 Verify that `STOCK.xlsx` (including Row 103 corrupted stock string `'TOURNEVIS'`) is safely sanitized and previewed with appropriate warnings
- [x] 5.2 Validate that importing stock into a warehouse correctly updates physical stock and creates `INITIAL_STOCK` movements
- [x] 5.3 Validate that re-importing an existing product reference updates only warehouse stock without altering master product designation or pricing
