## 1. Backend CSV Export Enhancement

- [x] 1.1 Update `/products/export/csv` route in `product.routes.ts` to support optional `ids` query parameter (parsing comma-separated product IDs).

## 2. Frontend Printable Document Components

- [x] 2.1 Create `ProductPriceListDocument.vue` component with company branding, table columns (N°, Référence, Désignation, Marque, Colisage, Prix Vente DZD), summary count, and A4 print stylesheet.
- [x] 2.2 Create `ProductCatalogDocument.vue` component with minimalist table columns (N°, Référence, Désignation), company header, and A4 print stylesheet.
- [x] 2.3 Create `ProductDocumentModal.vue` container modal supporting document type switching, preview rendering, and window print action.

## 3. Frontend Catalog Service & Export Helpers

- [x] 3.1 Update `productService.exportProductsCsv` in `catalog.service.ts` to accept optional `ids` array parameter.

## 4. Product List View Integration & Selection UX

- [x] 4.1 Add row-level selection checkboxes and master header checkbox to `ProductListView.vue`.
- [x] 4.2 Implement contextual selection action bar (showing selected count, Deselect button, and quick actions for CSV, Devis PDF, and Reference List PDF).
- [x] 4.3 Implement header export menu/dropdown for default actions when no items are selected (export all filtered products).
- [x] 4.4 Connect document preview modal and selective CSV export handlers.

## 5. Verification & Testing

- [x] 5.1 Verify CSV export with no selection exports all filtered items, and with selection exports only selected items.
- [x] 5.2 Verify Devis / Sales Price List PDF modal displays prices, packaging (colisage), brand, and prints cleanly in A4 portrait.
- [x] 5.3 Verify Reference List PDF modal displays minimalist reference and product name without prices and prints cleanly.
