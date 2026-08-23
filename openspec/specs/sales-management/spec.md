# sales-management Specification

## Purpose
TBD - created by archiving change multi-warehouse-tool-distribution-system. Update Purpose after archive.
## Requirements
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

### Requirement: Dynamic In-Place Unit Sale Price Adjustment
The point-of-sale invoicing interface (`CreateSaleView.vue`) and edit modal (`SalesListView.vue`) SHALL provide an editable unit price number input for each line item initialized with the selected product's default catalog price, dynamically recalculating line subtotal (`quantity * unitPrice`) and total payable amount in real time whenever the unit price is modified.

#### Scenario: Cashier adjusts unit price in POS line item
- **WHEN** a cashier selects a product with catalog price 1500 DA and changes the unit price input to 1400 DA for quantity 2
- **THEN** the line item subtotal SHALL instantly recalculate to 2800 DA, and the invoice total amount summary SHALL reflect the updated sum

#### Scenario: Cashier selects a new product for a line item
- **WHEN** a cashier changes the selected product in an existing line item combobox
- **THEN** the unit price input SHALL automatically update to the newly selected product's catalog sale price, recalculating line subtotal and total amount

### Requirement: Invoice Issuer and Worker Follow-up Attribution and Multi-View Display
The system SHALL store and expose the warehouse worker/employee who followed up with the customer ("Agent de suivi : [Worker Name]") across the sales list table, fiscal invoice viewer modal, invoice print view, and sale edit modal.

#### Scenario: Display issuer and follow-up worker in invoice preview modal
- **WHEN** a user opens the fiscal invoice modal for a completed sale
- **THEN** the invoice header/metadata section SHALL display "Émise par : [User Full Name]" and "Agent de suivi : [Assisting Worker Full Name]" (or fallback placeholder if unassigned)

#### Scenario: Display follow-up worker in sales list table
- **WHEN** an authenticated user views the sales list table
- **THEN** the table SHALL display the worker who handled the customer follow-up in the "Agent de suivi" column

#### Scenario: Select follow-up worker in POS creation form
- **WHEN** an accountant or cashier loads the sale creation form
- **THEN** the form SHALL render a worker/employee selection dropdown populated with active employees of the active warehouse, allowing the user to select the worker who assisted the customer on the warehouse floor

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

### Requirement: Real-Time Product Search and Stock Indicator Combobox
The point-of-sale invoicing interface SHALL provide a typeahead search combobox enabling cashiers to search products by typing partial names or references, displaying immediate matching results limited to top relevant items along with warehouse-specific available stock indicators, and emitting product selection events without altering subtotal calculations or checkout validation.

#### Scenario: Cashier searches product by reference or name
- **WHEN** a cashier enters a search query (e.g. "DCD796" or "Hammer Drill") in the invoice line item combobox
- **THEN** the combobox SHALL display a dropdown of up to 10 matching products showing product reference, name, brand, unit sale price, and real-time available stock count for the selected warehouse

#### Scenario: Cashier selects a product from the combobox
- **WHEN** a cashier clicks or presses Enter on a search result
- **THEN** the combobox SHALL update the line item's selected product ID, populate the input with the selected product title, close the dropdown, and update line item price and subtotal calculations

### Requirement: Sale Date Persistence and Multi-View Display
The system SHALL store, return, and display the formatted sale transaction timestamp (`saleDate`) with full date and time precision including hours, minutes, and seconds (`DD/MM/YYYY HH:mm:ss`) across all sales views including the sales list table, the fiscal invoice preview modal, the sale edit modal, and dashboard recent sales.

#### Scenario: View sale list with formatted date
- **WHEN** an authenticated user navigates to the sales list page (`/sales`)
- **THEN** the table SHALL display the formatted sale date and time with seconds (e.g. `20/08/2026 14:30:15`) for each invoice row in the "Date de Vente" column

#### Scenario: View fiscal invoice modal with sale date
- **WHEN** a user clicks to view or print an invoice from the sales list
- **THEN** the invoice modal header SHALL display the exact fiscal issue timestamp "Date : <formatted saleDate with seconds>"

#### Scenario: Pre-populate sale date in edit modal
- **WHEN** an authorized user opens the edit modal for an existing sale
- **THEN** the form SHALL include a "Date de Vente" datetime-local input field with step="1" precision pre-filled with the sale's current `saleDate` including seconds

### Requirement: Server-Side Paginated Sales Records with Period Navigation
The system SHALL provide server-side pagination and historical period filtering for the sales list endpoint (`GET /api/sales`), accepting `page`, `limit`, `startDate`, `endDate`, `search`, and `warehouseId` query parameters, returning a standardized paginated response containing the records slice and pagination metadata (`page`, `limit`, `total`, `totalPages`).

#### Scenario: Query sales with pagination and date range
- **WHEN** an authenticated user requests page 2 of sales with `limit=25`, `startDate="2025-01-01"`, and `endDate="2025-03-31"`
- **THEN** the system SHALL execute an indexed query returning at most 25 sales matching the date boundary, along with accurate `total` count and computed `totalPages` for pagination controls

#### Scenario: Sales list view renders period navigator and pagination
- **WHEN** a user visits the `/sales` page
- **THEN** the interface SHALL render the `AppPeriodNavigator` synchronized with the active date range, display paginated records in the table, and provide page stepper controls with page size configuration

### Requirement: High-Performance Database Indexing and Batch Item Retrieval for Sales
The system SHALL eliminate N+1 SQL item queries by batch-fetching sale items using a single `WHERE sale_id IN (...)` query for the paginated slice of sales, and maintain composite B-tree indexes on `(sale_date, warehouse_id)` and `(created_at, warehouse_id)` for sub-millisecond query execution at scale.

#### Scenario: Batch loading sale items for paginated results
- **WHEN** a paginated page of 25 sales is fetched from the database
- **THEN** the backend SHALL retrieve all line items for those 25 sales in a single batch query rather than executing 25 separate queries

### Requirement: Standardized A4 Commercial Invoice and Print Engine
The system SHALL provide a standardized A4 commercial invoice ("Bon de Caisse / Vente") layout and print engine that replicates physical Algerian distribution trade documents. The document header SHALL prominently feature the company name (`EURL BOUSFOR GEN TRADING IMP.EXP`), the active warehouse/showroom name (e.g. `SHOWROOM BOUSFOR`), and contact telephone numbers (`05.50.38.30.49 --- 07.77.12.86.39` or warehouse phone). The metadata section SHALL display document type (`Vente`), document reference (`Bon de Caisse N° [Number]`), client name (`Client : [Name]`), an SVG-rendered 1D barcode encoding the transaction/invoice number, transaction date (`Date du Bon [DD/MM/YYYY]`), print timestamp (`Imprimer le : DD/MM/YYYY à HH:mm:ss`), pagination (`Page N°: 1/1`), and distinct line item count (`Nombre de Produits : [N]`). The items table SHALL include a verification check box `[ ]` column for warehouse pickers, product reference (`Code Art.`), designation (`Désignation`), quantity (`Quantité`), unit price (`Prix`), and line subtotal (`Total`). The footer summary SHALL display customer balance (`Solde : 0.00`), serving cashier/staff attribution (`Servi Par : [Name]`), and total payable amount (`Total : [Amount]`).

#### Scenario: View standardized A4 invoice in preview modal
- **WHEN** an authenticated user opens the invoice preview for a sale
- **THEN** the interface SHALL render the complete A4 invoice document matching the company trade format with company name, warehouse showroom, telephone numbers, barcode, items table with picker checkboxes, and summary footer (Solde, Servi Par, Total)

#### Scenario: Print invoice to A4 paper without UI artifacts
- **WHEN** a user triggers the print action for an invoice
- **THEN** the system SHALL apply dedicated `@media print` styling isolating the invoice content onto standard A4 portrait geometry, hiding all modals, overlays, app bars, navigation sidebars, and action buttons, producing a crisp vector document suitable for physical printing or PDF saving

#### Scenario: Dynamic barcode generation on invoice
- **WHEN** an invoice is displayed or prepared for printing
- **THEN** the system SHALL render a scannable Code 128 1D vector barcode corresponding to the sale's invoice identifier alongside the formatted numeric barcode string

#### Scenario: Picker verification checkboxes in item table
- **WHEN** warehouse pickers or cashiers view or print the invoice document
- **THEN** each row in the items table SHALL include an empty square checkbox `[ ]` for manual physical picking confirmation



