# Sales Payment Tracking Specification

## Purpose
Provides end-to-end payment status and settlement tracking for sales invoices, including checkout payment conditions (Full Cash, Credit, Downpayment, Advance Credit), versement allocations, and sale cancellation ledger reversals.

## Requirements

### Requirement: Sales Payment Status Tracking
The system SHALL track the payment lifecycle of every sale invoice with statuses `PAID`, `PARTIALLY_PAID`, and `UNPAID` alongside the accumulated `paid_amount` and `advance_deducted`.

#### Scenario: Sale created on credit with no advance
- **WHEN** a sale is created for a client without available advance credit with zero initial payment
- **THEN** the sale is saved with `payment_status = 'UNPAID'`, `paid_amount = 0.00`, `advance_deducted = 0.00`, and the full total is added to client debt

#### Scenario: Sale created with downpayment (Acompte) with no advance
- **WHEN** a sale is created for a client without available advance credit with an immediate downpayment less than the total invoice amount
- **THEN** the sale is saved with `payment_status = 'PARTIALLY_PAID'`, `paid_amount` set to the downpayment, `advance_deducted = 0.00`, and both the invoice debit and payment credit are recorded in the client ledger

#### Scenario: Sale created with full cash payment
- **WHEN** a sale is created with 100% immediate payment
- **THEN** the sale is saved with `payment_status = 'PAID'`, `paid_amount` set to total invoice amount, `advance_deducted = 0.00`, and fully settled in the client ledger

#### Scenario: Sale settled fully via client advance credit
- **WHEN** a sale is created for a client with an available advance credit balance ($\text{credit} \ge \text{total\_amount}$) and advance deduction is applied
- **THEN** the sale is saved with `payment_status = 'PAID'`, `paid_amount = total_amount`, and `advance_deducted = total_amount`, the invoice debit consumes the client credit in the ledger, and no cash payment transaction is created

#### Scenario: Sale settled partially via advance credit and remainder debt
- **WHEN** a sale is created for a client with available advance credit less than the invoice total ($\text{credit} < \text{total\_amount}$) and the client does not immediately pay the remainder
- **THEN** the sale is saved with `payment_status = 'PARTIALLY_PAID'`, `paid_amount = credit`, `advance_deducted = credit`, and the remaining unpaid amount ($\text{total\_amount} - \text{credit}$) is recorded as debt on the client account

#### Scenario: Sale settled via advance credit plus immediate cash remainder
- **WHEN** a sale is created for a client with available advance credit less than the invoice total and the client immediately pays the remaining balance in cash
- **THEN** the sale is saved with `payment_status = 'PAID'`, `paid_amount = total_amount`, `advance_deducted = credit`, an immediate cash payment is recorded in `client_payments` for the remainder, and the client balance net change is zero for the cash portion

### Requirement: Client Payments and Hybrid Invoice Allocation
The system SHALL record payments (versements) and allow allocating payments across one or more sales invoices or recording general unallocated credit.

#### Scenario: Allocating a payment to specific invoices
- **WHEN** a client submits a payment specifying one or more unpaid invoices
- **THEN** the system creates `payment_allocations` linking the payment to each invoice, increases `sales.paid_amount`, and updates invoice statuses to `PAID` or `PARTIALLY_PAID` accordingly

#### Scenario: Bulk unallocated payment (Versement libre)
- **WHEN** a client submits a bulk payment without assigning specific invoices
- **THEN** the system credits the client's global ledger balance, creating an advance or reducing overall debt, while leaving invoices to be settled manually or via FIFO allocation

### Requirement: Handling Sale Cancellation and Voiding
The system SHALL maintain ledger integrity and restore client credit balances when a sale invoice is cancelled.

#### Scenario: Cancelling an unpaid sale
- **WHEN** an unpaid sale is cancelled
- **THEN** the system marks the sale as `CANCELLED`, reverses stock quantities, and inserts a compensating `CREDIT_NOTE` transaction in the client ledger to zero out the original invoice debit

#### Scenario: Cancelling a sale settled via advance credit
- **WHEN** a sale that utilized client advance credit (`advance_deducted > 0`) is cancelled
- **THEN** the system marks the sale as `CANCELLED`, posts a compensating `CREDIT_NOTE` for the entire invoice total which restores the client's advance credit in full, and deletes any `payment_allocations` linked to this sale

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

### Requirement: Client Advance Credit POS Detection and Opt-Out Audit
The system SHALL detect available client credit during checkout, default to applying the credit with prominent visual breakdown, and audit any cashier bypasses.

#### Scenario: Selecting a client with available advance credit
- **WHEN** a cashier selects a client whose running balance is negative (`current_balance < 0`) in the POS sale creation screen
- **THEN** the system displays the available credit amount, checks the "Utiliser l'avoir disponible" option by default, and calculates the net remainder

#### Scenario: Cashier opting out of applying available advance credit
- **WHEN** a cashier unchecks the advance credit deduction for a client who has available credit and submits the sale
- **THEN** the sale is processed without advance deduction, an audit log entry `SALE_CREDIT_OPT_OUT` is recorded with the client ID, warehouse ID, and bypassed credit amount, and an audit note is preserved on the sale

### Requirement: Dedicated Advance Tracking on Sales Record
The system SHALL track the exact portion of an invoice settled via advance credit separately from physical cash payments.

#### Scenario: Persisting advance deduction on sale creation
- **WHEN** an invoice is confirmed with advance credit applied
- **THEN** `sales.advance_deducted` is persisted with the exact credit amount deducted, and printable receipts itemize the credit applied alongside physical cash received

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
