## ADDED Requirements

### Requirement: Excel File Parsing and Pre-Flight Validation
The system SHALL parse exported legacy Excel spreadsheets (`.xlsx`) in the browser and validate columns and data types before executing the import.

#### Scenario: User selects an Excel file for import
- **WHEN** the user uploads a valid `.xlsx` file containing product and inventory columns
- **THEN** the system parses the sheet in-memory, maps the required columns (`Code`, `Désignation`, `Stock`, `Pu Achat`, `Prix Vente Gros`, `TVA`, `Qté/ Cart.`, `Stock Alerte`), displays total row count, preview rows, and flags any data anomalies

#### Scenario: User uploads an invalid file or missing required columns
- **WHEN** the user uploads a file lacking the required `Code` or `Stock` columns
- **THEN** the system displays a descriptive validation error and blocks import execution

### Requirement: Canonical Code Deduplication and Catalog Immutability
The system SHALL use `Code` (`products.reference`) as the sole canonical identifier to deduplicate products and maintain master catalog immutability.

#### Scenario: Importing a product that already exists in the catalog
- **WHEN** an import row contains a `Code` matching an existing product in `products`
- **THEN** the system leaves the existing product's master fields (`name`, `purchase_price`, `sale_price`, `tva`, `box_size`, `min_stock_alert`) unchanged, and updates/creates the inventory stock record for the target warehouse

#### Scenario: Importing a new product that does not exist in the catalog
- **WHEN** an import row contains a `Code` that does not exist in `products`
- **THEN** the system inserts a new product into `products` with the provided attributes and creates the inventory stock record for the target warehouse

### Requirement: Resilient Data Sanitization and Zero-Stock Clamping
The system SHALL sanitize legacy data formats, tolerate corrupted text in numeric columns, and clamp negative or unparseable quantities to zero.

#### Scenario: Stock column contains text or invalid values
- **WHEN** an Excel row contains non-numeric text in the stock column (such as `"TOURNEVIS"`) or a negative quantity
- **THEN** the system clamps the physical stock quantity to `0`, generates a non-blocking warning in the validation preview, and creates the product with `0` stock

#### Scenario: Price fields contain comma decimals or extra spaces
- **WHEN** an Excel row contains prices formatted with commas (e.g. `"146,70"`) or whitespace
- **THEN** the system converts the comma to a standard decimal point (`146.70`) and parses it as a valid numeric amount

### Requirement: Warehouse-Scoped Inventory and Audit Tracking
The system SHALL allocate imported inventory to the selected warehouse scope and record initial stock movement history.

#### Scenario: Admin imports stock for a specific warehouse
- **WHEN** an authenticated user with `ADMIN` role selects a target warehouse and confirms the import
- **THEN** stock records in `stock` are upserted for that specific `warehouse_id`, and an audit record is created in `stock_movements` with `movement_type = 'INITIAL_STOCK'`

#### Scenario: Warehouse Manager imports stock
- **WHEN** an authenticated user with `MANAGER` role executes an import
- **THEN** the import is strictly constrained to the manager's assigned `warehouse_id`, preventing any cross-warehouse modification

### Requirement: High-Performance Chunked Batch Processing
The system SHALL process bulk imports in batches of up to 1,000 items per request using set-based PostgreSQL bulk upserts.

#### Scenario: Processing a 7,000 product spreadsheet
- **WHEN** the user initiates an import of 7,000 products
- **THEN** the frontend transmits data in sequential chunks of 1,000 items to `POST /api/products/import-batch`, each chunk executes within a single database transaction in under 250ms, and the UI displays an animated progress bar with percentage completion

### Requirement: Import Trigger and Interactive Modal
The system SHALL provide an accessible import button and interactive modal within the product and inventory interfaces.

#### Scenario: Accessing import from Product List view
- **WHEN** an admin or manager views `ProductListView.vue`
- **THEN** an "Importer Excel" button is visible in the actions bar, opening the import modal upon click

#### Scenario: Accessing import from Stock view
- **WHEN** an admin or manager views `StockView.vue`
- **THEN** an "Importer Excel" button is visible, opening the import modal with the active warehouse pre-selected
