## 1. Database Schema & Migration

- [x] 1.1 Add `approved_at` and `confirmed_at` columns to `transfers` table in `backend/src/db/schema.ts` and include migration in `initSchema()`

## 2. Backend Transfer Routes & Access Control

- [x] 2.1 Update `GET /api/transfers` and `GET /api/transfers/:id` in `backend/src/routes/transfer.routes.ts` to enforce warehouse scoping for non-admin users and return `approvedAt` and `confirmedAt`
- [x] 2.2 Add authorization guards to `POST /api/transfers/:id/approve` and `POST /api/transfers/:id/decline` restricting execution to source warehouse Manager or Admin, and set `approved_at`
- [x] 2.3 Add authorization guards to `POST /api/transfers/:id/confirm` (destination warehouse Manager or Admin only), set `confirmed_at`, and ensure transactional stock mutations with `TRANSFER_OUT`/`TRANSFER_IN` movements
- [x] 2.4 Add authorization guards to `POST /api/transfers/:id/cancel` restricting execution to requester, destination warehouse Manager, or Admin, and strictly reject cancellation of `CONFIRMED`, `CANCELLED`, or `DECLINED` transfers

## 3. Frontend Views & UI Permissions

- [x] 3.1 Update `frontend/src/views/transfers/TransferListView.vue` with role and warehouse permission checks for `Approuver`, `Refuser`, `Confirmer Réception`, and `Annuler` action buttons
- [x] 3.2 Ensure confirmation timestamp (`confirmedAt`) correctly displays in table column and details modal

## 4. Verification & Validation

- [x] 4.1 Verify transfer list isolation and 403 Forbidden protection on unauthorized warehouse access and actions
- [x] 4.2 Verify transfer confirmation transitions state, sets `confirmed_at`, deducts/increments stock, and logs stock movements
- [x] 4.3 Verify confirmed transfers cannot be canceled
