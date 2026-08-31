## ADDED Requirements

### Requirement: Stock Table Multi-Selection
The stock table in `StockView.vue` SHALL provide row-level checkboxes and a master header checkbox allowing users to select individual stock records, select/deselect all visible items on the current page, or clear the selection.

#### Scenario: User selects stock rows
- **WHEN** the user clicks checkboxes on one or more stock rows
- **THEN** the selected stock IDs are tracked in selection state and a calm contextual selection bar appears showing the selected count

#### Scenario: User toggles master checkbox on current page
- **WHEN** the user clicks the master checkbox in the table header
- **THEN** all stock items on the current page are selected if not all were selected, or deselected if all were selected

#### Scenario: User dismisses selection
- **WHEN** the user clicks the "✕" button on the selection toolbar
- **THEN** all selected stock IDs are cleared and the selection toolbar is hidden

---

### Requirement: Header Overflow Export Menu
The stock page header SHALL provide an overflow `[ Exporter ▾ ]` dropdown menu for full filtered inventory exports when no selection is active.

#### Scenario: User views header export menu
- **WHEN** no items are selected and user clicks "Exporter" in the header
- **THEN** a dropdown menu opens with options: "Exporter CSV (Tous filtrés)", "Générer Devis PDF (Tous filtrés)", and "Générer Catalogue PDF (Tous filtrés)"

#### Scenario: User selects items and header remains calm
- **WHEN** one or more stock items are selected
- **THEN** the header export button is hidden to prevent action duplication and visual clutter

---

### Requirement: Contextual Selection Actions for Stock
The contextual selection toolbar SHALL provide an `[ Actions ▾ ]` dropdown menu to perform operations on the selected stock items.

#### Scenario: User exports selected stock items to CSV
- **WHEN** the user has 3 stock items selected and chooses "Exporter en CSV (3)" from the Actions menu
- **THEN** the system downloads a CSV file containing only the 3 selected stock records

#### Scenario: User generates Devis PDF from selected stock
- **WHEN** the user has 3 stock items selected and chooses "Devis / Prix de Vente (3)" from the Actions menu
- **THEN** the system opens the A4 document preview modal populated with the 3 selected products and their unit sale prices and packaging details

#### Scenario: User generates Reference Catalog PDF from selected stock
- **WHEN** the user has 3 stock items selected and chooses "Catalogue Références (3)" from the Actions menu
- **THEN** the system opens the A4 document preview modal populated with the 3 selected products in clean minimalist format
