## Context

In the commercial management workflow, clients can accumulate an advance balance (`current_balance < 0`) through advance versements, overpayments, or credit notes (`CREDIT_NOTE`) generated when sales invoices are modified downwards. 

Currently, the system allows using this advance to settle future invoices, but lacks any formal mechanism to return cash to the client upon request. Cashiers need an auditable, secure, and legally validated way to disburse funds back to the client while immediately updating the client's financial ledger and printing an official discharge voucher (Bon de Décharge).

## Goals / Non-Goals

**Goals:**
- Provide a dedicated transactional API endpoint `POST /api/clients/:id/refund` and listing endpoint `GET /api/clients/:id/refunds`.
- Enforce strict eligibility and ceiling: only clients with `current_balance < 0` (excluding walk-in default clients) can receive refunds, capped at $|\text{current\_balance}|$.
- Store cash refund records in a dedicated `client_refunds` table with unique reference numbers (`REF-xxxx`).
- Post an immutable `REFUND` debit entry to `client_transactions` within the same database transaction, algebraically reducing the client's advance towards zero.
- Provide a dedicated frontend modal (`ClientRefundModal.vue`) in `ClientProfileView.vue` with quick full-advance prefill and live validation.
- Provide an official printable discharge voucher (`RefundDocument.vue`) featuring enterprise headers, advance before/after summary, amount in figures and words, and dual signature zones for cashier and client.

**Non-Goals:**
- Non-cash refund methods (bank transfers, cheques) — strictly cash (`CASH`) in this version.
- Cash refunds for walk-in retail counter clients (`is_default = true`) who do not maintain rolling client accounts.
- Allowing negative refunds or refunds exceeding available advance that would put the client into debt (`current_balance > 0`).
- Automated multi-currency conversions (all amounts are in Algerian Dinars, DA).

## Decisions

### Decision 1: Dedicated `client_refunds` Table vs. Reusing `payments`
- **Choice**: Create a dedicated `client_refunds` table with foreign key reference to `client_transactions`.
- **Rationale**: The `payments` table tracks incoming cash receipts with `REC-xxxx` numbering and allocations to sales invoices. Refunds represent outgoing cash disbursements with `REF-xxxx` numbering, legally required discharge vouchers, no invoice allocations, and specific cashier/client signature requirements. Separating tables avoids polluting payment allocation logic and provides clean audit trails.
- **Alternatives considered**: Adding negative payment amounts to `payments`. Rejected because `payments` schema relies heavily on `sale_id` / invoice allocation cascades.

### Decision 2: Accounting Mechanics in `client_transactions`
- **Choice**: Post a row in `client_transactions` with `type = 'REFUND'`, `debit = refundAmount`, `credit = 0`, and update `clients.current_balance = current_balance + refundAmount`.
- **Rationale**: Since client advances are negative (`current_balance < 0`, e.g., `-25,000 DA`), disbursing cash gives away company liquidity and extinguishes the client's credit with the company. Algebraically:
  $$\text{newBalance} = -25000 + 20000 = -5000\text{ DA}$$
  A debit entry in the client ledger correctly moves the balance towards 0.
- **Alternatives considered**: Posting an `ADJUSTMENT`. Rejected because `REFUND` is semantically distinct, already present in UI type union definitions, and has its own badge and filtering behavior.

### Decision 3: Cash Method Only and Warehouse Scoping
- **Choice**: Disbursals are strictly cash-in-hand (`refund_method = 'CASH'`), allowed for any authenticated user within the active warehouse scope.
- **Rationale**: Depot desk operations operate with cash drawer accountability. Associating each refund with `warehouse_id` and `created_by` ensures multi-depot cash tracking and cashier accountability.

### Decision 4: Concurrency Locking via `SELECT ... FOR UPDATE`
- **Choice**: In `POST /api/clients/:id/refund`, execute `SELECT id, current_balance, is_default FROM clients WHERE id = $1 FOR UPDATE` inside `runTransaction`.
- **Rationale**: Serializes concurrent requests for the same client account, preventing race conditions or double disbursements across multiple browser tabs or terminals.

### Decision 5: Printable Discharge Document (`RefundDocument.vue`)
- **Choice**: Render an official Bon de Décharge with `window.print()` styles, featuring:
  1. Company header and depot name.
  2. Voucher reference (`REF-xxxx`) and timestamp.
  3. Client details (Name, Code, Phone).
  4. Financial details: Prior advance balance, refund amount (in figures and written in French words, e.g. "Vingt Mille Dinars Algériens"), and remaining advance balance.
  5. Dual signature zones: "Signature du Caissier" and "Émargement Client (Bon pour réception de la somme en espèces)".

## Risks / Trade-offs

- **[Risk: Concurrent requests depleting advance balance]** $\rightarrow$ **Mitigation**: Database row-level locking (`FOR UPDATE`) within transaction guarantees atomic balance verification and ledger posting.
- **[Risk: Cash register discrepancy without paper trail]** $\rightarrow$ **Mitigation**: Mandatory auto-generated unique reference (`REF-xxxx`), recorded `created_by` user ID, and immediate prompt to print the discharge voucher with client signature.
- **[Risk: Client balance display ambiguity]** $\rightarrow$ **Mitigation**: In UI, negative balance is explicitly styled with an "Avance disponible" badge in green, showing the exact amount available for withdrawal. The "Rembourser Avance" button is disabled whenever `current_balance >= 0`.
