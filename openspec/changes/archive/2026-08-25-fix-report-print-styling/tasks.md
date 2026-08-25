## 1. CSS Print Isolation Engine

- [x] 1.1 Update `frontend/src/assets/styles/main.css` to replace unconditional `#app { display: none !important; }` with contextual `body:has(.modal-backdrop) #app { display: none !important; }`.
- [x] 1.2 Add global print suppression in `main.css` for application shell chrome (`.top-header`, `.sidebar`, `.header-actions`, `.read-only-banner`, and action buttons) when direct pages are printed.
- [x] 1.3 Ensure layout reset styles (`.app-layout`, `.app-body`, `.main-content`) expand to 100% width with visible overflow and clean zero-margins in print mode.

## 2. Stock Valuation Report Print Enhancements

- [x] 2.1 Fix print button event binding in `frontend/src/views/reports/StockValuationView.vue` from `onclick` to `@click="window.print()"`.
- [x] 2.2 Add print-only header block to `StockValuationView.vue` containing the company title, active warehouse entity, report description, and formatted generation date/time.
- [x] 2.3 Configure landscape page styling (`@page { size: A4 landscape; margin: 8mm 10mm; }`) and page-break rules in `StockValuationView.vue` so the 7 columns and summary cards format cleanly.

## 3. Financial Statement (P&L) Report Print Enhancements

- [x] 3.1 Fix print button event binding in `frontend/src/views/reports/FinancialReportsView.vue` to `@click="window.print()"`.
- [x] 3.2 Add print-only header block to `FinancialReportsView.vue` containing company title, active warehouse entity, period range, and generation timestamp.
- [x] 3.3 Configure portrait page styling (`@page { size: A4 portrait; margin: 10mm; }`) and clean high-contrast row borders in `FinancialReportsView.vue`.

## 4. Verification and Validation

- [x] 4.1 Validate invoice modal printing from `SalesListView.vue` to ensure modal isolation continues to function without background bleed.
- [x] 4.2 Validate stock valuation printing from `StockValuationView.vue` to ensure summary cards and full 7-column table render legibly on paper preview.
- [x] 4.3 Validate financial statement printing from `FinancialReportsView.vue` to ensure P&L statement renders legibly without UI navigation controls.
