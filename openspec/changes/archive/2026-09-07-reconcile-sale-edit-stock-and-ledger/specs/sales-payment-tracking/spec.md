## ADDED Requirements

### Requirement: Sale Modification Payment Status and Allocation Recomputation
The system SHALL recompute `paid_amount`, `payment_status`, and adjust invoice payment allocations whenever a sale invoice total is modified.

#### Scenario: Sale modified downwards with full prior payment
- **WHEN** an invoice previously marked `PAID` with `paid_amount = 251,000` is edited to a new total of `150,000`
- **THEN** `sales.total_amount` is updated to `150,000`, `sales.paid_amount` is capped at `150,000`, `sales.payment_status` remains `PAID`, and existing `payment_allocations` for this sale exceeding `150,000` are capped to `150,000`

#### Scenario: Sale modified upwards exceeding prior payments
- **WHEN** an invoice with prior payment of `150,000` is edited to a new total of `200,000`
- **THEN** `sales.total_amount` is updated to `200,000`, `sales.paid_amount` remains `150,000`, and `sales.payment_status` is updated to `PARTIALLY_PAID`

#### Scenario: Unpaid sale modified to new total
- **WHEN** an invoice with `paid_amount = 0` and status `UNPAID` has its items modified
- **THEN** `sales.total_amount` is updated to the new calculated total, `paid_amount` remains `0.00`, and `sales.payment_status` remains `UNPAID`
