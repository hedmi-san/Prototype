## Context

The ERP frontend features two distinct printing scenarios:
1. **Modal-Teleported Documents**: Point of sale invoices and receipts rendered inside `AppModal.vue` (`<Teleport to="body">`).
2. **Full-Page Analytical Statements**: Stock valuation (`StockValuationView.vue`) and P&L financial reports (`FinancialReportsView.vue`) rendered inside `#app > .app-layout > .app-body > .main-content`.

Currently, `main.css` applies `#app { display: none !important; }` in `@media print`, which correctly isolates invoices when printing from modals, but completely hides direct page-level reports, resulting in a blank white page preview.

## Goals / Non-Goals

**Goals:**
- Enable direct browser printing for `StockValuationView` and `FinancialReportsView`.
- Maintain seamless print isolation for modal-teleported invoices (`InvoiceDocument.vue`) without regressions.
- Automatically hide navigational elements (`.top-header`, `.sidebar`, `.header-actions`, buttons, search filters, pagination controls) when printing direct pages.
- Add print-only header elements (company banner, warehouse scope, generation date/time) and landscape table geometry for the 7-column valuation report.
- Correct inline `onclick` handler syntax to Vue `@click` bindings.

**Non-Goals:**
- Creating server-side PDF rendering services (headless chrome/puppeteer).
- Modifying backend endpoints or database structures.

## Decisions

### 1. Contextual Print Isolation via `body:has(.modal-backdrop)`
- **Choice**: Use CSS `:has()` pseudo-class selector in `main.css`:
  ```css
  body:has(.modal-backdrop) #app {
    display: none !important;
  }
  ```
- **Rationale**: Supported by all modern evergreen browsers (Chrome 105+, Firefox 121+, Safari 15.4+, Edge 105+). When a modal is open, `#app` is suppressed so the background dashboard does not print behind the modal. When no modal is open, `#app` remains visible, allowing standard report pages to print.
- **Alternatives Considered**: 
  - *Custom JavaScript print state class on `<body>`*: Adds unnecessary state tracking boilerplate when modern CSS pseudo-classes solve it declaratively.
  - *Teleporting all reports into modals*: Degrades user experience for users who just want to quickly print the page they are actively analyzing.

### 2. Print Layout Optimization for Report Pages
- **Choice**: 
  - In `main.css`, define base print defaults for direct page printing:
    ```css
    @media print {
      .top-header,
      .sidebar,
      .header-actions,
      .read-only-banner,
      .period-picker,
      button,
      .app-button {
        display: none !important;
      }

      .app-layout, .app-body, .main-content {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        height: auto !important;
      }
    }
    ```
  - In `StockValuationView.vue`: Include a print-only header with company name, warehouse entity, and current timestamp (`Généré le DD/MM/YYYY à HH:mm`). Set page orientation to `@page { size: A4 landscape; margin: 10mm; }` to comfortably accommodate the 7 columns without horizontal truncation.
  - In `FinancialReportsView.vue`: Include a print-only header with company name, warehouse entity, and period range. Set `@page { size: A4 portrait; margin: 10mm; }`.

## Risks / Trade-offs

- **[Risk]** Legacy browsers lacking `:has()` support might print both `#app` and the modal backdrop when printing an invoice.
  - *Mitigation*: The ERP runs in modern evergreen browser environments (Chrome/Edge desktop). As an extra safeguard, `.modal-backdrop` already has a solid white printable target surface.
- **[Risk]** Table pagination in long stock reports.
  - *Mitigation*: Apply `page-break-inside: avoid` on `<tr>` elements and summary cards so rows are not split across page breaks.
