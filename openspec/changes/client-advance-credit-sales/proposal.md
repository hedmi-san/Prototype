## Why

When a client with an existing advance credit (solde créditeur / avoir, where `current_balance < 0`) makes a purchase, cashiers currently mark the sale as "À Crédit" (unpaid) to avoid creating phantom cash register inflows. While the client's ledger balance correctly absorbs the invoice debit, the sale itself is erroneously recorded as `UNPAID` with a full remaining debt on the sales list, client profile invoices tab, and printable invoice documents, obscuring true settlement reality and prompting false collections.

## What Changes

- **Automatic Advance Credit Application with Visual Control**: When a client with an available advance credit balance is selected in the POS / Create Sale view, the system defaults to applying their available credit against the invoice total, prominently displaying the deduction, remaining balance, and allowing an explicit cashier opt-out.
- **Audit Logging for Credit Opt-Out**: If the cashier unchecks the advance credit deduction, the system logs an audit trail event (`SALE_CREDIT_OPT_OUT`) and records a trace note on the sale so management can monitor why available credit was not consumed.
- **Hybrid Multi-Tier Payment Resolution**:
  - When available credit $\ge$ invoice total: the invoice is 100% settled by advance credit and immediately marked as `PAID` (`paid_amount = total_amount`, `payment_status = 'PAID'`) without registering phantom cash.
  - When available credit $<$ invoice total: the available credit is deducted first, and the cashier selects how the remainder is settled:
    - **Comptant (Immediate settlement of remainder)**: Remainder is paid via cash/check/transfer, recorded in `client_payments`, and the sale is marked `PAID` (`paid_amount = total_amount`).
    - **À Crédit (Debt for remainder)**: Remainder is not paid, added to client debt, and the sale is marked `PARTIALLY_PAID` (`paid_amount = advance_deducted`).
    - **Acompte (Partial downpayment on remainder)**: A partial payment is made, remainder added to debt, and the sale is marked `PARTIALLY_PAID`.
- **Dedicated Advance Tracking on Sales (`advance_deducted`)**: Adds an `advance_deducted NUMERIC(14, 2) DEFAULT 0.0` column to `sales` table to accurately differentiate credit deductions from physical cash payments across sales lists, detail views, and receipts.
- **Printable Receipt & Document Itemization**: Updates `InvoiceDocument.vue` to show an itemized settlement box (Total Facture, Déduit de l'Avoir, Versé Espèces/Paiement, Reste Dû) when advance credit was utilized.
- **Cancellation & Modification Reversal Integrity**: Ensures sale cancellation (`sales_cancel`) and sale editing (`sales_edit`) properly restore the client's advance credit and cleans up `payment_allocations` so cancelled sales do not hold unallocated funds.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `sales-payment-tracking`: Extends checkout settlement requirements to support advance credit consumption, hybrid credit/cash/debt payments, audit logging for credit bypass, and allocation cleanup on cancellation.

## Impact

- **Database**: Adds column `advance_deducted NUMERIC(14, 2) NOT NULL DEFAULT 0.0` to `sales` table with index.
- **Backend API (`sale.routes.ts`)**:
  - `POST /api/sales`: Handles `useAdvanceCredit: boolean`, calculates `advanceDeducted`, updates `sales.advance_deducted`, logs audit trail on opt-out, and posts ledger entries without double-posting cash payments.
  - `PUT /api/sales/:id`: Caps `advance_deducted` to `newTotal` when reducing invoice totals.
  - `POST /api/sales/:id/cancel`: Cleans up `payment_allocations` pointing to the cancelled sale while reversing invoice debit to restore advance credit.
- **Frontend POS (`CreateSaleView.vue`)**:
  - Client selection detects `currentBalance < 0` and toggles advance deduction.
  - Live interactive breakdown displaying Total, Avoir déduit, Reste net, and remainder payment options.
- **Printable Invoices (`InvoiceDocument.vue`) & Lists**:
  - Displays avoir deduction breakdown in printable receipts and correct `PAID` / `PARTIALLY_PAID` badges across `SalesListView.vue` and `ClientProfileView.vue`.
