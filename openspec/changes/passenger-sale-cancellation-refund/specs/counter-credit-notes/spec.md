## ADDED Requirements

### Requirement: Counter Credit Note Creation on Sale Cancellation
The system SHALL create an individual tracked counter credit note (`counter_credit_notes`) whenever a cash counter sale (`CLT-COMPTOIR`) is cancelled or partially cancelled, offering the user a choice between immediate cash refund and deferred credit note ticket.

#### Scenario: Immediate cash refund at cancellation
- **WHEN** a cashier cancels a walk-in sale and selects "Remboursement Immédiat en Espèces"
- **THEN** the system requires recipient Full Name and Phone Number, records a credit note with status `FULLY_REFUNDED`, records a cash refund disbursement in `client_refunds`, updates the client ledger, and displays the printable *Bon de Décharge*

#### Scenario: Deferred credit note ticket at cancellation
- **WHEN** a cashier cancels a walk-in sale and selects "Avoir Différé (Remettre Reçu au Client)"
- **THEN** the system generates an individual credit note with status `PENDING`, sets `remaining_amount = sale_total`, calculates `expiry_date = issue_date + validity_days` (default 90 days), and generates a printable *Reçu d'Avoir Comptoir* containing the expiration date and legal notice

### Requirement: Counter Credit Note Balance and Refund Tracking
The system SHALL track the initial amount, refunded amount, and remaining balance for each counter credit note, permitting partial refunds until the balance is exhausted.

#### Scenario: Partial refund leaves remaining balance
- **WHEN** a cashier issues a partial refund of 2,000 DA against an active credit note of 5,000 DA
- **THEN** the system records `refunded_amount = 2000`, sets `remaining_amount = 3000`, updates status to `PARTIALLY_REFUNDED`, and prints a *Bon de Décharge* for 2,000 DA

#### Scenario: Full refund transitions status to fully refunded
- **WHEN** a cashier refunds the remaining balance of an active credit note
- **THEN** the system sets `remaining_amount = 0`, updates status to `FULLY_REFUNDED`, and posts the corresponding debit to the client ledger

### Requirement: Configurable Expiration and Operational Status Invalidation
The system SHALL automatically transition credit notes from `PENDING` or `PARTIALLY_REFUNDED` to `EXPIRED` once the current date exceeds `expiry_date`, blocking counter cashiers from disbursing refunds without affecting the financial ledger.

#### Scenario: Unclaimed credit note past expiration period transitions to EXPIRED
- **WHEN** a credit note reaches a date greater than its `expiry_date` without being fully refunded
- **THEN** its operational status becomes `EXPIRED`, and counter refund attempts are rejected with HTTP 400

#### Scenario: Operational expiration does not post automatic ledger entries
- **WHEN** a credit note transitions to `EXPIRED`
- **THEN** no financial transactions are posted to `client_transactions`, preserving the integrity of the accounting balance until formal forfeiture review

### Requirement: Administrative Reactivation of Expired Credit Notes
The system SHALL allow authorized users with role `ADMIN` or `SUPER_MANAGER` to manually reactivate an `EXPIRED` credit note for a commercial exception.

#### Scenario: Authorized manager reactivates expired credit note
- **WHEN** an admin or super manager clicks "Réactiver l'Avoir" on an `EXPIRED` credit note with a justification note
- **THEN** the credit note status returns to `PENDING` (or `PARTIALLY_REFUNDED`), enabling cashier disbursement at the counter

### Requirement: Manual Accounting Forfeiture of Expired Credit Notes
The system SHALL allow accountants or administrators to review expired credit notes and execute a manual forfeiture ("Constater la forclusion"), posting a balancing debit transaction to extinguish the passenger account credit and recognize extraordinary income.

#### Scenario: Accountant confirms forfeiture of expired credit note
- **WHEN** an accountant or admin triggers forfeiture on an `EXPIRED` credit note of 10,000 DA
- **THEN** the credit note status changes to `FORFEITED`, the system posts a DEBIT transaction to `client_transactions` for `CLT-COMPTOIR` of 10,000 DA (Compte 758 Produits exceptionnels), bringing the passenger rolling balance closer to zero, and records an audit log entry

### Requirement: Printable Counter Credit Note Ticket (Reçu d'Avoir Comptoir)
The system SHALL provide a printable counter credit note receipt for customers departing with deferred credit notes.

#### Scenario: Printing counter credit note ticket
- **WHEN** a deferred credit note is created or viewed from the client profile
- **THEN** the system generates a printable ticket showing enterprise branding, credit note number `AVR-xxxx`, original invoice reference, issue date, validity deadline (expiry date), amount in numbers and French words, and explicit legal notice regarding the 90-day claim deadline
