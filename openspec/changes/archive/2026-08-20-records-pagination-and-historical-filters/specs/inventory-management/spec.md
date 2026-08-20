## ADDED Requirements

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
