# product-document-export Specification

## Purpose
Provides multi-row selection, selective CSV exports, and printable A4 PDF catalog generation (Devis / Sales Price List and Reference Catalog) for the product catalog table.

## Requirements

### Requirement: Product Table Multi-Selection
The product catalog table SHALL provide multi-row selection checkboxes allowing users to select individual products and select/deselect all visible items on the current page.

#### Scenario: User selects individual products
- **WHEN** the user clicks the checkbox on one or more product rows
- **THEN** the selected product IDs are tracked in the selection state and a contextual selection action bar is displayed showing the number of selected items

#### Scenario: User toggles select all on current page
- **WHEN** the user clicks the master checkbox in the table header
- **THEN** all products displayed on the current page are added to the selection if not all were selected, or all current page products are removed from the selection if all were selected

#### Scenario: User clears selection
- **WHEN** the user clicks the "Annuler" / deselect button in the selection action bar
- **THEN** all selected product IDs are cleared and the selection action bar is dismissed

---

### Requirement: Contextual Scope for Exports and Document Generation
The system SHALL determine the export and document generation scope dynamically based on whether products are manually selected.

#### Scenario: Exporting with no items selected
- **WHEN** the user initiates a CSV export, Devis PDF generation, or Reference List PDF generation without selecting any checkboxes
- **THEN** the system automatically applies the operation to all products currently matching the search, brand, and category filters across all pages

#### Scenario: Exporting with items selected
- **WHEN** the user initiates an export or document generation while one or more product checkboxes are selected (including selections across different pages, brand filters, or search terms)
- **THEN** the system strictly applies the operation to all selected products without filtering out items based on the current page or active search/brand filters

---

### Requirement: Selective CSV Export
The backend and frontend SHALL support exporting CSV for either the entire filtered product list or a specific subset of product IDs.

#### Scenario: User exports selected products to CSV
- **WHEN** the user has selected products across one or more pages or filters and clicks "Exporter CSV" from the selection actions menu
- **THEN** the application downloads a CSV file containing all selected products with their full catalog attributes, ignoring any active search or brand filter constraints

---

### Requirement: Sales Price List / Devis PDF Generation
The system SHALL generate an A4 printable Sales Price List ("Devis / Liste de Vente") document containing company branding, emission date, and tabular product pricing data.

#### Scenario: User generates Devis PDF
- **WHEN** the user clicks "Devis / Liste de Vente (PDF)"
- **THEN** the application opens an A4 preview modal displaying company header info, document title, and a table with columns: N°, Référence, Désignation Produit, Marque, Colisage (Pièces/Carton), and Prix Unitaire de Vente (DZD), along with a total count and one-click "Imprimer / Enregistrer en PDF" button

---

### Requirement: Simple Reference List PDF Generation
The system SHALL generate a clean, minimalist A4 printable Reference Catalog ("Catalogue Références") document.

#### Scenario: User generates simple reference list PDF
- **WHEN** the user clicks "Liste Références (PDF)"
- **THEN** the application opens an A4 preview modal displaying company header info, document title, and a clean minimalist table with columns: N°, Référence, and Désignation Produit (without pricing columns), along with total count and one-click print action
