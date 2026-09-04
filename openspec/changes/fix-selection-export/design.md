## Context

In the distribution management platform, `ProductListView.vue` (Product Catalog) and `StockView.vue` (Inventory & Stock) provide multi-row selection, selective CSV exports, and printable A4 PDF document generation (Devis / Sales Price List and Reference Catalog).

Users can filter products by brand or search term, paginate through the catalog, and select items across different views (e.g., 3 items on page 1 or brand Bosch, 2 items after filtering by brand DeWalt). The UI tracks the total selection count in a contextual selection toolbar (e.g. "5 produits sélectionnés"). However, during CSV export and document generation, items outside the active filter or current page are excluded from the exported output.

## Goals / Non-Goals

**Goals:**
- Guarantee that when users export a selection or generate PDF documents from selected items, 100% of the selected items are included, regardless of active search queries, brand filters, stock status filters, or pagination page.
- Make explicit ID selections take precedence in backend `/export/csv` routes, avoiding restrictive `AND` clauses with discovery filters (search, brand, stock status).
- Support explicit `ids` querying in product and inventory data fetching so frontend document generation modals can reliably load all selected items without fetching unrelated data or being constrained by search/brand filters.
- Maintain persistent selection state in the frontend while navigating pages or changing/resetting filters.

**Non-Goals:**
- Modifying default export behavior when no items are selected (which continues to export all filtered records matching the current filters).
- Changing warehouse access control or permission validation.

## Decisions

### Decision 1: Explicit ID Priority in Backend Export Queries
In `backend/src/routes/product.routes.ts` and `backend/src/routes/inventory.routes.ts`:
- When `ids` (or `idsParam`) is present in `GET /export/csv`:
  - Product route: Query `SELECT * FROM products WHERE id = ANY($1::int[]) ORDER BY name ASC, id ASC`. Bypass `search` and `brand` filters.
  - Inventory route: Query `WHERE s.id = ANY($1::int[])` (while preserving tenant warehouse scope for MANAGER / ACCOUNTANT roles). Bypass `status`, `lowStock`, and `search` filters.
- **Rationale**: When a user or API client explicitly specifies a list of IDs to export, those IDs represent the explicit dataset. Discovery filters (`search`, `brand`, `status`) are used to locate items in a table, not to further restrict an already explicit set of chosen items.

### Decision 2: Add `ids` Support to Product and Stock Listing Endpoints
In `backend/src/routes/product.routes.ts` (`GET /api/products`) and `backend/src/routes/inventory.routes.ts` (`GET /api/inventory/stock`):
- Support optional comma-separated `ids` parameter.
- When `ids` is provided, filter records by `id = ANY(...)` and bypass search/brand/status filters.
- **Rationale**: Enables `getTargetProductsForAction('selection')` in frontend views to fetch all selected products in one call without transferring the entire catalog or losing items selected under different filters.

### Decision 3: Frontend Selection Action Parameter Isolation
In `ProductListView.vue` and `StockView.vue`:
- In `handleExportCsv(scope)`:
  - If `scope === 'selection'`, pass only `{ ids }` (and `warehouseId` if required for stock). Do not send `search`, `brand`, or `status`.
- In `getTargetProductsForAction(scope)`:
  - If `scope === 'selection'`, request products/stock using `{ ids }`, ensuring all selected items across pages and filters are populated for PDF generation.
- **Rationale**: Clean separation between filter state (used for browsing/searching) and selection state (used for targeted actions).

## Risks / Trade-offs

- **[Risk] Extremely large selections causing query URL overflow**:
  - *Mitigation*: URL query strings easily support several hundred integer IDs (e.g. 100-500 IDs is ~1-3KB). If a selection is large, standard GET query parameters handle typical pagination sizes comfortably.
- **[Risk] Warehouse access violation in stock export**:
  - *Mitigation*: In `inventory.routes.ts`, warehouse scoping rules (`validateWarehouseScope` and role-based `s.warehouse_id = $...`) are strictly retained even when `ids` is provided.
