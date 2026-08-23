## ADDED Requirements

### Requirement: Standardized A4 Commercial Invoice and Print Engine
The system SHALL provide a standardized A4 commercial invoice ("Bon de Caisse / Vente") layout and print engine that replicates physical Algerian distribution trade documents. The document header SHALL prominently feature the company name (`EURL BOUSFOR GEN TRADING IMP.EXP`), the active warehouse/showroom name (e.g. `SHOWROOM SMARA`), and contact telephone numbers (`05.50.38.30.49 --- 07.77.12.86.39` or warehouse phone). The metadata section SHALL display document type (`Vente`), document reference (`Bon de Caisse N° [Number]`), client name (`Client : [Name]`), an SVG-rendered 1D barcode encoding the transaction/invoice number, transaction date (`Date du Bon [DD/MM/YYYY]`), print timestamp (`Imprimer le : DD/MM/YYYY à HH:mm:ss`), pagination (`Page N°: 1/1`), and distinct line item count (`Nombre de Produits : [N]`). The items table SHALL include a verification check box `[ ]` column for warehouse pickers, product reference (`Code Art.`), designation (`Désignation`), quantity (`Quantité`), unit price (`Prix`), and line subtotal (`Total`). The footer summary SHALL display customer balance (`Solde : 0.00`), serving cashier/staff attribution (`Servi Par : [Name]`), carton/package count (`Nombre de Carton : [N]`), and total payable amount (`Total : [Amount]`).

#### Scenario: View standardized A4 invoice in preview modal
- **WHEN** an authenticated user opens the invoice preview for a sale
- **THEN** the interface SHALL render the complete A4 invoice document matching the company trade format with company name, warehouse showroom, telephone numbers, barcode, items table with picker checkboxes, and summary footer (Solde, Servi Par, Nombre de Carton, Total)

#### Scenario: Print invoice to A4 paper without UI artifacts
- **WHEN** a user triggers the print action for an invoice
- **THEN** the system SHALL apply dedicated `@media print` styling isolating the invoice content onto standard A4 portrait geometry, hiding all modals, overlays, app bars, navigation sidebars, and action buttons, producing a crisp vector document suitable for physical printing or PDF saving

#### Scenario: Dynamic barcode generation on invoice
- **WHEN** an invoice is displayed or prepared for printing
- **THEN** the system SHALL render a scannable Code 128 1D vector barcode corresponding to the sale's invoice identifier alongside the formatted numeric barcode string

#### Scenario: Picker verification checkboxes and packaging summary
- **WHEN** warehouse pickers or cashiers view or print the invoice document
- **THEN** each row in the items table SHALL include an empty square checkbox `[ ]` for manual physical picking confirmation, and the footer SHALL calculate and display the total packaging carton count
