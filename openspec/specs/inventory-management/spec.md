# inventory-management Specification

## Purpose
TBD - created by archiving change multi-warehouse-tool-distribution-system. Update Purpose after archive.
## Requirements
### Requirement: Multi-Warehouse Inventory Tracking with Reservation Model
The system SHALL track stock per product and warehouse using `physical_quantity`, `reserved_quantity`, and derived `available_quantity` (`available_quantity = physical_quantity - reserved_quantity`), enforcing that none of these values can drop below zero.

#### Scenario: Verify available stock calculation
- **WHEN** a warehouse has 10 units in `physical_quantity` and 3 units in `reserved_quantity`
- **THEN** the system SHALL compute and display `available_quantity` as 7 units

#### Scenario: Database constraint prevents negative stock
- **WHEN** an operation attempts to reduce `physical_quantity` or `available_quantity` below zero
- **THEN** the database `CHECK` constraint and backend validation SHALL abort the transaction and raise an InsufficientStockException

### Requirement: Pessimistic Concurrency Control on Stock Mutations
The system SHALL execute all stock-altering operations inside a database transaction using pessimistic row-level locking (`SELECT ... FOR UPDATE`) on the target `(warehouse_id, product_id)` stock record.

#### Scenario: Concurrent stock deduction prevention
- **WHEN** two users attempt to simultaneously sell 6 units of a product having only 8 available units in a warehouse
- **THEN** the system SHALL process the first transaction, lock the stock row, reduce stock to 2 units, and immediately reject the second transaction due to insufficient available stock (2 < 6)

### Requirement: Stock Inflows via Initial Stock Movement
The system SHALL record stock received into warehouses from manufacturers or suppliers using the `INITIAL_STOCK` stock movement type and increment `physical_quantity`.

#### Scenario: Record initial stock receipt
- **WHEN** an authorized user logs an initial stock receipt of 50 units for a product in a warehouse
- **THEN** the system SHALL increase `physical_quantity` by 50, create a stock movement with type `INITIAL_STOCK`, and record the user and timestamp

### Requirement: Manual Stock Adjustments with Mandatory Reason
The system SHALL permit Managers and Accountants to manually increase or decrease warehouse stock, requiring a mandatory textual reason, and generating an `ADJUSTMENT` stock movement and audit log.

#### Scenario: Stock adjustment with valid reason
- **WHEN** an Accountant or Manager submits a stock adjustment of -2 units with reason "Damaged during packaging inspection"
- **THEN** the system SHALL verify available stock is sufficient, decrease `physical_quantity` by 2, record an `ADJUSTMENT` stock movement with the provided reason, and log an audit entry

#### Scenario: Reject stock adjustment missing reason
- **WHEN** a user attempts to submit a stock adjustment with an empty or blank reason
- **THEN** the system SHALL reject the request with a validation error and perform no stock modifications

### Requirement: Stock Movements Audit Ledger Query and Representation
The system SHALL expose and display complete stock movement records with unified attributes including movement type, delta quantity with sign, warehouse name, product reference and name, and reason/reference across both global views and warehouse-filtered queries.

#### Scenario: Query stock movements with full details
- **WHEN** an authenticated user requests stock movements via `GET /api/inventory/movements`
- **THEN** the API SHALL return an array of movement objects containing `id`, `warehouseId`, `warehouseName`, `productId`, `productName`, `productReference`, `type`, `movementType`, `quantity`, `quantityChange`, `reference`, `notes`, `reason`, and `createdAt`

#### Scenario: Display stock movement ledger in frontend
- **WHEN** a user visits the `/movements` page
- **THEN** each movement row SHALL display the formatted timestamp, warehouse name, product name with reference, movement type badge (such as 'Stock initial', 'Sortie Vente', 'Ajustement inventaire', 'Transfert entrant', 'Transfert sortant'), signed delta quantity with color coding, and reason or reference note

### Requirement: Server-Side Paginated Stock Movements with Period Navigation
The system SHALL provide server-side pagination and historical period filtering for the stock movements endpoint (`GET /api/inventory/movements`), accepting `page`, `limit`, `startDate`, `endDate`, `search`, `type`, and `warehouseId` query parameters, returning a paginated response with the movement items slice and pagination metadata.

#### Scenario: Query stock movements with date filter and pagination
- **WHEN** an authenticated user queries stock movements for the month of February 2025 with `page=1` and `limit=50`
- **THEN** the system SHALL return up to 50 movements created between 2025-02-01 and 2025-02-28, along with total matching records count

#### Scenario: Stock movements view renders period navigator
- **WHEN** a user navigates to the stock movements view (`/movements`)
- **THEN** the interface SHALL display the `AppPeriodNavigator` component, allowing granular date stepping (`Jour`, `Semaine`, `Mois`, `Trimestre`, `Année`) and instant jumping to historical stock audit periods

### Requirement: High-Performance Database Indexing for Stock Movements
The system SHALL maintain composite database indexes on `stock_movements(created_at, warehouse_id)` and `stock_movements(movement_type, created_at)` to support rapid range scans across high volumes of stock transactions.

#### Scenario: High-volume movement range scan
- **WHEN** a query requests stock movements over a historical date range on a table containing 500,000+ movements
- **THEN** the database SHALL utilize the composite index on `created_at` to avoid full table scans and execute in under 10 milliseconds

### Requirement: Typeahead Product Search for Stock Receipts
The inventory stock reception interface SHALL provide a searchable typeahead combobox allowing users to filter and select products by reference, name, brand, or category from the cached product catalog, omitting current stock quantity badges and updating the receipt form selection upon confirmation.

#### Scenario: User searches product by reference or name in receipt modal
- **WHEN** a user opens the manufacturer stock receipt modal and types a search query (e.g. "BOSCH" or "226") in the product combobox
- **THEN** the combobox SHALL display matching products in a dropdown limited to top results showing product reference, name, brand, and unit sale price without rendering warehouse stock availability badges

#### Scenario: User selects a product for receipt
- **WHEN** a user selects a product from the combobox dropdown or presses Enter on a highlighted result
- **THEN** the combobox SHALL update the receipt form's product ID, format the input with the selected product reference and name, and allow the user to submit the stock receipt

### Requirement: Server-Side Paginated Stock Query and Filtering
The system SHALL provide server-side pagination and status filtering for the stock inventory query (`GET /api/inventory/stock`), accepting `page`, `limit`, `warehouseId`, `status` (`all`, `normal`, `low`, `out`), and `search` query parameters, returning a paginated payload containing the stock records slice, pagination metadata, and aggregate status counts.

#### Scenario: Query stock with default pagination
- **WHEN** an authenticated user requests stock without explicit pagination parameters
- **THEN** the system SHALL return page 1 with a default limit (25 items), total record count, total pages, and aggregate counters for total, normal, low stock, and out-of-stock items

#### Scenario: Filter stock by status
- **WHEN** an authenticated user queries stock with `status=low`
- **THEN** the system SHALL return only stock items where available quantity is strictly greater than 0 and less than or equal to the product's `min_stock_alert`

#### Scenario: Filter stock by out-of-stock status
- **WHEN** an authenticated user queries stock with `status=out`
- **THEN** the system SHALL return only stock items where available quantity is less than or equal to 0

#### Scenario: Filter stock by normal status
- **WHEN** an authenticated user queries stock with `status=normal`
- **THEN** the system SHALL return only stock items where available quantity is strictly greater than the product's `min_stock_alert`

#### Scenario: Debounced search across product references and names
- **WHEN** an authenticated user queries stock with `search=perceuse`
- **THEN** the system SHALL return matching stock items where product name, reference, brand, or warehouse name matches the search term (case-insensitive)

### Requirement: High-Performance Database Indexing for Stock Queries
The system SHALL maintain database indexes on `stock(product_id)`, `products(reference)`, `products(name)`, and `products(brand)` to support high-throughput concurrent reads, fast search filtering, and non-blocking index scans on catalogs exceeding 1,000 products.

#### Scenario: High-volume stock catalog query
- **WHEN** a paginated stock query is executed on a warehouse with 5,000+ stock rows
- **THEN** the database SHALL execute join and pagination queries utilizing index scans with an execution time under 15 milliseconds

