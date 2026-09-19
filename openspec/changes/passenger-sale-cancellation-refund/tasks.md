## 1. Database Schema & Migration

- [x] 1.1 Add `counter_credit_notes` table and indexes in `backend/src/db/schema.ts`
- [x] 1.2 Alter `client_refunds` table to add `credit_note_id`, `recipient_name`, `recipient_phone`, and `recipient_id_card` in `backend/src/db/schema.ts`
- [x] 1.3 Add company setting for `credit_note_validity_days` (default 90) in schema / configuration
- [x] 1.4 Create backfill script to synthesize credit note records for existing cancelled CLT-COMPTOIR sales

## 2. Backend API Implementation

- [x] 2.1 Update sale cancellation endpoint `POST /api/sales/:id/cancel` in `backend/src/routes/sale.routes.ts` to support immediate refund disbursement vs deferred credit note creation
- [x] 2.2 Add credit note routes in `backend/src/routes/credit-note.routes.ts` (listing with status filter, detail by id, printable receipt payload)
- [x] 2.3 Update client refund endpoint `POST /api/clients/:id/refund` in `backend/src/routes/client.routes.ts` to permit walk-in client refunds tied to a credit note, enforce individual ceiling, and record recipient name & phone
- [x] 2.4 Implement credit note reactivation endpoint `POST /api/credit-notes/:id/reactivate` for Admin / Super Manager
- [x] 2.5 Implement manual accounting forfeiture endpoint `POST /api/credit-notes/:id/forfeit` for Accountant / Admin, generating balancing DEBIT in `client_transactions` (Compte 758)
- [x] 2.6 Implement dynamic operational status evaluation (`EXPIRED` when `NOW() > expiry_date` and `remaining_amount > 0`)

## 3. Frontend Types & Services

- [x] 3.1 Define TypeScript interfaces for `CounterCreditNote`, `CreditNoteStatus`, and updated `ClientRefund` in `frontend/src/types/index.ts`
- [x] 3.2 Add credit note API methods (list, get, reactivate, forfeit) in `frontend/src/services/client.service.ts`

## 4. Frontend UI Components & Dialogs

- [ ] 4.1 Update sale cancellation modal in `frontend/src/views/sales/SalesListView.vue` with immediate cash refund vs deferred credit note options
- [ ] 4.2 Create printable `CreditNoteReceipt.vue` component for the deferred credit note ticket (*Reçu d'Avoir Comptoir*) with 90-day expiry notice
- [ ] 4.3 Update `ClientRefundModal.vue` to allow walk-in client refunds, enforce credit-note-level ceiling, and mandate recipient Full Name and Phone Number
- [ ] 4.4 Update `RefundDocument.vue` (*Bon de Décharge*) to display credit note / sales reference and beneficiary name/phone with dual signature sections
- [ ] 4.5 Update `ClientProfileView.vue` (`/clients/:id`) to display an "Avoirs Comptoir" tab for passenger client, listing credit notes with status badges, expiry dates, and inline `[Rembourser]` buttons
- [ ] 4.6 Add accounting forfeiture and admin reactivation action buttons on expired credit notes in `ClientProfileView.vue`

## 5. Verification & End-to-End Validation

- [ ] 5.1 Run automated test script validating immediate refund vs deferred credit note lifecycle
- [ ] 5.2 Validate individual ceiling enforcement (e.g. 5,000 DA credit note rejects 50,000 DA refund attempt)
- [ ] 5.3 Validate mandatory recipient validation for walk-in client refunds
- [ ] 5.4 Validate operational expiration after validity period without unintended ledger side effects
- [ ] 5.5 Validate manual forfeiture and balance reconciliation back to 0.00 DA on `CLT-COMPTOIR`
