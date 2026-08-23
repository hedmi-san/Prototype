## Context

The current application renders invoices inside a generic dark-mode modal and invokes `window.print()`, causing the entire viewport (modal background, backdrop, close buttons, navigation bar, and screen fonts) to be sent to the printer. This results in a screenshot-like printout that does not conform to physical Algerian commercial wholesale/retail trade documents ("Bon de Caisse / Vente").

Based on the physical sample provided, the trade document requires:
1. Specific header branding: `EURL BOUSFOR GEN TRADING IMP.EXP`, warehouse showroom identifier (`SHOWROOM SMARA` / warehouse name), and contact telephone numbers (`05.50.38.30.49 --- 07.77.12.86.39`).
2. Document metadata grid: Document type (`Vente`), document number (`Bon de Caisse N° [Number]`), client name (`Client : DIVERS` / customer name), machine-scannable 1D barcode with numeric label, transaction date, print timestamp with seconds, pagination (`Page N°: 1/1`), and distinct product count (`Nombre de Produits : [N]`).
3. Checklist item table: Checkbox column (`[ ]`) for physical warehouse picking verification, article code (`Code Art.`), description (`Désignation`), quantity (`Quantité`), unit price (`Prix`), and line total (`Total`).
4. Logistics & financial footer: Customer balance (`Solde : 0.00`), serving staff attribution (`Servi Par : [Name]`), packaging carton count (`Nombre de Carton : [N]`), and total payable amount (`Total : [Amount]`).
5. True A4 print isolation: Pure vector layout with standard A4 margins, zero screen UI artifacts, and clean black-and-white contrast for thermal and laser printers.

## Goals / Non-Goals

**Goals:**
- Create a dedicated, reusable `InvoiceDocument.vue` component matching the physical trade document layout with pixel-perfect A4 geometry.
- Implement an SVG-based 1D Code 128 barcode generator to embed scannable transaction barcodes without heavyweight external libraries.
- Implement CSS `@media print` rules and print isolation logic so printing outputs only the clean A4 document.
- Update `SalesListView.vue` invoice modal to embed the new A4 document preview and direct print action.
- Update `CreateSaleView.vue` to offer immediate invoice printing after checkout.
- Support default company information (`EURL BOUSFOR GEN TRADING IMP.EXP`, phone numbers) with dynamic warehouse showroom fallback.

**Non-Goals:**
- Modifying backend database schemas or changing sale creation transaction logic (the existing schema already stores all required attributes: invoice numbers, customer name, phone, warehouse, employee name, created by user, timestamps, line items).
- Thermal roll (80mm ESC/POS) formatting (the target format is standard A4 paper).

## Decisions

### Decision 1: Dedicated Printable Component with CSS Print Isolation
- **Approach**: Build `InvoiceDocument.vue` encapsulated in a wrapper marked with a printable CSS class (e.g. `.printable-invoice-target`). In `@media print`, hide all DOM elements (`body * { visibility: hidden; }`) and render only `.printable-invoice-target { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; }`.
- **Rationale**: This guarantees that regardless of whether the modal is open or what theme (dark/light) the user is using, triggering `window.print()` will output a pure white A4 paper page with sharp black vector text and borders.
- **Alternatives Considered**:
  - `jsPDF` / `html2canvas`: Generates rasterized images inside PDF, causing fuzzy text, blurriness on barcodes, large file sizes, and slow rendering. Native browser print to PDF preserves vector text, crisp SVG barcodes, and CSS pagination.

### Decision 2: Lightweight Pure TypeScript SVG Code 128 Barcode Generator
- **Approach**: Implement a lightweight Code 128 barcode encoder in `src/utils/barcode.ts` that outputs SVG paths/rectangles directly.
- **Rationale**: Avoids adding bulky external npm packages while guaranteeing sharp, scalable, vector-based barcode rendering at 300+ DPI print quality.
- **Alternatives Considered**:
  - External `jsbarcode` dependency: Adds bundle overhead and requires DOM canvas/SVG binding; a compact utility function provides total control and zero dependency risk.

### Decision 3: Document Layout & Typography Structure
- **Approach**:
  - Page container: A4 dimensions (`210mm x 297mm`) with `box-sizing: border-box`, standard `8mm 12mm` margins, clean sans-serif typography (`Inter`, `Segoe UI`, Arial).
  - Header: Centered company name, showroom name, phone numbers separated by dashes.
  - Meta block: 3-column flex layout (Left: Vente/Bon N°/Client; Center: SVG Barcode + numeric label; Right: Dates, Page N°, Product count).
  - Table: Compact uppercase table with border dividers and 14px check boxes (`[ ]`).
  - Footer: Left block with Solde, Servi Par, and Nombre de Carton; Right block with bold Total.

## Risks / Trade-offs

- **[Risk]** Browser print headers and footers (URL, date) may appear on the printout.
  - **Mitigation**: Add `@page { margin: 8mm 10mm; size: A4 portrait; }` CSS rules to eliminate default browser margins and hide default headers/footers in supported browsers.
- **[Risk]** Large invoices with 30+ items overflowing a single A4 page.
  - **Mitigation**: Use standard CSS table page-break rules (`page-break-inside: avoid;` for rows and `thead { display: table-header-group; }`) so multi-page invoices break cleanly across A4 sheets with repeating headers.
