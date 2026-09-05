## Context

In the current system, the `products` table defines `min_stock_alert INTEGER NOT NULL DEFAULT 5`. The backend product creation endpoint (`POST /api/products`) defaults `min_stock_alert` to 5 when omitted. Furthermore, the frontend product management interface (`ProductListView.vue`) does not expose a field for `minStockAlert` in the product modal; thus, users cannot set or modify the threshold during product creation or editing.

Users require `min_stock_alert` to default to `1` in the database, while having the ability to manually inspect and modify this threshold (for example, setting it to 5 or higher for high-turnover products) directly from the user interface.

## Goals / Non-Goals

**Goals:**
- Update database schema default for `products.min_stock_alert` to `1`.
- Provide a database migration / alter statement (`ALTER TABLE products ALTER COLUMN min_stock_alert SET DEFAULT 1`) so existing databases receive the new default without breaking.
- Update `POST /api/products` to default `minStockAlert` to `1` and validate incoming values as non-negative integers ($\ge 0$).
- Ensure `PUT /api/products/:id` persists changes to `minStockAlert`.
- Expose "Seuil Alerte Stock Min" in `ProductListView.vue` modal with default value `1` on creation and pre-filled current value on edit.
- Update frontend fallback expressions in `StockView.vue` and `AppProductCombobox.vue` to fallback to `1` instead of `5`.

**Non-Goals:**
- Modifying inventory calculation logic (available vs reserved quantity calculations remain unchanged).
- Bulk editing min stock alerts across all products at once (can be done individually via product edit).

## Decisions

### 1. Database Schema & Migration Strategy
- In `backend/src/db/schema.ts`, update table definition from `DEFAULT 5` to `DEFAULT 1`.
- Add an `ALTER TABLE products ALTER COLUMN min_stock_alert SET DEFAULT 1;` check in schema initialization to safely update existing databases on startup.
- *Alternative considered*: Dropping and recreating tables. *Rejected* because it causes data loss for existing inventory and products.

### 2. Product Modal UI Layout in `ProductListView.vue`
- Place the "Seuil d'Alerte Stock Min" input alongside "Colisage" or "Unité" in a responsive form row (`form-row`).
- Use `type="number"`, `min="0"`, and `placeholder="1"`.
- In `openCreateModal()`, initialize `minStockAlert: 1`.
- In `openEditModal(product)`, initialize `minStockAlert: product.minStockAlert ?? 1`.
- *Alternative considered*: Separate modal for stock thresholds. *Rejected* because consolidating product metadata into the single Edit modal is consistent with existing UI patterns (`catalog-actions`).

### 3. Backend Payload Sanitization
- In `product.routes.ts`, coerce `minStockAlert` with `minStockAlert !== undefined ? Math.max(0, parseInt(minStockAlert, 10) || 0) : 1` on create.
- On update (`PUT /:id`), if provided, sanitize with `Math.max(0, parseInt(minStockAlert, 10) || 0)`.

## Risks / Trade-offs

- **[Existing Seed or Seeded Products]** Existing database records seeded with default 5 will retain their values unless updated by users. → Mitigation: Users can now edit any product's alert threshold directly via the UI, and new products will automatically default to 1.
- **[Zero Threshold Edge Case]** Setting `min_stock_alert = 0` implies only strictly 0 stock triggers out-of-stock (and never low stock). → Mitigation: Allowed, as some non-critical goods may not need low stock warning.
