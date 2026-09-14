## Context

The application relies on native browser printing (`window.print()`) to generate and export commercial documents (Sales Invoices, Price List / Devis documents, Reference Catalogs, Refund Vouchers, Pickup Slips) and administrative statements (Stock Valuation, Financial Reports).

In the Product Catalog and Stock views, documents are previewed in `ProductDocumentModal.vue`, where the printable sheet is nested within `.document-preview-container` (`max-height: 65vh; overflow-y: auto; display: flex`). The global print engine in `frontend/src/assets/styles/main.css` resets ancestor containers (`.modal-backdrop`, `.modal-card`, `.modal-body`) and the invoice container (`.invoice-preview-wrapper`), but omits `.document-preview-container`. Consequently, the browser collapses the print canvas to the modal's visible scroll viewport, outputting only 1 clipped page instead of paginating across multiple sheets (~4 sheets for 111 products). Furthermore, modal toolbar chrome (`.document-modal-toolbar`, `.scope-pill`) is not suppressed.

In addition, Vite lazy-loads views on navigation (`() => import(...)`). When a user visits *Rapports → Valorisation du Stock*, `StockValuationView.vue` injects an un-scoped `@page { size: A4 landscape; }` rule into `<head>`. Because `@page` rules cannot be scoped by Vue and apply globally, this landscape orientation permanently overrides default portrait printing for all other documents visited afterward in the same user session.

## Goals / Non-Goals

**Goals:**
- Enable complete, continuous multi-page pagination for "Devis / Liste de Vente" and "Catalogue Références" when printed from `ProductDocumentModal.vue` (on both Products and Stock pages).
- Suppress modal toolbar chrome, format switcher buttons, and scope pills from printed documents.
- Ensure table header rows (`thead`) repeat across printed pages on multi-page commercial tables.
- Isolate landscape orientation strictly to `StockValuationView.vue` using CSS named pages, preventing orientation leakage across routes.
- Centralize `@page` geometry and print utilities (such as `.no-print`) in `main.css`, removing redundant/dead `@page` and scoped `body` rules.
- Preserve existing print behavior and isolation for Invoices, Refund Vouchers, Pickup Slips, and Financial Reports.

**Non-Goals:**
- Introducing external PDF generation libraries or server-side headless browser rendering.
- Redesigning the layout, typography, or content structure of existing commercial documents.

## Decisions

### Decision 1: Neutralize Modal Container and Extend Global Document Sheet Reset
In `frontend/src/assets/styles/main.css` under `@media print`:
- Add `.document-preview-container` to the `.invoice-preview-wrapper` rule:
  `background: transparent !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important; overflow: visible !important; max-height: none !important; display: block !important;`
- Add `.a4-document-sheet` to the `.a4-invoice-sheet, .printable-invoice-target` rule.
- Explicitly avoid adding `.printable-doc-target` to that static position rule, as `RefundDocument.vue` requires absolute positioning (`#printable-refund-voucher { position: absolute; }`).

*Rationale*: A clipped, scrollable ancestor collapses to its visible slice at print time. Resetting `.document-preview-container` to `overflow: visible` and `max-height: none` allows the browser layout engine to paginate the document naturally.

### Decision 2: CSS Named Page for Route Orientation Isolation
In `main.css`:
- Maintain the default portrait geometry:
  ```css
  @page {
    size: A4 portrait;
    margin: 8mm 10mm;
  }
  ```
- Declare a named page for landscape reports:
  ```css
  @page valuation-landscape {
    size: A4 landscape;
    margin: 8mm 10mm;
  }
  ```
- In `StockValuationView.vue`, delete `@page { size: A4 landscape; ... }` and attach `page: valuation-landscape;` to `.valuation-view`.

*Rationale*: Vue's `<style scoped>` does not encapsulate `@page` at-rules. CSS Paged Media named pages (`page: <name>`) allow specific elements to declare a page context without polluting the document-wide default `@page`.

*Alternatives Considered*: Route-guard event listeners injecting and removing `<style>` tags dynamically. Rejected because CSS named pages are declarative, standard across Chromium engines, and eliminate runtime lifecycle bugs.

### Decision 3: Repeating Column Headers for Commercial Tables
In `main.css`:
- Add global table header/footer display rules:
  ```css
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  ```
In `ProductPriceListDocument.vue` and `ProductCatalogDocument.vue`:
- Add `.doc-table thead { display: table-header-group; }` inside `@media print`.

*Rationale*: For tables spanning multiple printed sheets, repeating column headers improves readability and ensures compliance with commercial document standards.

### Decision 4: Suppress Modal Toolbar Chrome and Centralize `.no-print`
In `main.css`:
- Add `.document-modal-toolbar` to the UI chrome suppression selector list.
- Define a global `.no-print { display: none !important; }` utility.

*Rationale*: Keeps preview controls (such as the "Tous les produits filtrés (111)" pill and action buttons) out of printed output, and provides a single canonical utility class for non-printable elements across all views.

### Decision 5: Deduplicate Scoped `@page` and Clean Dead Rules
- Remove duplicate `@page` from `ProductPriceListDocument.vue`, `ProductCatalogDocument.vue`, `InvoiceDocument.vue`, and `FinancialReportsView.vue`.
- Remove scoped `body { ... }` rules in `ProductPriceListDocument.vue` and `ProductCatalogDocument.vue` that Vue compiles to non-matching `body[data-v-xxx]`.

*Rationale*: A single source of truth for page geometry in `main.css` prevents unexpected cascade overrides and eliminates dead code.

## Risks / Trade-offs

- **[Risk] Financial report margin variance**:
  - `FinancialReportsView.vue` previously defined `margin: 10mm;`. By removing its local `@page` rule, it inherits `margin: 8mm 10mm;` from `main.css`.
  - *Mitigation*: 8mm top/bottom margin is standard across all other application documents and fits data slightly better without causing formatting issues.
- **[Risk] Browser support for named `@page` rules**:
  - *Mitigation*: Chromium-based browsers (Chrome, Edge) have full support for `@page <name>` and the `page: <name>` property. Other modern browsers either respect the named page or fall back to default portrait geometry without crashing.
