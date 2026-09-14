## Why

Clicking **Imprimer** in the "Devis / Liste de Vente" or "Catalogue Références" modal (on both the Products and Stock pages) currently produces a single sheet that resembles a clipped screenshot of the visible modal scroll area. The document header is cut off at the top, and the preview toolbar's scope pill ("Tous les produits filtrés") is baked into the output instead of flowing across multiple portrait pages as product counts require. Additionally, navigating to the Stock Valuation report leaks an un-scoped `@page { size: A4 landscape; }` rule across the application, causing subsequent catalog and document print operations to erroneously default to landscape mode.

## What Changes

- **Neutralize Preview Scroll Clipping**: Add `.document-preview-container` to the un-clipping print rules in `main.css`, allowing multi-page commercial documents to flow continuously across printed sheets.
- **Global Reset for Product Sheets**: Add `.a4-document-sheet` to the global print canvas reset alongside `.a4-invoice-sheet`, keeping `.printable-doc-target` decoupled to avoid breaking positioned vouchers (such as `#printable-refund-voucher`).
- **Modal Chrome & Toolbar Suppression**: Suppress `.document-modal-toolbar` in print mode, and define a reusable `.no-print { display: none !important; }` utility in `main.css` to consolidate fragmented component-level declarations.
- **Repeating Table Column Headers**: Add `thead { display: table-header-group; }` and `tfoot { display: table-footer-group; }` globally in `main.css`, and reinforce `.doc-table thead` in product document components so table header rows repeat on every printed page.
- **CSS Named Page Orientation Isolation**: Centralize page geometry in `main.css` with a default `@page { size: A4 portrait; margin: 8mm 10mm; }` and a named `@page valuation-landscape { size: A4 landscape; margin: 8mm 10mm; }`. Scope the landscape orientation strictly to `StockValuationView.vue` using `page: valuation-landscape;`.
- **Remove Duplicate `@page` and Ineffective Scoped CSS**: Remove redundant `@page` rules from `ProductPriceListDocument.vue`, `ProductCatalogDocument.vue`, `InvoiceDocument.vue`, and `FinancialReportsView.vue`, and remove dead scoped `body` rules.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `product-document-export`: Specify that A4 printable document outputs (Sales Price List and Reference Catalog) rendered via preview modals must flow cleanly across multiple portrait pages without scroll clipping, repeat table headers on subsequent pages, suppress modal preview chrome/toolbars, and remain isolated from route-level orientation changes.

## Impact

- **Global Styles**: `frontend/src/assets/styles/main.css` — print rules, `@page` declarations, table header repeating, and `.no-print` helper.
- **Product Document Components**:
  - `frontend/src/components/products/ProductPriceListDocument.vue`: Remove duplicate `@page` and dead `body` rule; ensure table header group repeat.
  - `frontend/src/components/products/ProductCatalogDocument.vue`: Remove duplicate `@page` and dead `body` rule; ensure table header group repeat.
  - `frontend/src/components/products/ProductDocumentModal.vue`: Ensure modal container and toolbar adhere to global print suppression rules.
- **Report & Document Views**:
  - `frontend/src/views/reports/StockValuationView.vue`: Bind to named `@page valuation-landscape` instead of document-wide `@page`.
  - `frontend/src/components/sales/InvoiceDocument.vue`: Remove redundant `@page` rule.
  - `frontend/src/views/reports/FinancialReportsView.vue`: Remove redundant `@page` rule.
