# Stock Reservations Specification

## Purpose
Provides transactional, concurrency-safe inventory reservations for inter-warehouse sale transfers and remote order fulfillments, preventing overselling via row-level locks, time-to-live (TTL) automated expiration, and manual cancellation stock restoration.

## Requirements

### Requirement: Granular Stock Reservation Tracking
The system SHALL persist individual stock reservation records (`stock_reservations`) linking each pending fulfillment line to a specific warehouse and product with quantity, status, and expiration timestamp.

#### Scenario: Creating a stock reservation upon inter-warehouse transfer
- **WHEN** a fulfillment line is created for Warehouse B requesting 10 units of Product X
- **THEN** the system inserts a row into `stock_reservations` with `status = 'ACTIVE'`, `reserved_quantity = 10`, `expires_at` computed from the selected TTL, and increments `stock.reserved_quantity` at Warehouse B by 10

#### Scenario: Active reservation inventory lock
- **WHEN** another customer or cashier queries available stock at Warehouse B
- **THEN** the system computes available quantity as `physical_quantity - reserved_quantity`, preventing the reserved units from being sold to walk-in customers

### Requirement: Atomic Concurrency and Anti-Overselling Lock
The system SHALL enforce atomic validation and row locking (`SELECT FOR UPDATE`) when creating or modifying stock reservations to prevent simultaneous race conditions from overselling inventory.

#### Scenario: Two cashiers simultaneously transferring the last available units
- **WHEN** Warehouse B has 10 units available, and Cashier 1 at Warehouse A and Cashier 2 at Warehouse C simultaneously attempt to reserve 10 units at Warehouse B
- **THEN** the system locks the stock row for Warehouse B during the first transaction, successfully reserving 10 units for Cashier 1, and rejects Cashier 2's request with an "Insufficient available stock" error

### Requirement: Reservation Expiration and Automated Stock Release
The system SHALL enforce a time-to-live (TTL, defaulting to 120 hours) on all active stock reservations, releasing reserved stock when an order is not picked up within the window.

#### Scenario: Expired reservation release
- **WHEN** an active reservation passes its `expires_at` timestamp without being fulfilled
- **THEN** the system marks the reservation as `EXPIRED`, updates the fulfillment line to `EXPIRED`, decrements `stock.reserved_quantity` by the reserved amount, and restores full available stock to the fulfilling warehouse

#### Scenario: Configurable TTL duration on order creation
- **WHEN** a cashier initiates an inter-warehouse transfer and selects an alternative TTL (such as 24 hours or 72 hours)
- **THEN** `stock_reservations.expires_at` is calculated based on the specified duration relative to creation time

### Requirement: Manual Reservation Cancellation
The system SHALL permit authorized managers at either the origin or destination warehouse to cancel an active reservation prior to expiration.

#### Scenario: Customer cancels order before pickup
- **WHEN** a manager cancels a pending pickup fulfillment line
- **THEN** the system transitions `stock_reservations.status` from `ACTIVE` to `CANCELLED`, releases the reserved units from `stock.reserved_quantity`, and marks the fulfillment line as `CANCELLED` without altering physical inventory
