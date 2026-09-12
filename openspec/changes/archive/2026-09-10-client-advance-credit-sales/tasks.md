## 1. Database Schema & Type Definitions

- [x] 1.1 Update `backend/src/db/schema.ts` to add `advance_deducted NUMERIC(14, 2) NOT NULL DEFAULT 0.0` column and index to `sales` table.
- [x] 1.2 Update backend TypeScript interfaces in `backend/src/types/index.ts` and frontend interfaces in `frontend/src/types/index.ts` to include `advanceDeducted` and `useAdvanceCredit`.

## 2. Backend Sales API & Accounting Reversals

- [x] 2.1 Update `POST /api/sales` in `backend/src/routes/sale.routes.ts` to compute `advance_deducted`, post invoice debit without phantom cash payment transactions, record cash remainder in `client_payments`, and log `SALE_CREDIT_OPT_OUT` audit events when credit is bypassed.
- [x] 2.2 Update `PUT /api/sales/:id` in `backend/src/routes/sale.routes.ts` to cap `advance_deducted` to `newTotal` when reducing invoice totals and reconcile ledger entries.
- [x] 2.3 Update `POST /api/sales/:id/cancel` in `backend/src/routes/sale.routes.ts` to delete `payment_allocations` tied to the cancelled sale while reversing invoice debit to restore advance credit.
- [x] 2.4 Update `GET /api/sales`, `GET /api/sales/:id`, and `GET /api/clients/:id/invoices` to return `advanceDeducted`.

## 3. Frontend POS Sale Creation Interface

- [x] 3.1 Update `frontend/src/views/sales/CreateSaleView.vue` with client advance credit auto-detection, default-checked `useAdvanceCredit` toggle, and opt-out notification.
- [x] 3.2 Update `CreateSaleView.vue` payment condition selector to adapt dynamically to net remainder (Immediate Cash vs Remainder Debt vs Downpayment) with live financial calculations.
- [x] 3.3 Pass `useAdvanceCredit` and calculate appropriate downpayment in `saleService.createSale` payload in `frontend/src/services/operations.service.ts`.

## 4. Printable Receipts & Sales / Profile Views

- [x] 4.1 Update `frontend/src/components/sales/InvoiceDocument.vue` to print an itemized settlement box (Total Facture, Déduit de l'Avoir, Versé, Reste Dû).
- [x] 4.2 Verify `SalesListView.vue` and `ClientProfileView.vue` (Invoices and Statement tabs) correctly display `PAID` / `PARTIALLY_PAID` badges and descriptions without false debt flags.

## 5. Verification & Testing

- [x] 5.1 Test full credit settlement scenario ($\text{credit} \ge \text{total}$): verify sale status is `PAID`, client credit is decremented, and no phantom cash is registered.
- [x] 5.2 Test partial credit with immediate remainder payment: verify cash is recorded in `client_payments` and sale status is `PAID`.
- [x] 5.3 Test partial credit with remainder debt: verify remaining balance is added to client debt and sale status is `PARTIALLY_PAID`.
- [x] 5.4 Test credit bypass opt-out: verify unchecking credit logs `SALE_CREDIT_OPT_OUT` and preserves client credit balance.
- [x] 5.5 Test sale cancellation: verify cancelling an advance-settled sale restores the client's advance credit and cleans up `payment_allocations`.
