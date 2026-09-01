# Sales Payment Tracking Specification

## Purpose
Provides end-to-end payment status and settlement tracking for sales invoices, including checkout payment conditions (Full Cash, Credit, Downpayment), versement allocations, and sale cancellation ledger reversals.

## Requirements

### Requirement: Sales Payment Status Tracking
The system SHALL track the payment lifecycle of every sale invoice with statuses `PAID`, `PARTIALLY_PAID`, and `UNPAID` alongside the accumulated `paid_amount`.

#### Scenario: Sale created on credit
- **WHEN** a sale is created with zero initial payment
- **THEN** the sale is saved with `payment_status = 'UNPAID'` and `paid_amount = 0.00`

#### Scenario: Sale created with downpayment (Acompte)
- **WHEN** a sale is created with an immediate downpayment less than the total invoice amount
- **THEN** the sale is saved with `payment_status = 'PARTIALLY_PAID'`, `paid_amount` set to the downpayment, and both the invoice debit and payment credit are recorded in the client ledger

#### Scenario: Sale created with full payment
- **WHEN** a sale is created with 100% immediate payment
- **THEN** the sale is saved with `payment_status = 'PAID'`, `paid_amount` set to total invoice amount, and fully settled in the client ledger

### Requirement: Client Payments and Hybrid Invoice Allocation
The system SHALL record payments (versements) and allow allocating payments across one or more sales invoices or recording general unallocated credit.

#### Scenario: Allocating a payment to specific invoices
- **WHEN** a client submits a payment specifying one or more unpaid invoices
- **THEN** the system creates `payment_allocations` linking the payment to each invoice, increases `sales.paid_amount`, and updates invoice statuses to `PAID` or `PARTIALLY_PAID` accordingly

#### Scenario: Bulk unallocated payment (Versement libre)
- **WHEN** a client submits a bulk payment without assigning specific invoices
- **THEN** the system credits the client's global ledger balance, creating an advance or reducing overall debt, while leaving invoices to be settled manually or via FIFO allocation

### Requirement: Handling Sale Cancellation and Voiding
The system SHALL maintain ledger integrity when a sale invoice is cancelled.

#### Scenario: Cancelling an unpaid sale
- **WHEN** an unpaid sale is cancelled
- **THEN** the system marks the sale as `CANCELLED`, reverses stock quantities, and inserts a compensating `CREDIT_NOTE` transaction in the client ledger to zero out the original invoice debit
