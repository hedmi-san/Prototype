## ADDED Requirements

### Requirement: Inactive Warehouse Transfer Restrictions
The system SHALL prevent creating new inter-warehouse transfer requests that specify an inactive warehouse as either the source or destination.

#### Scenario: Block transfer request with inactive source warehouse
- **WHEN** a user attempts to create a transfer request specifying an inactive warehouse as `source_warehouse_id`
- **THEN** the system SHALL reject the request with an HTTP 400 Bad Request error indicating that transfers cannot be sourced from an inactive warehouse

#### Scenario: Block transfer request with inactive destination warehouse
- **WHEN** a user attempts to create a transfer request specifying an inactive warehouse as `destination_warehouse_id`
- **THEN** the system SHALL reject the request with an HTTP 400 Bad Request error indicating that transfers cannot be directed to an inactive warehouse

### Requirement: Pending Transfers Resolution Check for Deactivation
The system SHALL verify that all inter-warehouse transfers involving a warehouse are in final statuses (`CONFIRMED`, `CANCELLED`, or `DECLINED`) before deactivation can proceed.

#### Scenario: Prevent deactivation during active transfer in transit
- **WHEN** a deactivation request is received for a warehouse involved in an `APPROVED` transfer currently in transit
- **THEN** the system SHALL block the deactivation and require confirming reception or cancelling the transfer first

### Requirement: Multi-Destination Stock Relocation and Liquidation Matrix
The system SHALL provide a bulk stock relocation endpoint (`POST /api/transfers/bulk-relocation`) and interactive matrix interface allowing Admins to distribute inventory from a source warehouse across one or more active destination warehouses in a single atomic transaction.

#### Scenario: Admin relocates stock across multiple destination warehouses with immediate execution
- **WHEN** an Admin submits a bulk relocation payload distributing available stock from Warehouse A to Warehouse B and Warehouse C with `immediateExecution = true`
- **THEN** the system SHALL generate separate transfer records for Warehouse B and Warehouse C in `CONFIRMED` status, decrement physical stock at Warehouse A with `TRANSFER_OUT` movements, increment physical stock at Warehouse B and C with `TRANSFER_IN` movements, and log a `BULK_STOCK_RELOCATION` audit entry

#### Scenario: Reject bulk relocation exceeding source stock availability
- **WHEN** an Admin submits a bulk relocation where the total allocated quantity of a product across destinations exceeds the source warehouse's physical available quantity
- **THEN** the system SHALL reject the transaction with an HTTP 400 InsufficientStock error and make no state changes
