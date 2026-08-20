## ADDED Requirements

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
