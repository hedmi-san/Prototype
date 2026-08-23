## Why

The current invoice viewer in the sales module prints as a raw on-screen UI dialog screenshot rather than a clean, standardized commercial paper invoice. When printed, application headers, modal borders, dark mode backgrounds, and buttons clutter the printout, and the layout does not adhere to standard Algerian commercial distribution trade documents ("Bon de Caisse / Facture de Vente").

To meet operational warehouse requirements, the invoice layout must strictly conform to the company's official A4 format featuring company branding (`EURL BOUSFOR GEN TRADING IMP.EXP`), warehouse location (`SHOWROOM SMARA` / warehouse name), contact telephone numbers, top metadata section with a scannable 1D barcode, structured itemized table with picker check-boxes (`[ ]`), article codes, quantities, and a complete financial and logistical summary (customer balance, serving staff attribution, carton count, and bold total).

## What Changes

- **Dedicated A4 Invoice Document Component**: Create a high-fidelity, print-isolated Vue component (`InvoiceDocument.vue`) adhering to exact A4 dimensions (`210mm x 297mm`) with portrait page margins, clean black-on-white typography, and crisp lines.
- **Company Header & Branding**:
  - Top header displaying company name: `EURL BOUSFOR GEN TRADING IMP.EXP`.
  - Secondary line displaying the warehouse/showroom name (e.g., `SHOWROOM SMARA`).
  - Third line displaying contact phone numbers (e.g., `05.50.38.30.49 --- 07.77.12.86.39`).
- **Document Metadata & Barcode Bar**:
  - Left column: Document type (underlined `Vente` or `Bon de Caisse`), sequential receipt/invoice identifier (`Bon de Caisse N° [Number]`), and customer identification (`Client : [Name]`).
  - Center column: Machine-readable Code 128 1D barcode and barcode numeric string.
  - Right column: Transaction date (`Date du Bon [DD/MM/YYYY]`), print timestamp (`Imprimer le : DD/MM/YYYY à HH:mm:ss`), pagination (`Page N°: 1/1`), and line items count (`Nombre de Produits : [N]`).
- **Structured Article Table with Checker Boxes**:
  - Verification check box column `[ ]` for warehouse pickers and quality control.
  - Article reference code (`Code Art.`).
  - Item description/name (`Désignation`).
  - Quantity (`Quantité`).
  - Unit price formatted cleanly (`Prix`).
  - Line total formatted cleanly (`Total`).
- **Footer Summary & Logistics**:
  - Customer balance line (`Solde : 0.00`).
  - Serving cashier attribution (`Émis Par : [User Name]`).
  - Delivery staff attribution (`Servi Par : [Employee/Worker Name]`).
  - Prominent total amount summary (`Total : [Amount]`).
- **Print Isolation & PDF Generation**:
  - CSS `@media print` rules ensuring only the invoice document is rendered upon printing, hiding modal overlays, dialog shadows, navigation sidebars, and action buttons.
  - Seamless print and PDF export directly from the Invoice Modal in `SalesListView.vue` and optionally upon sale completion in `CreateSaleView.vue`.

## Capabilities

### New Capabilities
<!-- None: core domain requirements are captured in modified sales-management capability -->

### Modified Capabilities
- `sales-management`: Add requirement for standardized A4 commercial invoice layout, scannable barcode generation, picker verification checkboxes, logistics metadata (carton count, customer balance, serving staff), and print isolation engine.

## Impact

- **Frontend Components**:
  - `frontend/src/components/sales/InvoiceDocument.vue` (new reusable printable invoice component with SVG barcode generation)
  - `frontend/src/views/sales/SalesListView.vue` (integrate updated invoice preview and A4 print trigger)
  - `frontend/src/views/sales/CreateSaleView.vue` (provide optional instant print dialog / preview upon sale submission)
- **Frontend Utilities**:
  - Barcode rendering utility / lightweight SVG barcode generator for Code 128 / numeric barcodes without external bulky dependencies
- **Styling**:
  - `@media print` rules in `index.css` and scoped invoice styling guaranteeing true A4 page geometry, high print resolution, and zero UI artifacts.
