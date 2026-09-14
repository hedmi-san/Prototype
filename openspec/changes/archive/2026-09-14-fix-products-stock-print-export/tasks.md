## 1. Global Print Engine Updates in main.css

- [x] 1.1 Add named page `@page valuation-landscape { size: A4 landscape; margin: 8mm 10mm; }` alongside the default portrait `@page` rule in `frontend/src/assets/styles/main.css`
- [x] 1.2 Neutralize `.document-preview-container` in `frontend/src/assets/styles/main.css` by merging it into the `.invoice-preview-wrapper` un-clipping print rule
- [x] 1.3 Add `.a4-document-sheet` to the `.a4-invoice-sheet, .printable-invoice-target` print reset rule in `frontend/src/assets/styles/main.css` (keeping `.printable-doc-target` excluded)
- [x] 1.4 Suppress `.document-modal-toolbar` in print mode and add global `.no-print { display: none !important; }` utility in `frontend/src/assets/styles/main.css`
- [x] 1.5 Add repeating table chrome (`thead { display: table-header-group; }`, `tfoot { display: table-footer-group; }`) in `frontend/src/assets/styles/main.css`

## 2. Product Document Components Cleanup & Table Header Repeat

- [x] 2.1 Remove duplicate `@page` and dead scoped `body` rule in `frontend/src/components/products/ProductPriceListDocument.vue` and add `.doc-table thead { display: table-header-group; }`
- [x] 2.2 Remove duplicate `@page` and dead scoped `body` rule in `frontend/src/components/products/ProductCatalogDocument.vue` and add `.doc-table thead { display: table-header-group; }`

## 3. Stock Valuation Orientation Isolation

- [x] 3.1 In `frontend/src/views/reports/StockValuationView.vue`, remove the un-scoped `@page { size: A4 landscape; ... }` at-rule
- [x] 3.2 In `frontend/src/views/reports/StockValuationView.vue`, attach `page: valuation-landscape;` to the `.valuation-view` container rule

## 4. Deduplication of Remaining Scoped @page Rules

- [x] 4.1 Remove duplicate `@page` rule in `frontend/src/components/sales/InvoiceDocument.vue`
- [x] 4.2 Remove duplicate `@page` rule in `frontend/src/views/reports/FinancialReportsView.vue`

## 5. Verification & Testing

- [x] 5.1 Verify Devis modal print from Products page (verify multi-page A4 portrait flow, uncut company header, repeating table headers, and suppressed toolbar/scope pill)
- [x] 5.2 Verify Reference Catalog modal print from Products page
- [x] 5.3 Verify Devis and Reference Catalog modal print from Stock page
- [x] 5.4 Verify orientation leak regression: navigate to Stock Valuation report, confirm landscape print, then navigate back to Products/Stock and confirm portrait print
- [x] 5.5 Sweep remaining print surfaces (Invoice print from Sales list, Pickup slip, Refund voucher from Client Profile, Financial reports) to verify zero regressions
