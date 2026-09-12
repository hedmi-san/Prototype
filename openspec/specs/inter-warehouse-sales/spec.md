# Inter-Warehouse Sales Specification

## Purpose
Allows customers at an origin warehouse to purchase goods fulfilled by one or more destination warehouses (supporting full transfer or split fulfillment), with independent payment collection routing, automated stock reservations, printable pickup slips (bons de retrait), and inter-branch treasury settlement tracking.

## Requirements

### Requirement: Cross-Warehouse Fulfillment Line Allocation
The system SHALL allow a sale created at an origin warehouse to allocate product line items or line shortfall quantities to one or more fulfilling destination warehouses.

#### Scenario: Full transfer of entire order to a destination warehouse
- **WHEN** a cashier at Warehouse A creates a sale for 10 units of a product and selects Warehouse B as the fulfillment warehouse for the entire quantity
- **THEN** the system generates a parent sale record with `origin_warehouse_id = Warehouse A` and a `sale_fulfillment_line` with `fulfillment_warehouse_id = Warehouse B`, `quantity = 10`, and `status = 'PENDING_PICKUP'`

#### Scenario: Split fulfillment between local stock and remote warehouse
- **WHEN** a customer requests 10 units of a product at Warehouse A (which has 3 units in stock), and the cashier fulfills 3 units locally and transfers 7 units to Warehouse B
- **THEN** the system creates two fulfillment lines: line 1 fulfilled immediately at Warehouse A (`quantity = 3`, `status = 'FULFILLED'`) with immediate stock decrement at Warehouse A, and line 2 assigned to Warehouse B (`quantity = 7`, `status = 'PENDING_PICKUP'`) with an active stock reservation at Warehouse B

#### Scenario: Multi-destination split across multiple remote warehouses
- **WHEN** a customer shortfall of 7 units is split across Warehouse B (4 units) and Warehouse C (3 units)
- **THEN** the system creates independent fulfillment lines for Warehouse B (`quantity = 4`) and Warehouse C (`quantity = 3`), each generating its own independent stock reservation and pickup slip voucher

### Requirement: Independent Payment Location Routing
The system SHALL record the payment collection location independently for each fulfillment line, supporting payment at the origin warehouse, payment at the destination warehouse upon pickup, or debit to client credit.

#### Scenario: Payment collected at origin warehouse
- **WHEN** the customer pays in cash at Warehouse A for goods to be picked up at Warehouse B
- **THEN** the fulfillment line is recorded with `payment_warehouse_id = Warehouse A`, `payment_status = 'PAID'`, the payment is credited to Warehouse A's cash register, and the pickup slip displays "PAID AT WAREHOUSE A — DO NOT COLLECT MONEY"

#### Scenario: Payment deferred to destination pickup
- **WHEN** the cashier selects "Pay on Pickup" for goods transferred to Warehouse B
- **THEN** the fulfillment line is recorded with `payment_warehouse_id = Warehouse B`, `payment_status = 'COLLECT_ON_PICKUP'`, no payment is logged in Warehouse A's cash register, and the pickup slip displays "PAYMENT DUE ON PICKUP" with the exact amount due

#### Scenario: Payment settled via client account credit
- **WHEN** a registered client uses account credit or advance balance for an inter-warehouse order
- **THEN** the client ledger is debited for the invoice total under the origin warehouse, and the fulfillment line is marked `payment_status = 'PAID'` with payment method 'CLIENT_ACCOUNT'

### Requirement: Destination Pickup Fulfillment and Verification
The system SHALL allow authorized staff at the fulfilling warehouse to look up pending pickup orders by invoice or voucher code and fulfill or collect payment.

#### Scenario: Fulfilling a pre-paid pickup order
- **WHEN** staff at Warehouse B look up a pending fulfillment line marked `payment_status = 'PAID'` and click fulfill
- **THEN** the system decreases physical stock at Warehouse B, marks the associated stock reservation as `FULFILLED`, updates the fulfillment line to `status = 'FULFILLED'`, and logs a `SALE` stock movement at Warehouse B

#### Scenario: Collecting payment and fulfilling on pickup
- **WHEN** staff at Warehouse B look up a pending fulfillment line marked `payment_status = 'COLLECT_ON_PICKUP'` and process the collection
- **THEN** the system records a `client_payments` transaction at Warehouse B, decrements physical stock at Warehouse B, marks the reservation as `FULFILLED`, and transitions the line to `status = 'FULFILLED'`

### Requirement: Pickup Slip (Bon de Retrait) Generation
The system SHALL generate a distinct, printable pickup slip (Bon de Retrait) for each destination warehouse involved in an inter-warehouse sale.

#### Scenario: Printing pickup slip for customer
- **WHEN** an inter-warehouse sale is submitted with lines destined for Warehouse B
- **THEN** the system generates a printable Bon de Retrait containing the parent invoice number, destination warehouse name and address, item list with quantities, customer information, reservation expiry timestamp, and a prominent badge indicating payment status (Pre-paid vs Due on Pickup)

### Requirement: Inter-Warehouse Financial Settlement Tracking
The system SHALL maintain a clearing ledger (`inter_warehouse_settlements`) calculating net balances between branch pairs whenever payment collection and physical stock fulfillment occur at different warehouses.

#### Scenario: Automatic balance computation for cross-warehouse payment
- **WHEN** a fulfillment line is completed where `payment_warehouse_id = Warehouse A` and `fulfillment_warehouse_id = Warehouse B` for an amount of 10,000 DZD
- **THEN** the system establishes a payable entry indicating Warehouse A owes Warehouse B 10,000 DZD

#### Scenario: Manual inter-warehouse settlement clearing
- **WHEN** an administrator or authorized accountant registers a physical cash or bank transfer settling the balance between Warehouse A and Warehouse B
- **THEN** the system records a cleared settlement record linking the settled period and updates the net inter-warehouse balance to zero

### Requirement: Line-Level Immutability and Hard Delete Prohibition
The system SHALL prohibit hard deletion of sales containing inter-warehouse fulfillment lines, enforcing line-level immutability for fulfilled lines and state-branched cancellation.

#### Scenario: Rejection of hard delete on inter-warehouse sale
- **WHEN** a user or client sends a delete request for a sale that contains inter-warehouse fulfillment lines
- **THEN** the system rejects the operation with an error indicating that inter-warehouse sales cannot be deleted, requiring line-level cancellation instead

#### Scenario: Full cancellation when all lines are pending
- **WHEN** a cancellation is requested on a sale where all fulfillment lines have `fulfillment_status = 'PENDING_PICKUP'`
- **THEN** the system marks all active reservations as `CANCELLED`, releases the reserved quantities from the respective warehouses, marks all fulfillment lines as `CANCELLED`, voids any collected payment or issues a compensating ledger credit note, and updates the parent sale status to `CANCELLED`

#### Scenario: Partial cancellation when some lines are fulfilled
- **WHEN** a cancellation is requested on a sale where Line 1 is `FULFILLED` and Line 2 is `PENDING_PICKUP`
- **THEN** the system cancels and releases the stock reservation for Line 2 only, keeps Line 1 permanently intact as an immutable fulfilled record, adjusts parent financial totals, and updates the parent sale status to `PARTIALLY_CANCELLED`

#### Scenario: Attempted cancellation of fully fulfilled sale
- **WHEN** a cancellation is requested on a sale where all lines are `FULFILLED`
- **THEN** the system rejects the cancellation and directs the user to the returns/refund workflow to physically reverse the dispensed inventory

### Requirement: Concurrency-Safe Editing and Reassignment of Pending Lines
The system SHALL permit editing and destination reassignment only on pending fulfillment lines, executing atomic cancel-and-recreate operations with row-level locks.

#### Scenario: Editing quantity of pending line via atomic cancel-and-recreate
- **WHEN** a cashier edits the quantity of a pending fulfillment line from 5 to 8 units at Warehouse B before fulfillment
- **THEN** the system locks the stock row for Warehouse B using `SELECT FOR UPDATE`, releases the 5 reserved units, validates that 8 units are available, reserves 8 units, updates the line subtotal, and regenerates the pickup voucher

#### Scenario: Quantity increase on partially fulfilled sale
- **WHEN** a customer requests additional units on an order where some lines are already `FULFILLED`
- **THEN** the system leaves the fulfilled lines unchanged and appends an independent new fulfillment line with its own reservation and pickup slip

#### Scenario: Reassigning destination warehouse for pending line
- **WHEN** a pending line originally assigned to Warehouse B is reassigned to Warehouse C before pickup
- **THEN** within a single transaction, the system releases the reservation at Warehouse B, locks the stock at Warehouse C with `SELECT FOR UPDATE`, reserves the required quantity at Warehouse C, updates `fulfillment_warehouse_id = Warehouse C`, and issues an updated pickup voucher

#### Scenario: Modifying payment mode on pending line with ledger reconciliation
- **WHEN** a cashier switches a pending line from prepaid at origin (`PAID`) to pay on pickup (`COLLECT_ON_PICKUP`)
- **THEN** the system logs an explicit refund or client credit adjustment reversing the origin payment, sets `payment_status = 'COLLECT_ON_PICKUP'` on the line, and removes any pending inter-warehouse settlement liability
