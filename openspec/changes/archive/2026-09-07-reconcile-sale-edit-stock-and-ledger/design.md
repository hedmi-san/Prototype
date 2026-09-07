# Technical Design: Unified Sale Edit Stock & Ledger Reconciliation

## Context

In `backend/src/routes/sale.routes.ts`, `PUT /sales/:id` previously attempted stock reconciliation via a hardcoded SQL statement:
```typescript
await client.query(`
  INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
  VALUES ($1, $2, 'SALE_EDIT', 0, $3, 'Sale modified with inventory reconciliation')
`, [currentSale.warehouse_id, items[0]?.productId || 1, currentSale.invoice_number]);
```
This produced two major defects:
1. It arbitrarily attributed the movement to `items[0]` with `quantity_change = 0`, ignoring actual changed items (e.g. DeWalt Hammer Drill modified 7 $\rightarrow$ 3 units appeared as 0 delta on Socket Set).
2. It completely neglected financial ledger reconciliation (`client_transactions`), leaving customer balances, invoice payment statuses, and allocations unadjusted when invoice totals changed.

## Goals / Non-Goals

**Goals:**
- Implement per-product signed delta calculation ($\Delta_{\text{stock}} = \text{oldQty} - \text{newQty}$) under row-level database locks.
- Ensure strict transaction atomicity: any physical stock shortage on quantity increases triggers an immediate, full `ROLLBACK` with HTTP 400.
- Guarantee concurrency safety and idempotence by reading baseline quantities directly from `sale_items` within the locked transaction.
- Reconcile customer ledger (`client_transactions`) and `clients.current_balance` for both nominative accounts and walk-in cash counter accounts (`CLT-COMPTOIR`).
- Recompute `sales.paid_amount`, `sales.payment_status`, and cap `payment_allocations`.
- Unify auditability across stock, finance, and system logs with a shared revision reference (`[<invoiceNumber>-REV-<timestamp>]`).
- Update frontend movement filters and badges to properly translate `SALE_EDIT` ("Modif. Vente") and `SALE_CANCEL` ("Annulation Vente").

**Non-Goals:**
- Editing cancelled sales (already rejected with HTTP 400).
- Multi-currency recalculations (single currency DZD / DA across system).
- Modifying historical completed transactions prior to the edit.

## Decisions

### 1. Row-Level Locking Order and In-Database Source of Truth
- **Decision**: Inside `runTransaction`, immediately acquire a lock on the sale:
  ```sql
  SELECT * FROM sales WHERE id = $1 FOR UPDATE
  ```
  Then read previous items directly from `sale_items WHERE sale_id = $1` into an `oldMap (productId -> quantity)`.
  When locking stock rows, sort `product_id`s ascending to prevent deadlocks:
  ```sql
  SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE
  ```
- **Rationale**: The frontend sends only the declarative desired state (`items`). Reading `sale_items` under lock ensures true isolation, protects against race conditions with manual stock adjustments or concurrent edits, and delivers automatic idempotence (a repeated PUT request reads the already updated `sale_items`, computing deltas of 0).
- **Alternatives Considered**: Sending old deltas from frontend. Rejected because client-supplied deltas are prone to stale reads, double-click desynchronization, and integrity tampering.

### 2. Full Rollback on Stock Deficit
- **Decision**: If any product with $\Delta_{\text{stock}} < 0$ lacks sufficient physical stock (`physical_quantity - reserved_quantity < |Δ|`), immediately throw an error to trigger an automatic PostgreSQL transaction rollback.
- **Rationale**: A partial update would leave the invoice in an inconsistent state compared to what the user submitted.
- **Alternatives Considered**: Partial save of available items. Rejected as fundamentally unacceptable for invoicing integrity.

### 3. Signed Inventory Delta Algorithm
- **Decision**:
  - `oldMap`: sum of quantities per `product_id` from existing `sale_items`.
  - `newMap`: sum of quantities per `productId` from requested `items`.
  - For each `productId` in `Union(oldMap.keys(), newMap.keys())`:
    $$\Delta_{\text{stock}} = \text{oldQty} - \text{newQty}$$
    - $\Delta_{\text{stock}} > 0$: Stock restored. `physical_quantity += Δ`. Log `SALE_EDIT` with `+Δ`.
    - $\Delta_{\text{stock}} < 0$: Stock consumed. Check availability. `physical_quantity -= |Δ|`. Log `SALE_EDIT` with `Δ` (negative).
    - $\Delta_{\text{stock}} = 0$: No stock change. Do not insert any row into `stock_movements`.
- **Rationale**: Accurately tracks inventory flow and eliminates ghost entries with 0 delta.

### 4. Client Financial Ledger Reconciliation
- **Decision**:
  Compute $\Delta_{\text{total}} = \text{newTotal} - \text{oldTotal}$.
  If the sale is associated with a client (`currentSale.client_id`):
  - **Nominative Client (`is_default = false`)**:
    - If $\Delta_{\text{total}} < 0$: Insert `CREDIT_NOTE` in `client_transactions` with `credit = |Δ|`, update `running_balance = prevBal - |Δ|`, decrement `clients.current_balance`.
    - If $\Delta_{\text{total}} > 0$: Insert `INVOICE` in `client_transactions` with `debit = Δ`, update `running_balance = prevBal + Δ`, increment `clients.current_balance`.
  - **Walk-in Counter Client (`is_default = true`)**:
    - If $\Delta_{\text{total}} < 0$: Insert `CREDIT_NOTE` with `credit = |Δ|` and a compensating cash refund (`REFUND`) entry with `debit = |Δ|`. `clients.current_balance` remains 0.00 DA, while cash outflow is fully audited.
    - If $\Delta_{\text{total}} > 0$: The additional amount is collected at the cashier, recorded as a payment credit and matching invoice debit, preserving a 0.00 DA balance.
- **Rationale**: Prevents client balance corruption and guarantees enterprise-grade double-entry ledger accuracy.

### 5. Payment Lifecycle & Allocations Reconciliation
- **Decision**:
  - `paid_amount = Math.min(currentSale.paid_amount, newTotal)`.
  - `payment_status = paid_amount >= newTotal ? 'PAID' : (paid_amount > 0 ? 'PARTIALLY_PAID' : 'UNPAID')`.
  - For existing `payment_allocations` on this sale, cap total allocations to `newTotal`:
    ```sql
    UPDATE payment_allocations SET allocated_amount = $1 WHERE sale_id = $2 AND allocated_amount > $1
    ```
- **Rationale**: Prevents an invoice from claiming more payments than its total amount when reduced.

### 6. Revision Batch Reference (`revRef`)
- **Decision**: Generate `revRef = `${currentSale.invoice_number}-REV-${Date.now().toString().slice(-6)}`` once per edit.
- **Rationale**: Appended to notes/descriptions across `stock_movements`, `client_transactions`, and `audit_logs` to cross-link physical and financial movements.

## Risks / Trade-offs

- **[Risk: Deadlocks on concurrent transactions]** $\rightarrow$ **Mitigation**: Sort product IDs in ascending order before executing `SELECT ... FOR UPDATE` on `stock`.
- **[Risk: Multiple lines with same product ID in submission]** $\rightarrow$ **Mitigation**: Group incoming `items` by `productId` using a `Map` before computing deltas and writing `sale_items`.
- **[Risk: Client balance desynchronization under high load]** $\rightarrow$ **Mitigation**: Lock client row with `SELECT id, current_balance FROM clients WHERE id = $1 FOR UPDATE` prior to updating balance.
