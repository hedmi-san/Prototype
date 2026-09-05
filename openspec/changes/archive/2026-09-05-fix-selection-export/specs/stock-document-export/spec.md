## MODIFIED Requirements

### Requirement: Contextual Selection Actions for Stock
The contextual selection toolbar SHALL provide an `[ Actions ▾ ]` dropdown menu to perform operations on the selected stock items.

#### Scenario: User exports selected stock items to CSV
- **WHEN** the user has stock items selected across one or more pages or filters and chooses "Exporter en CSV" from the Actions menu
- **THEN** the system downloads a CSV file containing all selected stock records, ignoring any active status or search filter constraints (while respecting user warehouse scope)

#### Scenario: User generates Devis PDF from selected stock
- **WHEN** the user has stock items selected across one or more pages or filters and chooses "Devis / Prix de Vente" from the Actions menu
- **THEN** the system opens the A4 document preview modal populated with all selected products and their unit sale prices and packaging details, without omitting products outside current status or search filters

#### Scenario: User generates Reference Catalog PDF from selected stock
- **WHEN** the user has stock items selected across one or more pages or filters and chooses "Catalogue Références" from the Actions menu
- **THEN** the system opens the A4 document preview modal populated with all selected products in clean minimalist format, without omitting products outside current status or search filters
