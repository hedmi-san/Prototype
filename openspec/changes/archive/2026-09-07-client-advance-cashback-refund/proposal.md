# Proposal: Client Advance Cashback & Refund Management

## Why

When a client holds an advance balance (`current_balance < 0`), resulting from overpayments, advance versements, or credit notes from returned merchandise, there is currently no mechanism in the system to issue a cash-back or refund to the client.

This change introduces a formal, auditable cash refund operation that allows cashiers to disburse funds back to a client from their available credit, updating the financial ledger atomically and producing a legally binding printable discharge voucher (Bon de Décharge).

## What Changes

- **Client Cash-Back / Refund API (`POST /api/clients/:id/refund`)**: A dedicated transactional endpoint allowing any authenticated warehouse user to issue cash refunds to clients up to their available advance balance.
- **Strict Eligibility & Cap Enforcement**: A refund is only permitted if the client has an active advance balance (`current_balance < 0`) and the refund amount is strictly positive and does not exceed the available credit ($0 < \text{amount} \le |\text{current\_balance}|$). Walk-in cash counter accounts (`is_default = true`) are disallowed from advance refunds.
- **Cash Disbursal Tracking (`client_refunds` Table)**: A dedicated database table recording receipt number (`REF-xxxx`), warehouse, amount, cash method, notes, and user.
- **Ledger Integration (`client_transactions`)**: An immutable debit entry (`type = 'REFUND'`, `debit = amount`, `credit = 0`) posted to the client ledger, bringing the algebraic balance closer to 0 (e.g. -25,000 DA $\rightarrow$ -5,000 DA).
- **Interactive UI Modal (`ClientRefundModal.vue`)**: Positioned on the client profile page, active only when an advance exists, with rapid full-refund prefill and validation.
- **Printable Discharge Voucher (`RefundDocument.vue`)**: A formal receipt with enterprise header, before/after advance summary, amount in words and numbers, and dual signature zones (Cashier signature + Client acknowledgment "Bon pour réception de la somme en espèces").

## Capabilities

### New Capabilities
- `client-advance-refund`: Dedicated cash refund workflow for clients with advance credit balances, encompassing eligibility checks, ceiling enforcement, voucher generation, and discharge printing.

### Modified Capabilities
- `client-financial-ledger`: Add requirement for posting `REFUND` debit transactions to client statement of accounts, reducing client advance balances.

## Impact

- **Backend**: New route file `backend/src/routes/client-refund.routes.ts` mounted at `/api/clients`, schema update in `backend/src/db/schema.ts` for `client_refunds`.
- **Frontend**: `frontend/src/views/clients/ClientProfileView.vue`, new components `ClientRefundModal.vue` and `RefundDocument.vue`, operations service in `frontend/src/services/operations.service.ts`.
- **Database**: New table `client_refunds` with indexes on `client_id` and `warehouse_id`.
