## Why

The company is migrating from an isolated, legacy desktop software where warehouses operated independently to this centralized multi-warehouse platform. To complete the transition, over 7,000 products and their warehouse inventory must be migrated from exported Excel spreadsheets (`STOCK.xlsx`). 

Manual data entry is unfeasible, warehouse staff frequently misspell product designations across locations, legacy data contains text corruption in numeric columns (e.g. text in stock fields), and importing 7,000 items sequentially would trigger database timeouts. A resilient, high-performance bulk import tool using `Code` as the strict canonical identifier is required to unify the product catalog and initialize warehouse stock without degrading system performance.

## What Changes

- **Excel Import Button & Interactive Modal**: Add an "Importer Excel" button in both the Products view (`ProductListView.vue`) and Stock view (`StockView.vue`), opening a guided import modal (`ProductImportModal.vue`) with drag-and-drop `.xlsx` file upload, warehouse selection, and instant data preview.
- **Reference-First Deduplication & Catalog Guard**: Strictly match products by `Code` (`products.reference`). If a product already exists, preserve its master catalog information (name, prices, colisage, TVA) and only update/create the warehouse's physical stock. If a product is new, create it in `products` and allocate stock to the target warehouse.
- **Data Sanitization & Clamping**: Client-side and server-side sanitation pipeline that trims and uppercases codes, converts comma decimals to dots, safely falls back corrupted text or negative quantities in numeric fields (e.g. `Stock: "TOURNEVIS"` clamped to `0`), and reports non-blocking warnings before import execution.
- **TVA Schema Extension**: Add a `tva NUMERIC(5, 2) NOT NULL DEFAULT 19.00` column to the `products` table, backend types, and catalog APIs to store value-added tax imported from legacy files.
- **High-Performance Chunked Processing**: Client-side in-memory Excel parsing (`xlsx` library) splitting large payloads into chunks of 1,000 items sent to a new bulk batch endpoint (`POST /api/products/import-batch`), using PostgreSQL set-based bulk upserts (`INSERT ... ON CONFLICT`) within single transactions to process 7,000 items in under 2 seconds.
- **Traceable Stock Movement Audit**: Bulk-insert audit records into `stock_movements` with `movement_type = 'INITIAL_STOCK'` and `reference = 'IMPORT-EXCEL'` for all imported stock.

## Capabilities

### New Capabilities
- `product-stock-excel-import`: Comprehensive Excel product and warehouse stock bulk import capability, featuring pre-flight file validation, interactive progress tracking, warehouse-scoped inventory updates, and PostgreSQL batch upserts.

### Modified Capabilities
- `product-catalog-cleanup`: Add the `tva` (value-added tax rate) field to the `products` table schema, migrations, and product response models.

## Impact

- **Database**:
  - `products`: Adds `tva NUMERIC(5, 2) NOT NULL DEFAULT 19.00` column.
  - `stock` and `stock_movements`: Receives bulk upserts and initial receipt movement logs.
- **Backend API**:
  - New route: `POST /api/products/import-batch` (or `/api/inventory/import-batch`) restricted to `ADMIN` and `MANAGER` roles.
  - Increased JSON payload body parser limit in `server.ts` to accommodate 1,000-item chunks.
- **Frontend**:
  - New dependency: `xlsx` (SheetJS) for fast browser-side `.xlsx` parsing.
  - New modal component: `ProductImportModal.vue`.
  - Updated views: `ProductListView.vue` and `StockView.vue` with trigger buttons.
  - Updated types: `Product` interface includes `tva?: number`.
