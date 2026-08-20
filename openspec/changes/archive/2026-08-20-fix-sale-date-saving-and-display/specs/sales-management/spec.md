## MODIFIED Requirements

### Requirement: Transactional Sale Creation and Invoice Numbering
The system SHALL create sales transactionally, validating available inventory for every line item, snapshotting the unit price into `sale_items`, decrementing `physical_quantity`, logging `SALE` stock movements, persisting the explicit or defaulted sale transaction date (`sale_date`), and generating an invoice number.

#### Scenario: Successful sale creation
- **WHEN** an Accountant creates a sale with 5 units of Product A in their assigned warehouse where 10 units are available
- **THEN** the system SHALL create the sale record with an invoice number, snapshot the current product sale price into `sale_items`, decrement `physical_quantity` by 5, record a `SALE` stock movement, persist the sale date in `sale_date`, and return the saved sale details including `saleDate`

#### Scenario: Successful sale creation with explicit sale date
- **WHEN** an Accountant or Cashier creates a sale with 5 units of Product A in their assigned warehouse where 10 units are available, providing an explicit `saleDate` ("2026-08-20 14:30:00")
- **THEN** the system SHALL create the sale record with the given `saleDate` stored in `sale_date`, generate an invoice number, snapshot the current product sale price into `sale_items`, decrement `physical_quantity` by 5, record a `SALE` stock movement, and return the saved sale details including `saleDate`

#### Scenario: Sale rejection on insufficient stock
- **WHEN** an Accountant attempts to create a sale for 8 units of Product A when only 5 units are available
- **THEN** the system SHALL abort the transaction with an InsufficientStockException and modify neither sale nor stock tables

### Requirement: Sale Modification with Delta Inventory Reconciliation
The system SHALL allow authorized users to edit existing sales, dynamically reconciling inventory based on the quantity delta between the original and modified line items, and updating sale header fields including `saleDate`.

#### Scenario: Increase item quantity during sale edit
- **WHEN** an Accountant edits a sale increasing Product A quantity from 3 to 7 (delta +4)
- **THEN** the system SHALL check that at least 4 available units exist, acquire a row lock, decrement `physical_quantity` by 4, update the sale item quantity to 7, and record the inventory difference

#### Scenario: Decrease item quantity during sale edit
- **WHEN** an Accountant edits a sale decreasing Product A quantity from 5 to 2 (delta -3)
- **THEN** the system SHALL increment `physical_quantity` by 3 without requiring availability checks, update the sale item quantity to 2, and update the sale total amount

#### Scenario: Remove line item from sale
- **WHEN** an Accountant edits a sale and removes a line item of 4 units of Product B
- **THEN** the system SHALL return all 4 units to `physical_quantity`, remove the line item, and recalculate the sale total

#### Scenario: Update sale transaction date
- **WHEN** an Accountant edits an existing sale and modifies the `saleDate`
- **THEN** the system SHALL update `sale_date` and `updated_at` timestamps for the sale record, preserving transactional integrity and invoice number

## ADDED Requirements

### Requirement: Sale Date Persistence and Multi-View Display
The system SHALL return and display the formatted sale transaction date (`saleDate`) across all sales views including the sales list table, the fiscal invoice preview modal, the sale edit modal, and dashboard recent sales.

#### Scenario: View sale list with formatted date
- **WHEN** an authenticated user navigates to the sales list page (`/sales`)
- **THEN** the table SHALL display the formatted sale date for each invoice row in the "Date de Vente" column

#### Scenario: View fiscal invoice modal with sale date
- **WHEN** a user clicks to view or print an invoice from the sales list
- **THEN** the invoice modal header SHALL display "Date : <formatted saleDate>"

#### Scenario: Pre-populate sale date in edit modal
- **WHEN** an authorized user opens the edit modal for an existing sale
- **THEN** the form SHALL include a "Date de Vente" input field pre-filled with the sale's current `saleDate`
