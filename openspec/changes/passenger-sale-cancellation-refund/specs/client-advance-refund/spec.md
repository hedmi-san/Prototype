## MODIFIED Requirements

### Requirement: Client Advance Refund Eligibility & Cap Enforcement
The system SHALL permit cash refunds to a client when the client holds an active advance credit balance (`current_balance < 0`) or holds an active unrefunded counter credit note. For nominative clients, the refund amount is capped by the client's available rolling advance. For the default walk-in client (`is_default = true`), the refund amount MUST be tied to an active counter credit note and is strictly capped by the remaining refundable balance of that specific credit note ($0 < \text{amount} \le \text{remaining\_amount}$).

#### Scenario: Client with positive balance (debtor) attempts refund
- **WHEN** a user attempts to issue a cash refund for a client whose `current_balance >= 0` and who has no unrefunded counter credit notes
- **THEN** the system rejects the request with HTTP 400 stating that the client has no available advance credit

#### Scenario: Client with advance requests refund within available credit
- **WHEN** a nominative client with `current_balance = -25000` requests a cash refund of `20000`
- **THEN** the system approves the refund, deducts the advance, and updates `current_balance` to `-5000`

#### Scenario: Client with advance requests refund exceeding available credit
- **WHEN** a nominative client with `current_balance = -25000` requests a cash refund of `30000`
- **THEN** the system rejects the request with HTTP 400 stating that the refund amount exceeds the available credit of 25,000 DA

#### Scenario: Default walk-in customer refund tied to active credit note
- **WHEN** a user issues a cash refund for the default walk-in client (`is_default = true`) tied to an active credit note with remaining balance `5000 DA` for an amount of `5000 DA`
- **THEN** the system approves the refund, deducts `5000 DA` from the credit note remaining balance, marks the credit note as `FULLY_REFUNDED`, posts a `REFUND` debit transaction, and updates the walk-in client's balance

#### Scenario: Default walk-in customer refund exceeds individual credit note ceiling
- **WHEN** a user attempts to refund `50000 DA` on a walk-in credit note having only `5000 DA` remaining balance (even if the global walk-in balance is `-110500 DA`)
- **THEN** the system rejects the request with HTTP 400 stating that the refund amount exceeds the individual credit note refundable ceiling of 5,000 DA

### Requirement: Printable Discharge Voucher (Bon de Décharge)
The system SHALL provide a printable official cash discharge voucher for each recorded client refund, requiring recipient identity details for walk-in clients.

#### Scenario: Viewing and printing refund discharge voucher for walk-in client
- **WHEN** a user confirms a cash refund for the default walk-in client (`is_default = true`)
- **THEN** the system requires recipient Full Name and Phone Number, and renders a printable document showing enterprise header, warehouse, refund reference `REF-xxxx`, original sales invoice and credit note reference, recipient name and phone, amount in numbers and words, and dual signature sections for cashier and beneficiary
