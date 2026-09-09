## Context

In the distribution management system, client financial transactions follow a single net running balance convention where:
- $\text{current\_balance} > 0$ represents **client debt** (créance).
- $\text{current\_balance} < 0$ represents **client advance credit** (solde créditeur / avoir).

Previously, sales had three checkout conditions: `FULL_CASH`, `CREDIT`, and `PARTIAL_DOWNPAYMENT`. When a client possessed advance credit, cashiers selected `CREDIT` to avoid recording a fictitious cash deposit into the cash drawer. While posting the invoice debit correctly reduced the client's credit balance in the ledger, the sale record was marked with `paid_amount = 0` and `payment_status = 'UNPAID'`. This resulted in erroneous red "Non Payée" badges on the sales list, inaccurate debt amounts in client invoice statements, and confusion for accountants and clients.

## Goals / Non-Goals

**Goals:**
- Enable seamless settlement of sales invoices using available client advance credit.
- Support hybrid multi-tier checkout (Advance Credit + Immediate Cash + Unpaid Debt).
- Display a prominent, toggleable UI in `CreateSaleView.vue` with real-time financial recalculations.
- Ensure auditability by logging an audit event (`SALE_CREDIT_OPT_OUT`) whenever a cashier explicitly bypasses available advance credit.
- Add an explicit `advance_deducted` column to `sales` to clearly differentiate advance credit consumption from physical cash payments.
- Display an itemized settlement breakdown on printable invoice receipts (`InvoiceDocument.vue`).
- Ensure complete ledger consistency during sale cancellation (`sales_cancel`) and editing (`sales_edit`), restoring client credit and unlinking dead payment allocations.

**Non-Goals:**
- Allowing walk-in counter customers (`is_default = true`) to hold advance credit (walk-ins remain strictly cash-only).
- Altering external banking or payment gateway integrations.

## Decisions

### Decision 1: Consuming Advance Credit via Invoice Debit Without Phantom Cash Transactions
- **Choice**: The advance credit portion is settled purely by the invoice debit against the client's negative balance. No entry is made in `client_payments` for the credit portion.
- **Rationale**: An advance credit was already deposited and credited in the past (e.g., prior cash versement or return credit note). Creating a new `client_payments` credit transaction would double-count the credit and grant the client a duplicate refund.
- **Cash Remainder Handling**: If the invoice exceeds the advance credit and the customer pays the difference in cash, only the net cash amount is recorded in `client_payments` with `paymentMethod = 'CASH'`, and allocated to the sale via `payment_allocations`.

### Decision 2: Adding `advance_deducted` Column to `sales` Table
- **Choice**: Add `advance_deducted NUMERIC(14, 2) NOT NULL DEFAULT 0.0` to the `sales` table.
- **Rationale**:
  $$\text{paid\_amount} = \text{advance\_deducted} + \text{cash\_downpayment}$$
  $$\text{remaining\_debt} = \text{total\_amount} - \text{paid\_amount}$$
  Storing `advance_deducted` directly allows:
  1. Distinguishing real physical cash received at checkout from virtual credit absorption.
  2. Preventing cash register / daily sales report skewing.
  3. Cleanly itemizing printable invoices and receipt documents.

### Decision 3: Auto-Detection with Default-Checked Toggle and Opt-Out Audit
- **Choice**: In `CreateSaleView.vue`, selecting a client with `currentBalance < 0` triggers an advance credit banner with a toggle checked by default (`useAdvanceCredit = true`). Cashiers can uncheck the toggle to preserve credit.
- **Rationale**: Defaulting to `true` reflects business reality and prevents cashier error. Unchecking triggers an audit log (`SALE_CREDIT_OPT_OUT`) and appends a note to the sale record, preserving management oversight without blocking legitimate customer requests.

### Decision 4: Concurrency Protection via Client Row Locking
- **Choice**: In `POST /api/sales`, query `clients` with `FOR UPDATE` before reading `current_balance` and determining `advance_deducted`.
- **Rationale**: Prevents race conditions where two simultaneous sales at different registers consume the same advance credit twice.

### Decision 5: Cancellation & Modification Reversal Integrity
- **Choice**:
  - In `POST /api/sales/:id/cancel`: Post a `CREDIT_NOTE` for `total_amount` (which naturally credits the client's balance, restoring any consumed advance credit and cash), mark the sale `CANCELLED`, and execute `DELETE FROM payment_allocations WHERE sale_id = $1` to release any cash payments back to unallocated status.
  - In `PUT /api/sales/:id`: Cap `advance_deducted` and `paid_amount` to `newTotal` when reducing invoice totals, adjusting the ledger via `deltaTotal`.

## Risks / Trade-offs

- **[Cashier Confusion on Mixed Payments]** $\rightarrow$ Mitigated by dynamic, color-coded breakdown in `CreateSaleView.vue` showing Total Facture, Avoir Déduit, Net Restant, and exact status preview (`PAYÉE` vs `PARTIELLE`).
- **[Over-Allocation on Sale Edit]** $\rightarrow$ Mitigated by capping `advance_deducted` and `allocated_amount` to `newTotal`.
- **[Database Migration]** $\rightarrow$ `ALTER TABLE sales ADD COLUMN IF NOT EXISTS advance_deducted NUMERIC(14, 2) NOT NULL DEFAULT 0.0;` is backward compatible and non-blocking.
