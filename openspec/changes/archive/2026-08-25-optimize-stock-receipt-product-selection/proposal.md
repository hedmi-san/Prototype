## Why

In the Stock & Inventory management view (`StockView.vue`), the manufacturer/initial stock receipt modal ("Enregistrer une Entrée de Stock Fabricant") currently uses a standard HTML `<select>` element to choose products. With catalogs containing 1,000+ products, scrolling through native `<option>` elements is slow, cumbersome, and lacks instant typeahead filtering. Replacing this with `AppProductCombobox` streamlines stock reception, maintains consistency with POS and transfer creation workflows, and leverages the shared in-memory product cache.

## What Changes

- **Combobox Integration in Stock Reception**: Replace the native `<select>` dropdown in the stock receipt modal of `StockView.vue` with `AppProductCombobox`.
- **Omit Warehouse Stock Indicators**: Do not pass `:warehouse-stock` to `AppProductCombobox` during stock receipt, ensuring incoming goods entry is clean and free of existing warehouse stock badges ("XX unités" / rupture status).
- **Leverage Centralized Product Store**: Connect `StockView.vue` to `useProductStore` to eliminate redundant catalog fetches and benefit from cached product data.
- **Form State Initialization**: Initialize `receiptForm.productId` as `null` or valid selected product with clear search placeholder and standard validation.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `inventory-management`: Update manufacturer stock reception interface to support typeahead product search via `AppProductCombobox` without existing stock quantity badges.

## Impact

- `frontend/src/views/inventory/StockView.vue`: Integrate `AppProductCombobox` and `useProductStore` in receipt modal workflow.
- No backend API or database schema changes required.
