## Why

In the Point of Sale & Invoicing view (`CreateSaleView.vue`), product selection is implemented using standard `<select>` elements that render the complete product catalog (500–600+ products) for every line item. For multi-line sales with 40–50 concurrent users, this causes excessive DOM element rendering (thousands of `<option>` nodes), repetitive un-cached network fetches, and a degraded checkout UX where cashiers cannot type product names or references for fast searching.

## What Changes

- **Product Store & In-Memory Cache**: Introduce a shared Pinia product store (`useProductStore`) to load, cache, and provide fast in-memory access to the active product catalog across views.
- **Reusable Combobox Component (`AppProductCombobox.vue`)**: Create a high-performance, keyboard-navigable combobox component supporting dual-match search (by product name and reference), real-time available stock badge indicators (in stock, low stock, out of stock), and limited DOM rendering (top 8–10 matched items).
- **Point of Sale Integration**: Replace `<select>` in `CreateSaleView.vue` with `AppProductCombobox`, maintaining 100% parity with existing stock validation, unit pricing, and subtotal calculation logic.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `sales-management`: Update product selection and POS invoice creation workflow to utilize typeahead search combobox with real-time stock indicators while preserving pricing and stock reservation validation.

## Impact

- `frontend/src/stores/product.store.ts`: [NEW] Centralized Pinia store for caching product catalog.
- `frontend/src/components/common/AppProductCombobox.vue`: [NEW] Reusable typeahead product selection combobox.
- `frontend/src/views/sales/CreateSaleView.vue`: Integration of `AppProductCombobox` in invoice line items.
- `frontend/src/types/index.ts`: TypeScript declarations for combobox event payloads if needed.
