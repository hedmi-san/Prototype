## ADDED Requirements

### Requirement: Streamlined Product Catalog Actions
The catalog table in `ProductListView.vue` SHALL present only the "Modifier" action button in the table actions column, removing the standalone "Tarif" action button.

#### Scenario: User views product table actions
- **WHEN** a user navigates to the products catalog table
- **THEN** each row in the actions column does not display a "Tarif" button and only displays the "Modifier" button

### Requirement: Unified Pricing Management via Edit Modal
The product management workflow SHALL handle both product metadata and pricing adjustments (purchase and sale prices) exclusively through the main "Modifier" modal.

#### Scenario: User updates prices in edit modal
- **WHEN** an authorized user clicks "Modifier" on a product, adjusts purchase price and/or sale price, and submits the form
- **THEN** the application updates the product record with the new prices and refreshes the table to show the updated prices and calculated margin
