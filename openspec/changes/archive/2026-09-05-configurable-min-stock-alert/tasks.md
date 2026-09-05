## 1. Database Schema & Migration

- [x] 1.1 Update `min_stock_alert` default value to `1` in `backend/src/db/schema.ts`
- [x] 1.2 Add safe `ALTER TABLE products ALTER COLUMN min_stock_alert SET DEFAULT 1` execution during schema initialization

## 2. Backend Product Endpoints

- [x] 2.1 Update `POST /api/products` in `backend/src/routes/product.routes.ts` to default `minStockAlert` to 1 and enforce non-negative integer sanitization
- [x] 2.2 Verify and sanitize `minStockAlert` handling in `PUT /api/products/:id` in `backend/src/routes/product.routes.ts`

## 3. Frontend Product Form & Modal

- [x] 3.1 Update `productForm` state in `frontend/src/views/products/ProductListView.vue` to include `minStockAlert`
- [x] 3.2 Add "Seuil d'Alerte Stock Min" numeric input field in the product modal template in `ProductListView.vue`
- [x] 3.3 Initialize `minStockAlert: 1` in `openCreateModal()` and pre-fill `minStockAlert: product.minStockAlert ?? 1` in `openEditModal(product)`

## 4. Frontend Fallback Harmonization & Verification

- [x] 4.1 Update fallback alert thresholds from 5 to 1 in `StockView.vue` and `AppProductCombobox.vue`
- [x] 4.2 Build and verify product creation with default 1, custom alert threshold (e.g. 5), and updating existing products
