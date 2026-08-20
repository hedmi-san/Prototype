# transfers-management Specification

## Purpose
TBD - created by archiving change multi-warehouse-tool-distribution-system. Update Purpose after archive.
## Requirements
### Requirement: Inter-Warehouse Transfer Request Creation
The system SHALL allow Managers to create transfer requests from a source warehouse to their destination warehouse specifying requested products and quantities.

#### Scenario: Create a transfer request
- **WHEN** Manager of Warehouse A creates a transfer request asking for 10 units of Product X from Warehouse B
- **THEN** the system SHALL create the transfer in `REQUESTED` status with line item `requested_quantity = 10` and `approved_quantity = 0`

### Requirement: Transfer Approval with Source Stock Reservation
The system SHALL allow the source warehouse Manager to approve a transfer request with partial or full quantities, reserving the approved quantities in the source warehouse inventory without physically deducting them yet.

#### Scenario: Approve transfer and reserve stock
- **WHEN** Manager of Warehouse B approves a transfer request for 10 units with `approved_quantity = 6`
- **THEN** the system SHALL verify Warehouse B has at least 6 available units, increment `reserved_quantity` by 6 at Warehouse B, update transfer status to `APPROVED`, and leave `physical_quantity` unchanged

#### Scenario: Reject approval exceeding available stock
- **WHEN** Manager of Warehouse B attempts to approve 12 units when only 8 are available
- **THEN** the system SHALL reject the approval with an InsufficientStockException and modify no reservations

### Requirement: Transfer Reception Confirmation and Stock Transfer
The system SHALL allow the destination warehouse Manager or an Admin to confirm reception of an approved transfer, transactionally moving stock from source to destination, recording the confirmation timestamp (`confirmed_at`), and generating `TRANSFER_OUT` and `TRANSFER_IN` stock movements.

#### Scenario: Confirm reception of approved transfer
- **WHEN** Manager of Warehouse A or Admin confirms reception of an `APPROVED` transfer with 6 approved units from Warehouse B
- **THEN** the system SHALL set transfer status to `CONFIRMED`, record `confirmed_at` with current timestamp, decrement `physical_quantity` by 6 and `reserved_quantity` by 6 at Warehouse B with a `TRANSFER_OUT` movement, and increment `physical_quantity` by 6 at Warehouse A with a `TRANSFER_IN` movement

#### Scenario: Reject confirmation from unauthorized warehouse user
- **WHEN** a user who is not the destination warehouse Manager and not an Admin attempts to confirm reception of a transfer
- **THEN** the system SHALL reject the request with a 403 Forbidden error and make no state or stock changes

### Requirement: Transfer Cancellation and Reservation Release
The system SHALL permit only the requesting user, destination warehouse Manager, or an Admin to cancel a transfer prior to confirmation (`REQUESTED` or `APPROVED` statuses), and permit only the source warehouse Manager or Admin to decline it, releasing any reserved stock back to available stock. A transfer in `CONFIRMED` status SHALL NOT be cancelable.

#### Scenario: Requester cancels an approved transfer before confirmation
- **WHEN** Manager of Warehouse A cancels an `APPROVED` transfer with 6 reserved units at Warehouse B
- **THEN** the system SHALL transition status to `CANCELLED`, decrement `reserved_quantity` by 6 at Warehouse B (releasing 6 units back to available stock), and record an audit log

#### Scenario: Reject cancellation of confirmed transfer
- **WHEN** any user attempts to cancel a transfer that has already been `CONFIRMED`
- **THEN** the system SHALL reject the request with a validation error and keep the transfer in `CONFIRMED` status

#### Scenario: Reject cancellation from uninvolved warehouse
- **WHEN** an Accountant or Manager from Warehouse D attempts to cancel a transfer between Warehouse A and Warehouse C
- **THEN** the system SHALL reject the request with a 403 Forbidden error

#### Scenario: Source warehouse declines request
- **WHEN** Manager of Warehouse B declines a `REQUESTED` transfer
- **THEN** the system SHALL transition status to `DECLINED` and record no stock changes

### Requirement: Warehouse-Scoped Transfer Visibility and Action Authorization
The system SHALL isolate transfer records so that non-admin users can ONLY list, inspect, and perform workflow transitions on transfers where their assigned warehouse is either the source warehouse or the destination warehouse.

#### Scenario: User from uninvolved warehouse cannot view transfers
- **WHEN** a user assigned to Warehouse D queries the transfer list or requests details for a transfer between Warehouse A and Warehouse C
- **THEN** the system SHALL filter out that transfer from list queries and return a 403 Forbidden on direct detail requests

#### Scenario: Admin views all transfers across warehouses
- **WHEN** a global Admin queries the transfer list
- **THEN** the system SHALL return all transfers across all warehouses with options to filter by warehouse

### Requirement: Real-Time Product Search and Source Warehouse Stock Combobox in Transfers
The inter-warehouse transfer request interface SHALL provide a typeahead search combobox enabling users to search products by partial names, references, or brands, displaying immediate matching results limited to top relevant items along with real-time available stock indicators for the selected source warehouse, and dynamically updating stock indicator availability when the source warehouse is changed.

#### Scenario: User searches product by reference or name in transfer line item
- **WHEN** a user enters a search query (e.g. "DCD796" or "Hammer Drill") in a transfer request line item combobox
- **THEN** the combobox SHALL display a dropdown of matching products showing product reference, name, brand, unit price, and real-time available stock status for the chosen source warehouse

#### Scenario: User changes source warehouse in transfer request
- **WHEN** a user modifies the source warehouse in the transfer request modal
- **THEN** the system SHALL re-fetch or update the stock availability for the newly selected source warehouse, and the comboboxes SHALL update their stock indicator badges accordingly

#### Scenario: User selects a product from the combobox in transfer request
- **WHEN** a user clicks or presses Enter on a search result in the transfer line item
- **THEN** the combobox SHALL update the line item's selected product ID, populate the search field with the selected product label, close the dropdown, and preserve transfer validation

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


