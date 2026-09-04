## MODIFIED Requirements

### Requirement: Contextual Scope for Exports and Document Generation
The system SHALL determine the export and document generation scope dynamically based on whether products are manually selected.

#### Scenario: Exporting with no items selected
- **WHEN** the user initiates a CSV export, Devis PDF generation, or Reference List PDF generation without selecting any checkboxes
- **THEN** the system automatically applies the operation to all products currently matching the search, brand, and category filters across all pages

#### Scenario: Exporting with items selected
- **WHEN** the user initiates an export or document generation while one or more product checkboxes are selected (including selections across different pages, brand filters, or search terms)
- **THEN** the system strictly applies the operation to all selected products without filtering out items based on the current page or active search/brand filters

### Requirement: Selective CSV Export
The backend and frontend SHALL support exporting CSV for either the entire filtered product list or a specific subset of product IDs.

#### Scenario: User exports selected products to CSV
- **WHEN** the user has selected products across one or more pages or filters and clicks "Exporter CSV" from the selection actions menu
- **THEN** the application downloads a CSV file containing all selected products with their full catalog attributes, ignoring any active search or brand filter constraints
