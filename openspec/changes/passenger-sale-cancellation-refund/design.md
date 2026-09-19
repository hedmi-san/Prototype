## Context

When a walk-in / cash counter sale (`CLT-COMPTOIR`) is cancelled in the sales view, a credit note is posted to `client_transactions` which pushes the rolling balance into negative values (e.g. `-110 500,00 DA`). The previous implementation blocked all cash advance refunds for default clients (`is_default = true`) under the premise that walk-in clients do not maintain rolling credit accounts.

Without a targeted refund mechanism:
1. Cashiers cannot disburse money back to passenger clients who return goods or cancel counter orders.
2. If refunds were permitted against the global passenger balance pool, a cashier could erroneously refund 50,000 DA when only a 5,000 DA sale was cancelled.
3. Cash disbursements to anonymous customers without verifiable recipient identity (name and phone) cannot withstand fiscal audits or internal control reviews.
4. Unclaimed credit notes remain indefinitely as negative liabilities on `CLT-COMPTOIR`, creating silent accounting drift.

## Goals / Non-Goals

**Goals:**
- Provide a clear choice at sale cancellation: immediate cash refund vs. deferred credit note with printed receipt.
- Enforce per-credit-note capping: cash refunds for walk-in clients are strictly bound to an individual credit note and its remaining balance.
- Mandate beneficiary Full Name and Phone Number for walk-in client cash disbursements.
- Implement a 90-day configurable expiration mechanism with strict separation between operational status expiration (automatic) and accounting forfeiture (strictly manual).
- Expose an "Avoirs Comptoir" management tab on the Client Passager profile (`/clients/1`).
- Provide two official printable documents: *Reçu d'Avoir Comptoir* (ticket with expiration notice) and *Bon de Décharge de Remboursement* (dual-signature cash voucher).

**Non-Goals:**
- Changing payment/refund allocation rules for nominative B2B account clients.
- Automated bank transfers or digital wallets (counter refunds are processed in cash via the active warehouse caisse).
- Automatic posting of accounting forfeiture entries without human validation.

## Decisions

### Decision 1: Dedicated `counter_credit_notes` Table vs. Piggybacking on `client_transactions`
- **Choice**: Create a dedicated `counter_credit_notes` table referencing `sales`, `clients`, and `warehouses`.
- **Rationale**: An individual credit note needs its own lifecycle (`total_amount`, `refunded_amount`, `remaining_amount`, `status`, `issue_date`, `expiry_date`, `forfeited_at`, `forfeited_by`). Storing this in `client_transactions` would violate transaction immutability and complicate partial refund tracking.
- **Alternatives Considered**: Storing remaining amount in `sales` or adding mutable columns to `client_transactions`. Rejected because sales record initial order state, and financial transaction ledger rows must remain immutable.

### Decision 2: Separation of Status Expiration (Automatic) vs. Accounting Forfeiture (Manual)
- **Choice**: Separate operational status expiration (`PENDING` → `EXPIRED`) from the accounting ledger entry (`FORFEITED` / Compte 758).
- **Rationale**:
  - Automatic status expiration immediately protects cashiers from paying out expired vouchers at the counter without requiring periodic manual checks.
  - Automatic accounting entries are dangerous: they alter balance sheets without human verification, create reconciliation discrepancies, and cause friction if a customer appears with a valid claim shortly after deadline.
  - Forfeiture remains an explicit action taken by an accountant or administrator after reviewing the expired list.
- **Alternatives Considered**: Completely manual expiration (unreliable, forgotten by staff) vs. completely automatic forfeiture (dangerous, lacks human audit trail).

### Decision 3: Mandatory Beneficiary Identification for Walk-in Clients
- **Choice**: Add `recipient_name` (mandatory), `recipient_phone` (mandatory), and `recipient_id_card` (optional) to `client_refunds`.
- **Rationale**: Unlike nominative clients whose fiscal identity is registered, walk-in clients are anonymous. A signed Bon de Décharge lacking the recipient's name and phone has zero probative value in case of employee theft or customer dispute.

### Decision 4: Configurable Company-Level Validity Days
- **Choice**: Store `credit_note_validity_days` in system settings with a default value of 90 days.
- **Rationale**: Hardcoding 90 days would require code modifications if the business adjusts commercial policy (e.g. 60 days for seasonal items or 180 days).

### Decision 5: Two Entry Points for Cash Disbursement
- **Choice**:
  1. *At Sale Cancellation*: Modal prompts for immediate refund (pre-fills beneficiary form and prints Bon de Décharge) or deferred ticket (prints Reçu d'Avoir).
  2. *On Client Passager Profile (`/clients/1`)*: Tab "Avoirs Comptoir" displays all credit notes with status badges and an inline `[Rembourser]` button on valid rows.

## Data Model

```sql
CREATE TABLE IF NOT EXISTS counter_credit_notes (
  id SERIAL PRIMARY KEY,
  credit_note_number VARCHAR(50) NOT NULL UNIQUE,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  total_amount NUMERIC(14, 2) NOT NULL CHECK(total_amount > 0),
  refunded_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.0 CHECK(refunded_amount >= 0),
  remaining_amount NUMERIC(14, 2) NOT NULL CHECK(remaining_amount >= 0),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  reactivated_at TIMESTAMPTZ,
  reactivated_by INTEGER REFERENCES users(id),
  forfeited_at TIMESTAMPTZ,
  forfeited_by INTEGER REFERENCES users(id),
  forfeited_transaction_id INTEGER REFERENCES client_transactions(id),
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alter client_refunds to link credit note and capture beneficiary details
ALTER TABLE client_refunds
  ADD COLUMN IF NOT EXISTS credit_note_id INTEGER REFERENCES counter_credit_notes(id),
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS recipient_id_card VARCHAR(100);
```

## Risks / Trade-offs

- **[Risk] Concurrent double-refunding of the same credit note** → **Mitigation**: Wrap refund processing in a database transaction with `SELECT * FROM counter_credit_notes WHERE id = $1 FOR UPDATE`.
- **[Risk] Existing orphan credit notes created prior to this feature** → **Mitigation**: Provide a migration script that scans historical cancelled sales for `CLT-COMPTOIR` having negative transactions without matching refunds, creating backfilled `counter_credit_notes` rows.
- **[Risk] Customer arrives with receipt on day 95 and disputes expiration** → **Mitigation**: The printed *Reçu d'Avoir* includes explicit legal notice of the 90-day deadline, and the system provides an administrative "Réactiver l'Avoir" button for legitimate commercial concessions.
