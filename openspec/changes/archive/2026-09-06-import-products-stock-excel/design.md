## Context

The system is transitioning from standalone, isolated desktop installations at each warehouse to a unified web platform. Each warehouse previously maintained its own independent catalog and inventory in an old desktop software that exports `.xlsx` spreadsheets (`STOCK.xlsx`). 

Directly uploading 7,000 products row-by-row would result in 35,000+ database roundtrips, causing HTTP request timeouts. Furthermore, the legacy exports contain unstandardized names with typographical variations across warehouses, as well as data corruption in numeric fields (such as text strings like `"TOURNEVIS"` inside stock columns). 

## Goals / Non-Goals

**Goals:**
- Provide an intuitive, guided import interface accessible from both Product Catalog and Stock Inventory pages.
- Parse and validate 7,000+ rows client-side in under 300ms, displaying instant validation metrics and warning diagnostics before execution.
- Prevent duplicate products and protect master catalog data by treating `Code` (`reference`) as the sole canonical identifier and leaving existing product catalog attributes unchanged.
- Deliver sub-2-second database processing for 7,000 items via 1,000-item chunked requests and set-based PostgreSQL bulk upserts (`INSERT ... ON CONFLICT`).
- Safely sanitize corrupt data (clamp non-numeric or negative stock to `0`).
- Add and persist `tva` (default 19.00%) on the `products` table and domain models.
- Create traceable `INITIAL_STOCK` audit records in `stock_movements`.

**Non-Goals:**
- Two-way synchronization back to the deprecated desktop application.
- Automated fuzzy merging of conflicting product names (existing canonical names are preserved).
- Custom column mapping configuration (the legacy app export format has fixed, known headers).

## Decisions

### 1. Browser-Side Parsing (SheetJS `xlsx`) vs Server Multipart File Upload
- **Decision**: Parse `.xlsx` in the browser using the `xlsx` library and transmit sanitized JSON batches of 1,000 items.
- **Rationale**: 
  - Allows instant pre-flight validation and summary preview before any data touches the server.
  - The browser easily parses a 7,000-row `.xlsx` in ~200ms without server disk I/O or multipart temporary files.
  - Enables a smooth, real-time chunked progress bar (`Lot 3/7... 43%`).
- **Alternatives Considered**: Server-side upload via `multer` and `exceljs`. Rejected because it creates a monolithic blocking HTTP request prone to timeouts with no pre-flight UI preview.

### 2. Catalog Immutability & Conflict Resolution
- **Decision**: When `Code` already exists in `products`, do NOT overwrite `name`, `purchase_price`, `sale_price`, `tva`, or `box_size`. Only insert or update the target warehouse's `stock` record. When `Code` is new, insert the product and create the warehouse stock.
- **Rationale**: Different warehouses misspell names and have inconsistent legacy descriptions. Preserving the existing canonical catalog entry prevents remote warehouses from corrupting master catalog data.
- **Alternatives Considered**: Always overwriting with the incoming file. Rejected because typos would constantly degrade the master catalog.

### 3. High-Performance Bulk Upserts with PostgreSQL Set Operations
- **Decision**: Implement `POST /api/products/import-batch` using single-transaction bulk SQL operations for each 1,000-item chunk.
  1. `INSERT INTO products (...) VALUES (...), (...) ON CONFLICT (reference) DO NOTHING` to insert all new products in one query.
  2. Resolve all product IDs for the batch's references in one `SELECT id, reference FROM products WHERE reference = ANY(...)` query.
  3. Bulk upsert inventory: `INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES ... ON CONFLICT (warehouse_id, product_id) DO UPDATE SET physical_quantity = EXCLUDED.physical_quantity, updated_at = NOW()`.
  4. Bulk insert audit log: `INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes) VALUES ...`.
- **Rationale**: Reduces 5,000 sequential queries per 1,000 rows to 4 set-based queries executing in < 150ms.

### 4. Resilient Sanitization Pipeline
- **Decision**: Sanitize all incoming fields both client-side (for user preview) and server-side (for database safety):
  - `reference`: `String(val).trim().toUpperCase()`
  - `stock`: Parse float, fallback to `0` if `NaN`, text, or `< 0`.
  - `purchase_price` & `sale_price`: Replace commas with dots, parse float, clamp $\ge 0$.
  - `tva`: Parse float, default to `19.00` if missing or invalid.
  - `box_size` & `min_stock_alert`: Parse integer, clamp $\ge 0$.

### 5. TVA Schema Addition
- **Decision**: Add `tva NUMERIC(5, 2) NOT NULL DEFAULT 19.00` to the `products` table and add `tva?: number` to frontend and backend models.
- **Rationale**: Algeria's standard TVA rate is 19%, which the legacy application tracked per product. Storing it enables proper VAT invoicing and accounting.

## Risks / Trade-offs

- **[Risk]** Browser memory pressure when parsing large spreadsheets.
  - **Mitigation**: A 7,000-row `.xlsx` file is ~1.5MB to 3MB decompressed. In-memory parsing consumes < 20MB of heap, well within browser safety limits.
- **[Risk]** Partial failure if connection drops mid-import (e.g. batch 4 of 7 fails).
  - **Mitigation**: Every 1,000-item batch runs in its own atomic transaction. Because product inserts use `ON CONFLICT DO NOTHING` and stock upserts are idempotent, re-running the import safely resumes without duplicates or corruption.
- **[Risk]** Express JSON payload size limit blocking 1,000-item chunks.
  - **Mitigation**: Configure `express.json({ limit: '10mb' })` in `server.ts` (1,000 items is ~250KB).
