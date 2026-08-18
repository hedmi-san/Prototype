# sales-management Specification

## Purpose
TBD - created by archiving change multi-warehouse-tool-distribution-system. Update Purpose after archive.
## Requirements
### Requirement: Transactional Sale Creation and Invoice Numbering
The system SHALL create sales transactionally, validating available inventory for every line item, snapshotting the unit price into `sale_items`, decrementing `physical_quantity`, logging `SALE` stock movements, and generating an invoice number.

#### Scenario: Successful sale creation
- **WHEN** an Accountant creates a sale with 5 units of Product A in their assigned warehouse where 10 units are available
- **THEN** the system SHALL create the sale record with an invoice number, snapshot the current product sale price into `sale_items`, decrement `physical_quantity` by 5, record a `SALE` stock movement, and return the saved sale details

#### Scenario: Sale rejection on insufficient stock
- **WHEN** an Accountant attempts to create a sale for 8 units of Product A when only 5 units are available
- **THEN** the system SHALL abort the transaction with an InsufficientStockException and modify neither sale nor stock tables

### Requirement: Sale Modification with Delta Inventory Reconciliation
The system SHALL allow authorized users to edit existing sales, dynamically reconciling inventory based on the quantity delta between the original and modified line items.

#### Scenario: Increase item quantity during sale edit
- **WHEN** an Accountant edits a sale increasing Product A quantity from 3 to 7 (delta +4)
- **THEN** the system SHALL check that at least 4 available units exist, acquire a row lock, decrement `physical_quantity` by 4, update the sale item quantity to 7, and record the inventory difference

#### Scenario: Decrease item quantity during sale edit
- **WHEN** an Accountant edits a sale decreasing Product A quantity from 5 to 2 (delta -3)
- **THEN** the system SHALL increment `physical_quantity` by 3 without requiring availability checks, update the sale item quantity to 2, and update the sale total amount

#### Scenario: Remove line item from sale
- **WHEN** an Accountant edits a sale and removes a line item of 4 units of Product B
- **THEN** the system SHALL return all 4 units to `physical_quantity`, remove the line item, and recalculate the sale total

### Requirement: Sale Voiding and Cancellation with Inventory Reversal
The system SHALL support cancelling or voiding sales without hard-deleting records, updating the sale status to `CANCELLED`, restoring physical stock via compensating movements, and maintaining invoice audit history.

#### Scenario: Void an existing sale
- **WHEN** an Accountant or Manager cancels an active sale containing 5 units of Product A
- **THEN** the system SHALL set the sale status to `CANCELLED`, increment `physical_quantity` by 5, record compensating stock movements, and retain the original invoice number and audit logs for traceability

### Requirement: Historical Sales Range Filtering and Aggregation
The system SHALL support querying and aggregating completed sales transactions across configurable start and end dates with warehouse scoping.

#### Scenario: Query sales within custom date boundaries
- **WHEN** an authenticated user requests sales records with `startDate="2026-07-01"` and `endDate="2026-07-31"`
- **THEN** the system SHALL return all completed sales whose `created_at` timestamp falls within the inclusive date boundary, respecting the user's warehouse authorization scope


