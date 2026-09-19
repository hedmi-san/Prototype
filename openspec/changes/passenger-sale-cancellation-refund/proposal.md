## Why

When a cash counter sale (`CLT-COMPTOIR`) is cancelled or returned, the system generates a credit note reducing the client's rolling balance into negative territory (e.g. `-110 500,00 DA`), but currently prohibits processing cash refunds on walk-in clients across both UI and API. Furthermore, refunding cash to an anonymous retail client without individual credit note capping or mandatory recipient identification exposes the company to audit disputes, double disbursements, and uncontrolled negative ledger drift from unclaimed orphan credit notes.

## What Changes

- **Cancellation Modal Flow**: When cancelling a walk-in sale in `SalesListView`, the cashier can choose either:
  1. **Immediate Cash Refund** (`Remboursement Immédiat`): Disburses cash immediately, records the recipient's identity, and prints a signed *Bon de Décharge*.
  2. **Deferred Credit Note** (`Avoir Différé`): Creates an individual credit note record and prints a printable *Reçu d'Avoir Comptoir* stating the issue date and a 90-day validity deadline.
- **Dedicated Credit Notes Management**: Track individual credit notes per cancelled sale with remaining refundable balance (`total_amount - refunded_amount`), preventing cashiers from refunding more than the specific credit note allows.
- **Client Profile Refund by Avoir**: On the walk-in client profile (`/clients/1`), expose an active "Avoirs Comptoir" tab and refund modal targeting specific credit notes, lifting the previous hardcoded `isDefault` prohibition.
- **Mandatory Recipient Identification**: Require recipient Full Name and Phone Number (+ optional National ID) when disbursing cash for passenger clients, printing these details on the dual-signature *Bon de Décharge*.
- **90-Day Configurable Expiration & Reversible State**: Credit notes automatically transition from `PENDING` to `EXPIRED` after 90 days (configurable at company level), blocking cashier disbursement without affecting the accounting ledger. Authorized admins can manually re-activate an expired credit note.
- **Manual Accounting Forfeiture**: Accountants can explicitly review expired orphan credit notes and trigger a manual forfeiture (`Constater la forclusion`), generating a balancing debit transaction against the passenger account and recognizing extraordinary income (Compte 758).

## Capabilities

### New Capabilities
- `counter-credit-notes`: Manages the full lifecycle of counter/walk-in credit notes (`AVR-xxxx`), individual balance tracking, printable Reçu d'Avoir tickets with expiry dates, automatic status expiration, administrative reactivation, and manual accounting forfeiture.

### Modified Capabilities
- `client-advance-refund`: Permit cash advance refunds for default walk-in clients (`is_default = true`) when targeting an active credit note, enforce individual credit note capping rather than arbitrary global pool withdrawals, and mandate recipient name and phone details on the *Bon de Décharge*.

## Impact

- **Database**: New table `counter_credit_notes` (linked to `sales`, `clients`, `client_refunds`, and `client_transactions`), new configuration parameter `credit_note_validity_days` (default 90).
- **Backend API**:
  - `backend/src/routes/sale.routes.ts`: Update sale cancellation endpoint to support immediate refund disbursement vs deferred credit note emission.
  - `backend/src/routes/client.routes.ts`: Allow refunds for `is_default` clients when linked to a credit note, add credit note listing, reactivation, and forfeiture endpoints.
- **Frontend UI**:
  - `frontend/src/views/sales/SalesListView.vue`: Update cancellation modal with choice of immediate refund vs deferred credit note ticket.
  - `frontend/src/views/clients/ClientProfileView.vue`: Add Avoirs tab for passenger client, enable refund button capped by credit note.
  - `frontend/src/components/clients/ClientRefundModal.vue`: Support credit-note-targeted refunds and mandatory beneficiary fields for walk-in clients.
  - `frontend/src/components/clients/RefundDocument.vue`: Enrich voucher with credit note reference and beneficiary identity.
  - New component `frontend/src/components/clients/CreditNoteReceipt.vue`: Printable Reçu d'Avoir Comptoir with 90-day expiry notice.
