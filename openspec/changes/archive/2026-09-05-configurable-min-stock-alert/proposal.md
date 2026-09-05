## Why

Currently, products default to a hardcoded minimum stock alert threshold of 5 in the database schema and backend handlers, and the product creation/editing modal lacks an input field to configure this threshold. Businesses require products to default to a minimum stock alert threshold of 1, while providing users the ability to manually inspect and modify this threshold per product (e.g. setting it to 5 or higher for fast-moving items).

## What Changes

- **Database Schema Default**: Update the `min_stock_alert` default constraint in the `products` table from `5` to `1`.
- **Product Form in UI**: Add a "Seuil d'Alerte Stock Min" input field to the product creation and editing modal in `ProductListView.vue`, defaulting to `1` when creating a product and displaying the product's saved value when editing.
- **Backend Product API**: Update `POST /api/products` and `PUT /api/products/:id` in `backend/src/routes/product.routes.ts` to properly handle and validate `minStockAlert` with a default of `1`.
- **Frontend Stock Fallbacks**: Update fallback thresholds across the frontend (such as in `StockView.vue` and `AppProductCombobox.vue`) from `5` to `1`.

## Capabilities

### New Capabilities
- `product-min-stock-alert`: Defines requirements and verification scenarios for configuring per-product minimum stock alert thresholds, defaulting to 1, and enabling custom manual threshold updates in the UI and backend.

### Modified Capabilities

## Impact

- **Database**: `backend/src/db/schema.ts` table definition for `products.min_stock_alert` default value.
- **Backend API**: `backend/src/routes/product.routes.ts` create and update product route logic.
- **Frontend UI**: `frontend/src/views/products/ProductListView.vue` modal template, reactive state, and submission handlers; `frontend/src/views/inventory/StockView.vue` and `frontend/src/components/common/AppProductCombobox.vue` fallback values.
