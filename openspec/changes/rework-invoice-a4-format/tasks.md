## 1. Barcode & Formatting Utilities

- [x] 1.1 Create `src/utils/barcode.ts` to generate crisp vector SVG Code 128 barcodes from invoice identifiers
- [x] 1.2 Implement invoice formatting utilities in `src/utils/formatters.ts` for print timestamps (`DD/MM/YYYY à HH:mm:ss`), document dates (`DD/MM/YYYY`), and number/carton calculations

## 2. A4 Invoice Document Component & Print Engine

- [x] 2.1 Create `src/components/sales/InvoiceDocument.vue` implementing the exact physical Algerian commercial trade document layout:
  - Centered company branding: `EURL BOUSFOR GEN TRADING IMP.EXP`, warehouse showroom (e.g. `SHOWROOM SMARA`), and telephone contacts (`05.50.38.30.49 --- 07.77.12.86.39`)
  - 3-column document meta bar: `Vente` (underlined), `Bon de Caisse N°`, `Client : [Name]`, centered SVG barcode + barcode number, `Date du Bon`, `Imprimer le`, `Page N°: 1/1`, `Nombre de Produits`
  - Checklist item table with square verification boxes `[ ]`, `Code Art.`, `Désignation`, `Quantité`, `Prix`, and `Total`
  - Footer logistics and financial summary with `Solde : 0.00`, `Servi Par : [Name]`, `Nombre de Carton : [N]`, and bold `Total`
- [x] 2.2 Add dedicated `@media print` rules and `@page { size: A4 portrait; margin: 8mm 10mm; }` styling to ensure print isolation (hiding all navigation bars, modal dialog chrome, shadows, and screen artifacts)

## 3. Views Integration

- [x] 3.1 Update `SalesListView.vue` to embed `InvoiceDocument.vue` inside the invoice viewer modal with a dedicated "Imprimer (A4)" action
- [x] 3.2 Update `CreateSaleView.vue` to display a post-checkout invoice modal offering instant A4 invoice printing upon successful sale submission

## 4. Verification & Polish

- [x] 4.1 Verify layout fidelity in browser print preview against the physical sample document
- [x] 4.2 Validate barcode sharpness, multi-item table layout, and dynamic fallback values (e.g., customer name, warehouse name, serving worker)
