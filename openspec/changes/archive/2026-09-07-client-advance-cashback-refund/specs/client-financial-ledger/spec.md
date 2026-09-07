## ADDED Requirements

### Requirement: Client Advance Cash Refund Posting
The system SHALL post an immutable `REFUND` debit transaction in `client_transactions` and update `clients.current_balance` algebraically when cash is disbursed to a nominative client holding an advance credit balance.

#### Scenario: Cash refund disbursed to nominative client with advance
- **WHEN** a cash refund of amount $X$ is disbursed to a nominative client with `current_balance < 0`
- **THEN** the system inserts a transaction row into `client_transactions` with `type = 'REFUND'`, `debit = X`, `credit = 0`, `reference_type = 'REFUND'`, `reference_id = refund.id`, `warehouse_id = refund.warehouse_id`, `description = 'Remboursement d\'avance en espèces [<refund_number>]'`, and updates `clients.current_balance = current_balance + X` within the same database transaction
