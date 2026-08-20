## ADDED Requirements

### Requirement: Server-Side Paginated Transfer Records with Period Navigation
The system SHALL provide server-side pagination and historical period filtering for the transfer records endpoint (`GET /api/transfers`), accepting `page`, `limit`, `startDate`, `endDate`, `search`, `status`, and `warehouseId` query parameters, returning a standardized paginated response.

#### Scenario: Query transfers with pagination and date filter
- **WHEN** an authenticated user queries transfers with `startDate="2025-06-01"`, `endDate="2025-06-30"`, `page=1`, and `limit=25`
- **THEN** the system SHALL return the matching transfers slice with accurate total count and total pages respecting user warehouse scoping rules

#### Scenario: Transfer records list view renders period navigator
- **WHEN** a user navigates to the transfer list view (`/transfers`)
- **THEN** the interface SHALL render `AppPeriodNavigator` allowing navigation across past quarters and years, alongside status filters and pagination controls

### Requirement: High-Performance Database Indexing and Batch Item Retrieval for Transfers
The system SHALL eliminate N+1 item queries by batch-fetching transfer items using a single `WHERE transfer_id IN (...)` query for the paginated slice of transfers, and maintain composite database indexes on `transfers(created_at, source_warehouse_id, destination_warehouse_id)` and `transfer_items(transfer_id)`.

#### Scenario: Batch loading transfer items
- **WHEN** a paginated page of transfers is fetched
- **THEN** the backend SHALL retrieve all line items for all returned transfers in a single batched query
