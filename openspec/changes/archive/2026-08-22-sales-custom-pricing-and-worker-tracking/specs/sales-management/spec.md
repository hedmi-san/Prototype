## MODIFIED Requirements

### Requirement: Transactional Sale Creation and Invoice Numbering
The system SHALL create sales transactionally, validating available inventory for every line item, snapshotting the specified or default unit price into `sale_items`, decrementing `physical_quantity`, logging `SALE` stock movements, persisting the explicit or defaulted sale transaction date (`sale_date`), recording the authenticated user as the creator/issuer (`user_id`), optionally persisting the assigned warehouse worker/employee who followed up with the customer (`employee_id`), and generating an invoice number.

#### Scenario: Successful sale creation with custom unit prices
- **WHEN** an Accountant creates a sale with 5 units of Product A (catalog price 1000 DA) with custom unit price 950 DA, and assigns follow-up worker Employee X
- **THEN** the system SHALL create the sale record with an invoice number, snapshot 950 DA into `sale_items.unit_price`, set subtotal to 4750 DA, associate `user_id` with the authenticated accountant, associate `employee_id` with Employee X, decrement `physical_quantity` by 5, record a `SALE` stock movement, persist `sale_date`, and return the saved sale details including `userName`, `employeeId`, and `employeeName`

#### Scenario: Successful sale creation with explicit sale date and default catalog price
- **WHEN** an Accountant or Cashier creates a sale with 5 units of Product A in their assigned warehouse where 10 units are available, providing an explicit `saleDate` ("2026-08-20 14:30:00") without overriding unit price
- **THEN** the system SHALL create the sale record with the given `saleDate` stored in `sale_date`, generate an invoice number, snapshot the current product catalog sale price into `sale_items`, decrement `physical_quantity` by 5, record a `SALE` stock movement, and return the saved sale details including `saleDate` and `createdByName`

#### Scenario: Sale rejection on insufficient stock
- **WHEN** an Accountant attempts to create a sale for 8 units of Product A when only 5 units are available
- **THEN** the system SHALL abort the transaction with an InsufficientStockException and modify neither sale nor stock tables

### Requirement: Sale Modification with Delta Inventory Reconciliation
The system SHALL allow authorized users to edit existing sales, dynamically reconciling inventory based on the quantity delta between the original and modified line items, updating custom unit prices, updating the assigned follow-up worker (`employee_id`), and updating sale header fields including `saleDate`.

#### Scenario: Increase item quantity and adjust unit price during sale edit
- **WHEN** an Accountant edits a sale increasing Product A quantity from 3 to 7 (delta +4) and adjusting unit price from 1000 DA to 900 DA
- **THEN** the system SHALL check that at least 4 available units exist, acquire a row lock, decrement `physical_quantity` by 4, update the sale item quantity to 7 and unit price to 900 DA, update the total amount to 6300 DA, and record the inventory difference

#### Scenario: Decrease item quantity during sale edit
- **WHEN** an Accountant edits a sale decreasing Product A quantity from 5 to 2 (delta -3)
- **THEN** the system SHALL increment `physical_quantity` by 3 without requiring availability checks, update the sale item quantity to 2, and update the sale total amount

#### Scenario: Update assigned worker on existing sale
- **WHEN** an Accountant edits an existing sale and modifies the assigned `employeeId`
- **THEN** the system SHALL update `employee_id` on the sale record and return the updated `employeeName`

#### Scenario: Remove line item from sale
- **WHEN** an Accountant edits a sale and removes a line item of 4 units of Product B
- **THEN** the system SHALL return all 4 units to `physical_quantity`, remove the line item, and recalculate the sale total

#### Scenario: Update sale transaction date
- **WHEN** an Accountant edits an existing sale and modifies the `saleDate`
- **THEN** the system SHALL update `sale_date` and `updated_at` timestamps for the sale record, preserving transactional integrity and invoice number

## ADDED Requirements

### Requirement: Dynamic In-Place Unit Sale Price Adjustment
The point-of-sale invoicing interface (`CreateSaleView.vue`) and edit modal (`SalesListView.vue`) SHALL provide an editable unit price number input for each line item initialized with the selected product's default catalog price, dynamically recalculating line subtotal (`quantity * unitPrice`) and total payable amount in real time whenever the unit price is modified.

#### Scenario: Cashier adjusts unit price in POS line item
- **WHEN** a cashier selects a product with catalog price 1500 DA and changes the unit price input to 1400 DA for quantity 2
- **THEN** the line item subtotal SHALL instantly recalculate to 2800 DA, and the invoice total amount summary SHALL reflect the updated sum

#### Scenario: Cashier selects a new product for a line item
- **WHEN** a cashier changes the selected product in an existing line item combobox
- **THEN** the unit price input SHALL automatically update to the newly selected product's catalog sale price, recalculating line subtotal and total amount

### Requirement: Invoice Issuer and Worker Follow-up Attribution and Multi-View Display
The system SHALL store and expose both the authenticated user who recorded the sale ("Émise par : [User Name]") and the warehouse worker/employee who followed up with the customer ("Agent de suivi / Conseiller : [Worker Name]") across the sales list table, fiscal invoice viewer modal, invoice print view, and sale edit modal.

#### Scenario: Display issuer and follow-up worker in invoice preview modal
- **WHEN** a user opens the fiscal invoice modal for a completed sale
- **THEN** the invoice header/metadata section SHALL display "Émise par : [User Full Name]" and "Agent de suivi : [Assisting Worker Full Name]" (or fallback placeholder if unassigned)

#### Scenario: Display issuer and follow-up worker in sales list table
- **WHEN** an authenticated user views the sales list table
- **THEN** the table SHALL display columns or badges identifying the user who created the invoice ("Émis par") and the worker who handled the customer follow-up ("Agent de suivi")

#### Scenario: Select follow-up worker in POS creation form
- **WHEN** an accountant or cashier loads the sale creation form
- **THEN** the form SHALL render a worker/employee selection dropdown populated with active employees of the active warehouse, allowing the user to select the worker who assisted the customer on the warehouse floor
