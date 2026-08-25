## Why

Clicking the "Imprimer le Bilan" (Print Report / Balance Sheet) button in `StockValuationView.vue` and `FinancialReportsView.vue` currently triggers the browser print dialog with a completely blank white page. This is caused by an unconditional `@media print { #app { display: none !important; } }` rule originally intended to isolate teleported invoice modals, which inadvertently hides the entire single-page application tree for all direct page-level reports.

## What Changes

- **Targeted CSS Print Isolation**: Refactor global `@media print` rules in `main.css` so `#app` is only hidden when a modal backdrop is active (`body:has(.modal-backdrop)`), while allowing direct page printing when no modal is open.
- **Application Shell Print Suppression**: When printing direct report pages, automatically hide navigation chrome (top header navbar, sidebar navigation menu, header action buttons, read-only banners, search bars, pagination controls).
- **A4 Report Print Formatting**: Add clean, professional print styles for `StockValuationView` and `FinancialReportsView`, including:
  - Print-specific header (official company brand `DISTRI-TOOLS DZ / EURL BOUSFOR HOSNA`, active warehouse scope, generation timestamp).
  - Landscape page geometry optimization (`@page { size: A4 landscape; margin: 10mm; }`) to comfortably display 7-column valuation tables without clipping.
  - Page-break management (`page-break-inside: avoid` on cards and table rows) and crisp monochrome/high-contrast table borders.
- **Vue Event Binding Correction**: Fix `onclick="window.print()"` to standard `@click="window.print()"` in report view action buttons.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `reporting-audit-logging`: Add requirements for printable financial and stock valuation statements with formal headers, timestamping, and print-ready layout formatting.
- `ui-design-system`: Add requirements for dual-mode print styling (modal isolation vs. direct page report printing).

## Impact

- `frontend/src/assets/styles/main.css`: Global print media styles.
- `frontend/src/views/reports/StockValuationView.vue`: Stock valuation report template and print-specific layout.
- `frontend/src/views/reports/FinancialReportsView.vue`: Financial statement report template and print-specific layout.
- No backend API or database schema changes required.
