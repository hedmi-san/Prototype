## Context

Following the implementation in `ProductListView.vue`, the Stock view (`StockView.vue`) needs multi-row selection, selective CSV export, and PDF document generation (Devis & Reference Catalog) using the established calm contextual toolbar and overflow menu pattern.

## Goals / Non-Goals

**Goals:**
- Add row checkboxes and master page checkbox in `StockView.vue`.
- Implement a calm contextual selection bar with `✓ N produits sélectionnés`, `[ Actions ▾ ]` dropdown, and `[ ✕ ]` button.
- Provide a clean `[ Exporter ▾ ]` dropdown in the header when no selection is active, hiding it during selection to prevent action duplication.
- Support selective CSV export in `/inventory/export/csv` backend endpoint and `inventoryService.exportStockCsv`.
- Reuse `ProductDocumentModal.vue` to render and print A4 Devis / Liste de Vente and Catalogue Références from stock items.

**Non-Goals:**
- Changing existing stock adjustment or initial receipt workflows.
- Altering the database schema.

## Decisions

### Decision 1: Mapping Stock Items to Document Format
- **Choice**: Map stock row records to standard `Product` interface format `{ id: s.productId, reference: s.productReference, name: s.productName, brand: s.productBrand, salePrice: s.productSalePrice || s.salePrice, purchasePrice: s.productPurchasePrice || s.purchasePrice, unit: s.productUnit, boxSize: s.productBoxSize }` before passing them to `ProductDocumentModal.vue`.
- **Rationale**: Reuses the high-fidelity `ProductPriceListDocument.vue` and `ProductCatalogDocument.vue` components without duplication.

### Decision 2: Backend CSV Export Support for Stock IDs
- **Choice**: Update `/inventory/export/csv` in `inventory.routes.ts` to accept an optional `ids` query parameter (comma-separated stock row IDs) and add `s.id = ANY($X::int[])` to where clauses.
- **Rationale**: Ensures fast, accurate selective CSV exports directly matching user selection.

## Risks / Trade-offs

- **[Risk] Stock spanning across multiple pages when exporting all**: Fetching all filtered items for PDF generation might take a brief network roundtrip.
  - **Mitigation**: Add loading state (`preparingDoc`) and fetch all filtered stock with `inventoryService.getStock({ ...params, limit: 1000 })` or dedicated full-query path.
