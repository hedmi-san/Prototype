## 1. Backend Stock CSV Export Enhancement

- [x] 1.1 Update `/inventory/export/csv` route in `inventory.routes.ts` to support optional `ids` query parameter (filtering by specific stock IDs).

## 2. Frontend Inventory Service & Export Helpers

- [x] 2.1 Update `inventoryService.exportStockCsv` in `operations.service.ts` to accept optional `ids` array/string parameter.

## 3. Stock View Selection & PDF/CSV Export Integration

- [x] 3.1 Add row-level selection checkboxes and master header checkbox to `StockView.vue`.
- [x] 3.2 Add calm contextual selection toolbar with `✓ N produits sélectionnés`, `[ Actions ▾ ]` dropdown menu (CSV, Devis PDF, Catalogue PDF), and `[ ✕ ]` dismiss button.
- [x] 3.3 Add calm header `[ Exporter ▾ ]` overflow dropdown menu when no items are selected.
- [x] 3.4 Integrate `ProductDocumentModal.vue` in `StockView.vue` with stock-to-product mapping for Devis and Reference Catalog PDF generation.

## 4. Verification & Testing

- [x] 4.1 Verify Stock CSV export works for whole filtered list and selected rows only.
- [x] 4.2 Verify Devis and Catalogue PDF previews generate accurately from stock items and print cleanly in A4.
- [x] 4.3 Build frontend and backend to verify zero TypeScript errors.
