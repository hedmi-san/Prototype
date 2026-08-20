## Context

The system tracks sales and invoices across multiple warehouses. In the point-of-sale workflow, sales records are created in `CreateSaleView.vue` and listed/managed in `SalesListView.vue`. However, `saleDate` is currently not exposed in the backend API responses (`GET /sales`, `GET /sales/:id`), nor is there an explicit database column `sale_date` or UI inputs for specifying or modifying the sale date. As a result, the "Date de Vente" column and invoice preview render blank or invalid dates, and users cannot record transactions with specific timestamps.

## Goals / Non-Goals

**Goals:**
- Add `sale_date` column support to SQLite `sales` table with a non-destructive runtime migration for existing databases and backfill from `created_at`.
- Include `saleDate: s.sale_date || s.created_at` in all sale response endpoints (`GET /sales`, `GET /sales/:id`).
- Enable saving custom or current `saleDate` on sale creation (`POST /sales`) and sale modification (`PUT /sales/:id`).
- Add user-friendly date-time input fields in `CreateSaleView.vue` (POS form) and `SalesListView.vue` (Edit sale modal), defaulting to the current date/time.
- Ensure consistent display across the sales list table, fiscal invoice modal, dashboard recent sales, and reporting routes.

**Non-Goals:**
- Modifying stock reservation or transaction isolation logic for inventory movements.
- Changing export formats or invoice numbering sequences.

## Decisions

### 1. Database Schema & Non-destructive Migration
- **Choice**: Add `sale_date TEXT NOT NULL DEFAULT (datetime('now'))` to `schema.ts`. In runtime initialization, inspect `PRAGMA table_info(sales)` to add the `sale_date` column via `ALTER TABLE sales ADD COLUMN sale_date TEXT DEFAULT (datetime('now'))` if it does not yet exist.
- **Rationale**: Prevents data loss on running instances while ensuring new tables and seeded data have the column natively. Existing null rows are backfilled using `UPDATE sales SET sale_date = created_at WHERE sale_date IS NULL`.

### 2. Date Format and Normalization
- **Choice**: Accept ISO-8601 string or `YYYY-MM-DD HH:mm:ss` / `YYYY-MM-DDTHH:mm` string from API requests. Normalize to SQLite-compatible `YYYY-MM-DD HH:mm:ss` or ISO string before inserting/updating. If omitted, default to SQLite `datetime('now')`.
- **Rationale**: Provides maximum compatibility with HTML5 `<input type="datetime-local">` controls in Vue 3 and existing `formatDateTime` utilities.

### 3. API Contract and DTO Updates
- **Choice**:
  - `GET /sales` & `GET /sales/:id`: include `saleDate: s.sale_date || s.created_at`.
  - `POST /sales`: accept `{ warehouseId, customerName, customerPhone, saleDate, items }`.
  - `PUT /sales/:id`: accept `{ customerName, customerPhone, saleDate, items }`.
- **Rationale**: Adheres to the established camelCase response format in the frontend TypeScript models.

### 4. POS and Edit Modal UI Integration
- **Choice**: Add a `Date de Vente` form field in `CreateSaleView.vue` sidebar and `SalesListView.vue` edit dialog, pre-filled with the current date/time (or existing `saleDate`).
- **Rationale**: Gives cashiers and accountants flexibility to record transactions at the exact sale time or adjust dates during revisions.

## Risks / Trade-offs

- **[Risk] Timezone discrepancy between browser local time and server UTC**:
  → *Mitigation*: Store timestamps in consistent ISO/UTC string format and use the existing `formatDateTime` helper in frontend for local presentation.
- **[Risk] Null `sale_date` in existing databases**:
  → *Mitigation*: Use `COALESCE(s.sale_date, s.created_at) as sale_date` in SQL queries and automatic migration update.
