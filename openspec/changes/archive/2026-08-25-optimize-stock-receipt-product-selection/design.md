## Context

In the Stock & Inventory management view (`frontend/src/views/inventory/StockView.vue`), the modal for registering manufacturer/initial stock entries ("Enregistrer une Entrée de Stock Fabricant") currently uses a standard HTML `<select>` element to pick products. For catalogs with 1,000+ products, this presents significant performance and usability issues.

`AppProductCombobox.vue` was previously introduced in the POS sales and transfer workflows to solve this exact issue using in-memory search and limited DOM rendering.

## Goals / Non-Goals

**Goals:**
- Replace the native `<select>` in the manufacturer receipt modal in `StockView.vue` with `AppProductCombobox`.
- Enable fast multi-token search across product references, names, brands, and categories.
- Omit warehouse stock indicators (`XX unités` / rupture status) during stock receipt by leaving `warehouseStock` unassigned (empty).
- Standardize catalog fetching in `StockView.vue` using the shared Pinia `useProductStore`.
- Ensure receipt submission validates product selection before making the API request.

**Non-Goals:**
- Modifying backend `/api/inventory/initial-stock` API endpoints or inventory movement recording logic.
- Modifying the stock adjustment modal (`adjustForm`), which operates directly on a selected existing stock row.

## Decisions

1. **Direct Re-use of `AppProductCombobox.vue`**:
   - `AppProductCombobox` natively supports hiding stock badges when `warehouseStock` is not provided (or empty).
   - Usage in `StockView.vue`:
     ```vue
     <AppProductCombobox
       v-model="receiptForm.productId"
       placeholder="Rechercher un produit (nom ou référence)..."
       required
     />
     ```

2. **Store Migration to `useProductStore`**:
   - Replace redundant component-level `productService.getProducts()` calls with `productStore.fetchProducts()`.
   - Ensures consistency and instant cache utilization across Sales, Transfers, and Inventory modules.

3. **Form Validation and Reset**:
   - On opening the modal (`openReceiptModal`), set `receiptForm.productId` to `null` (or first available item if appropriate).
   - In `handleSaveReceipt()`, verify `receiptForm.productId` is selected before proceeding.

## Risks / Trade-offs

- **[Unselected Product on Submit]** → `AppProductCombobox` enforces `required` input behavior, and `handleSaveReceipt` will add explicit check (`if (!receiptForm.value.productId)`) to prevent submitting with an unselected product.
