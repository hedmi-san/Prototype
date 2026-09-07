## 1. Backend: Inventory Delta Reconciliation Engine

- [x] 1.1 Lock sale row (`SELECT * FROM sales WHERE id = $1 FOR UPDATE`) in `backend/src/routes/sale.routes.ts` and fetch baseline items from `sale_items`.
- [x] 1.2 Implement per-product delta calculation ($\Delta_{\text{stock}} = \text{oldQty} - \text{newQty}$) with deadlock-safe ordered stock locking (`SELECT ... FROM stock ... FOR UPDATE`).
- [x] 1.3 Implement atomic availability validation that immediately triggers full transaction rollback (`HTTP 400`) if any product with $\Delta < 0$ exceeds available stock.
- [x] 1.4 Update physical quantities in `stock` and insert `SALE_EDIT` movements only for products with $\Delta \neq 0$ tagged with `[<revRef>]`.
- [x] 1.5 Replace `sale_items` with updated line items, calculating `newTotal`.

## 2. Backend: Client Ledger & Payment Lifecycle Reconciliation

- [x] 2.1 Calculate invoice total delta ($\Delta_{\text{total}} = \text{newTotal} - \text{oldTotal}$) and lock client account (`SELECT ... FROM clients ... FOR UPDATE`).
- [x] 2.2 Post `CREDIT_NOTE` (for invoice decrease) or complementary `INVOICE` (for invoice increase) in `client_transactions` and update `clients.current_balance` for nominative clients.
- [x] 2.3 Implement cash counter refund handling for default walk-in client (`is_default = true`), posting `CREDIT_NOTE` and compensating `REFUND` debit to maintain 0.00 DA balance with cash register audit trail.
- [x] 2.4 Recompute `sales.paid_amount`, update `sales.payment_status` (`PAID`, `PARTIALLY_PAID`, `UNPAID`), and cap `payment_allocations` to `newTotal`.
- [x] 2.5 Update audit log with `[<revRef>]` and update `PUT /sales/:id` response payload.

## 3. Frontend: Movement View & Formatters Polish

- [x] 3.1 Update `frontend/src/utils/formatters.ts` to map `SALE_EDIT` to "Modif. Vente" and `SALE_CANCEL` to "Annulation Vente".
- [x] 3.2 Update `frontend/src/views/inventory/StockMovementsView.vue` with badge variants (`warning` for `SALE_EDIT`, `danger` for `SALE_CANCEL`).
- [x] 3.3 Add `SALE_EDIT` and `SALE_CANCEL` options to the movement type filter select dropdown in `StockMovementsView.vue`.

## 4. Verification & Validation

- [x] 4.1 Verify reproduction scenario: edit sale with reduced quantity (7 to 3 units) and confirm stock increases by +4, DeWalt is logged with `+4` (green), and unedited products log zero movements.
- [x] 4.2 Verify nominative client ledger: confirm `CREDIT_NOTE` is created in `client_transactions` and client debt decreases accordingly.
- [x] 4.3 Verify walk-in client edit: confirm cash refund entries are created and client balance remains 0.00 DA.
- [x] 4.4 Verify stock shortage handling: confirm requested increase beyond available stock triggers HTTP 400 and rolls back completely.
- [x] 4.5 Verify idempotence: confirm re-submitting identical payload generates zero additional stock movements or financial transactions.
