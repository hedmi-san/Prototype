## 1. Database & Backend Types

- [x] 1.1 Add `client_refunds` table definition and indexes in database schema (`backend/src/db/schema.ts`)
- [x] 1.2 Update backend TypeScript interfaces in `backend/src/types/index.ts` to include `ClientRefund` and refund request payload types
- [x] 1.3 Add sequence/reference helper for generating unique refund numbers (`REF-YYYYMMDD-XXXX`)

## 2. Backend API Implementation

- [x] 2.1 Implement `POST /api/clients/:id/refund` with row-level locking (`SELECT ... FOR UPDATE`), eligibility check (`current_balance < 0`), cap validation, atomic debit posting to `client_transactions`, and `clients.current_balance` update
- [x] 2.2 Implement `GET /api/clients/:id/refunds` and `GET /api/clients/:id/refunds/:refundId` to query client refund records
- [x] 2.3 Mount refund routes and verify backend compilation with `npm run build`

## 3. Frontend Types & Services

- [x] 3.1 Update frontend TypeScript types in `frontend/src/types/index.ts` for `ClientRefund` and transaction types
- [x] 3.2 Add API methods `refundClientAdvance` and `getClientRefunds` in `frontend/src/services/operations.service.ts`

## 4. Frontend UI Components & Views

- [x] 4.1 Implement `ClientRefundModal.vue` with live cap validation, quick full-advance prefill, notes, and submit actions
- [x] 4.2 Implement `RefundDocument.vue` printable discharge voucher (Bon de Décharge) with amount in words, before/after advance summary, and dual signature zones
- [x] 4.3 Update `ClientProfileView.vue` with "Rembourser Avance" action button (enabled only when `current_balance < 0`), transaction history badge styling for `REFUND`, and voucher reprint capability

## 5. Verification & End-to-End Validation

- [x] 5.1 Verify complete frontend and backend builds (`npm run build`)
- [x] 5.2 Validate business rules: reject if `current_balance >= 0`, reject if amount > available advance, reject for default walk-in client, verify ledger debit and balance reduction
