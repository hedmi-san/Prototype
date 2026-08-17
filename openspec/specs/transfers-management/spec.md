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
The system SHALL allow the destination warehouse Manager to confirm reception of an approved transfer, transactionally moving stock from source to destination.

#### Scenario: Confirm reception of approved transfer
- **WHEN** Manager of Warehouse A confirms reception of an `APPROVED` transfer with 6 approved units from Warehouse B
- **THEN** the system SHALL update transfer status to `CONFIRMED`, decrement `physical_quantity` by 6 and `reserved_quantity` by 6 at Warehouse B with a `TRANSFER_OUT` movement, and increment `physical_quantity` by 6 at Warehouse A with a `TRANSFER_IN` movement

### Requirement: Transfer Cancellation and Reservation Release
The system SHALL permit the requesting warehouse Manager to cancel a transfer at any stage prior to confirmation, and permit the source Manager to decline it, releasing any reserved stock back to available stock.

#### Scenario: Requester cancels an approved transfer before confirmation
- **WHEN** Manager of Warehouse A cancels an `APPROVED` transfer with 6 reserved units at Warehouse B
- **THEN** the system SHALL transition status to `CANCELLED`, decrement `reserved_quantity` by 6 at Warehouse B (releasing 6 units back to available stock), and record an audit log

#### Scenario: Source warehouse declines request
- **WHEN** Manager of Warehouse B declines a `REQUESTED` transfer
- **THEN** the system SHALL transition status to `DECLINED` and record no stock changes

