## ADDED Requirements

### Requirement: Client Advance Refund Eligibility & Cap Enforcement
The system SHALL permit cash refunds to a client only when the client holds an active advance credit balance (`current_balance < 0`) and the requested amount is strictly positive and does not exceed the available advance ($0 < \text{amount} \le |\text{current\_balance}|$).

#### Scenario: Client with positive balance (debtor) attempts refund
- **WHEN** a user attempts to issue a cash refund for a client whose `current_balance >= 0`
- **THEN** the system rejects the request with HTTP 400 stating that the client has no available advance credit

#### Scenario: Client with advance requests refund within available credit
- **WHEN** a client with `current_balance = -25000` requests a cash refund of `20000`
- **THEN** the system approves the refund, deducts the advance, and updates `current_balance` to `-5000`

#### Scenario: Client with advance requests refund exceeding available credit
- **WHEN** a client with `current_balance = -25000` requests a cash refund of `30000`
- **THEN** the system rejects the request with HTTP 400 stating that the refund amount exceeds the available credit of 25,000 DA

#### Scenario: Default walk-in customer attempts advance refund
- **WHEN** a user attempts to issue an advance refund for the default walk-in client (`is_default = true`)
- **THEN** the system rejects the request with HTTP 400 stating that walk-in retail clients do not maintain rolling credit advance accounts

### Requirement: Cash Refund Processing and Audit Trail
The system SHALL record cash refund disbursements in a dedicated `client_refunds` table, post an immutable debit transaction to `client_transactions`, and enforce row-level locking.

#### Scenario: Cash refund recorded in database
- **WHEN** a cash refund of 20,000 DA is confirmed
- **THEN** the system creates a row in `client_refunds` with a unique receipt number (`REF-xxxx`), `refund_method = 'CASH'`, posts a `REFUND` debit to `client_transactions`, and updates `clients.current_balance` within a single database transaction

#### Scenario: Concurrency locking prevents double refund
- **WHEN** two refund requests for the same client arrive simultaneously
- **THEN** row-level locking (`SELECT ... FOR UPDATE`) serializes the requests such that the second request re-evaluates the updated balance and fails if the available advance has been depleted

### Requirement: Printable Discharge Voucher (Bon de Décharge)
The system SHALL provide a printable official cash discharge voucher for each recorded client refund.

#### Scenario: Viewing and printing refund discharge voucher
- **WHEN** a user confirms a refund or selects a past refund record to view
- **THEN** the system displays a printable document showing enterprise header, warehouse, refund reference, client details, amount in numbers and words, prior advance, refunded amount, remaining advance, and dual signature sections for cashier and client
