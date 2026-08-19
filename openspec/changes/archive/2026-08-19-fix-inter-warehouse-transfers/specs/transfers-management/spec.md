## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Warehouse-Scoped Transfer Visibility and Action Authorization
The system SHALL isolate transfer records so that non-admin users can ONLY list, inspect, and perform workflow transitions on transfers where their assigned warehouse is either the source warehouse or the destination warehouse.

#### Scenario: User from uninvolved warehouse cannot view transfers
- **WHEN** a user assigned to Warehouse D queries the transfer list or requests details for a transfer between Warehouse A and Warehouse C
- **THEN** the system SHALL filter out that transfer from list queries and return a 403 Forbidden on direct detail requests

#### Scenario: Admin views all transfers across warehouses
- **WHEN** a global Admin queries the transfer list
- **THEN** the system SHALL return all transfers across all warehouses with options to filter by warehouse
