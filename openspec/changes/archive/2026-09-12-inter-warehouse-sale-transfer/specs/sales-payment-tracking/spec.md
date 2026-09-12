## ADDED Requirements

### Requirement: Multi-Warehouse Sale Payment Status Resolution
The system SHALL calculate the overall parent sale payment status (`PAID`, `PARTIALLY_PAID`, `UNPAID`) based on the aggregated payment state across all fulfillment lines and cash collection points.

#### Scenario: Sale with partial origin payment and partial destination payment
- **WHEN** a sale has Line 1 (5,000 DZD) paid immediately at Warehouse A and Line 2 (5,000 DZD) marked "Pay on Pickup" at Warehouse B
- **THEN** the parent sale is recorded with `total_amount = 10,000`, `paid_amount = 5,000`, and `payment_status = 'PARTIALLY_PAID'` until Line 2 is collected at Warehouse B

#### Scenario: All lines prepaid at origin
- **WHEN** all fulfillment lines across all destination warehouses are paid in full at the origin warehouse during checkout
- **THEN** the parent sale is recorded with `payment_status = 'PAID'` and `paid_amount = total_amount`

### Requirement: Pickup-Stage Payment Collection and Invoice Settlement
The system SHALL update the parent sale's accumulated `paid_amount` and `payment_status` when a "Pay on Pickup" fulfillment line is collected at a destination warehouse.

#### Scenario: Final payment collected on destination pickup
- **WHEN** the remaining 5,000 DZD for Line 2 is collected at Warehouse B upon customer pickup
- **THEN** the system registers a client payment at Warehouse B, links the payment allocation to the parent sale, updates `sales.paid_amount` to 10,000 DZD, and promotes `sales.payment_status` to `PAID`
