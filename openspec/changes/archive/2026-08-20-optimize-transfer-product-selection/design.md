## Context

In `TransferListView.vue`, users (Warehouse Managers and Admins) create inter-warehouse stock transfer requests. When selecting products for transfer items, users need to know if the source warehouse has adequate stock available to fulfill the request. `AppProductCombobox` already supports real-time stock indicators through its `warehouseStock` prop (as used in `CreateSaleView.vue`), but `TransferListView.vue` did not fetch or bind the source warehouse stock to the combobox instances.

## Goals / Non-Goals

**Goals:**
- Provide reactive source warehouse inventory fetching in `TransferListView.vue` whenever the transfer creation modal is opened or the source warehouse selection changes.
- Bind `sourceWarehouseStock` to `AppProductCombobox` instances in the transfer creation modal to display real-time stock status badges (🟢 In Stock, 🟡 Low Stock, 🔴 Out of Stock) per product.
- Ensure fast in-memory dual-matching (product name and reference) and keyboard navigation for transfer line items.
- Maintain full parity with existing transfer creation API payloads and validation rules.

**Non-Goals:**
- Modifying backend transfer approval, confirmation, or cancellation endpoints.
- Modifying transfer database schemas or permissions.

## Decisions

1. **Source Warehouse Stock Management in `TransferListView.vue`**:
   - Introduce `sourceWarehouseStock = ref<Stock[]>([])` and `async function fetchSourceWarehouseStock(warehouseId: number)`.
   - Trigger `fetchSourceWarehouseStock` when opening the transfer modal (`openCreateModal`) and whenever `createForm.sourceWarehouseId` changes.
   - Ensure that if source and destination warehouses are swapped or changed, stock indicators refresh immediately.

2. **`AppProductCombobox` Integration in Transfer Items**:
   - Bind `:warehouse-stock="sourceWarehouseStock"` to `<AppProductCombobox>` in the `createForm.items` loop.
   - Enable users to search by partial reference (e.g. `DCD796`), product name, or brand, and immediately see available stock at the chosen departure warehouse.

3. **Parity with POS Combobox Experience**:
   - Standardize placeholder text (`"Taper nom ou réf (ex: DCD796)..."` or `"Sélectionner ou rechercher un produit..."`) and keyboard navigation behavior.

## Risks / Trade-offs

- **[Rapid Source Warehouse Switching]** → `fetchSourceWarehouseStock` is an asynchronous call to `/inventory/stock?warehouseId=X`; calling it on `@change` ensures only the latest selected warehouse stock is reflected in the UI.
