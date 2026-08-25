## ADDED Requirements

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
