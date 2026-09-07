# Proposal: Reconcile Sale Edit Stock and Ledger

## Why

When editing an existing sale invoice (`PUT /sales/:id`), the system currently:
1. Records a single, hardcoded stock movement with `quantity_change = 0` assigned arbitrarily to the first item of the payload (`items[0]`), ignoring which products actually changed and in what direction.
2. Completely skips financial reconciliation in the client ledger (`client_transactions`), leaving `clients.current_balance`, `sales.paid_amount`, and `sales.payment_status` out of sync with the revised invoice amount.

This creates critical data corruption: inventory reports show ghost or missing movements for edited products, and client account statements fail to reflect invoice reductions or price increases.

## What Changes

- **Per-Product Inventory Delta Reconciliation**: Calculate signed quantity deltas ($\Delta_{\text{stock}} = \text{oldQty} - \text{newQty}$) for all affected items under row-level database locks (`FOR UPDATE`). Record individual `SALE_EDIT` movements for products that actually moved ($\Delta \neq 0$) with human-readable notes; ignore products with $\Delta = 0$.
- **Atomic Availability Check with Full Rollback**: For requested quantity increases ($\Delta < 0$), verify physical stock availability. If any line cannot be satisfied, fail the entire transaction (`ROLLBACK`) and return a clear `400 Bad Request`.
- **Authoritative In-Database Baseline (Concurrency & Idempotence)**: Read the baseline previous quantities strictly from `sale_items` within the locked transaction, ensuring concurrent modifications serialize cleanly and repeated submissions (double-clicks, network retries) produce zero duplicate deltas.
- **Client Financial Ledger Reconciliation**: When an invoice total changes ($\Delta_{\text{total}} = \text{newTotal} - \text{oldTotal}$):
  - On invoice decrease ($\Delta_{\text{total}} < 0$): Post a compensating `CREDIT_NOTE` to the client ledger and reduce `clients.current_balance`.
  - On invoice increase ($\Delta_{\text{total}} > 0$): Post a supplementary `INVOICE` debit to the client ledger and increase `clients.current_balance`.
- **Walk-in / Cash Counter Refund Tracing**: For cash retail clients (`CLT-COMPTOIR`), record both the credit note and a compensating cash refund (`REFUND`) debit in the ledger, maintaining a zero balance while auditing cash register outflows.
- **Payment Lifecycle & Allocation Adjustments**: Recompute `sales.paid_amount`, `sales.payment_status` (`PAID`, `PARTIALLY_PAID`, `UNPAID`), and cap `payment_allocations` to prevent over-allocation.
- **Cross-Referenced Audit Trail**: Tag stock movements, client transactions, and audit logs with a shared revision batch identifier `[<invoiceNumber>-REV-<timestamp>]`.
- **UI & Localization Polish**: Map `SALE_EDIT` to "Modif. Vente" with appropriate badges and add it to the movement filter dropdown in `StockMovementsView.vue`.

## Capabilities

### New Capabilities
- `sale-stock-reconciliation`: Per-product inventory delta calculation, availability checks with atomic rollback, and `SALE_EDIT` stock movement logging upon sale edit.

### Modified Capabilities
- `sales-payment-tracking`: Extend requirement to recalculate `paid_amount`, `payment_status`, and payment allocations when an existing invoice total is modified.
- `client-financial-ledger`: Extend requirement to post compensating `CREDIT_NOTE`, complementary `INVOICE`, and counter cash refund entries when an invoice amount is updated.

## Impact

- **Backend**: `backend/src/routes/sale.routes.ts` (`PUT /sales/:id`), `backend/src/types/index.ts`.
- **Frontend**: `frontend/src/views/inventory/StockMovementsView.vue`, `frontend/src/utils/formatters.ts`.
- **Database**: No schema migration required (`stock_movements`, `client_transactions`, and `sales` tables already support the necessary columns and types).
- **APIs**: `PUT /api/sales/:id` return payload updated to include revised payment status, paid amount, and ledger reconciliation summary.
