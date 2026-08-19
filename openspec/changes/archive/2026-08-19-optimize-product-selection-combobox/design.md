## Context

Currently, `CreateSaleView.vue` and other views retrieve the entire product list on mount and populate standard HTML `<select>` elements per line item. For large product catalogs (500–600+ items) and multiple concurrent POS terminals, rendering hundreds of `<option>` tags per line degrades DOM rendering performance and lacks fast keyboard-first autocomplete by name and reference.

## Goals / Non-Goals

**Goals:**
- Implement a global `useProductStore` (Pinia) to cache the product catalog and eliminate redundant network fetches.
- Create a standalone, reusable Vue 3 component `AppProductCombobox.vue` supporting:
  - Fast in-memory dual search (case- and accent-insensitive matching on reference and name).
  - Maximum 8–10 rendered results in the dropdown.
  - Real-time stock status badge (🟢 In Stock, 🟡 Low Stock, 🔴 Out of Stock) based on `warehouseStock` prop.
  - Keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`, `Tab`).
  - Clear / reset button `✕`.
- Integrate `AppProductCombobox.vue` into `CreateSaleView.vue` while preserving 100% of price calculation, stock validation, and invoice creation logic.

**Non-Goals:**
- Changing invoice creation API endpoints or backend pricing logic.
- Modifying barcode scanner hardware integrations.

## Decisions

1. **Centralized Pinia Product Store (`product.store.ts`)**:
   - Manages `products: ref<Product[]>`, `loading: ref<boolean>`, and `lastFetched: ref<number | null>`.
   - `fetchProducts(force = false)`: Retrieves catalog once per session or when cache expires (> 5 minutes).

2. **`AppProductCombobox.vue` Component Architecture**:
   - Props:
     - `modelValue: number | null` (selected `productId`)
     - `warehouseStock: Stock[]` (current warehouse stock array)
     - `placeholder: string`
     - `disabled: boolean`
   - Emits:
     - `update:modelValue` (emits `productId: number | null`)
     - `select` (emits `product: Product | null`)
   - Internal state:
     - `searchQuery`: Text typed by the user or formatted title of selected product.
     - `isOpen`: Controls visibility of floating result list.
     - `highlightedIndex`: Index of keyboard-highlighted item.
   - Click-outside handling: Closes dropdown when clicking outside.

## Risks / Trade-offs

- **[Cache Invalidation on Product Edit]** → Pinia `productStore.fetchProducts(true)` can be called after creating or updating a product to ensure immediate cache freshness.
