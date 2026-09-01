# Client Financial Ledger Specification

## Purpose
Provides an immutable double-column accounting ledger (`client_transactions`) for tracking debits, credits, and progressive running balances, supporting debt calculations, advance credit tracking, multi-warehouse scoping, and Statement of Account generation.

## Requirements

### Requirement: Immutable Double-Column Financial Ledger
The system SHALL record all client financial events in a dedicated `client_transactions` table with separate non-negative `debit` and `credit` columns and an immutable snapshot of `running_balance`.

#### Scenario: Posting a sales invoice to the ledger
- **WHEN** a sales invoice is created or confirmed for a client
- **THEN** the system inserts a transaction row with type `INVOICE`, `debit` equal to the invoice total, `credit` equal to 0, snapshot `running_balance` equal to the previous running balance plus debit, and updates `clients.current_balance` in the same database transaction

#### Scenario: Posting a payment to the ledger
- **WHEN** a client payment (versement) is received
- **THEN** the system inserts a transaction row with type `PAYMENT`, `debit` equal to 0, `credit` equal to the payment amount, snapshot `running_balance` equal to previous running balance minus credit, and decrements `clients.current_balance` in the same database transaction

#### Scenario: Immutability of ledger rows
- **WHEN** a financial record is posted to the ledger
- **THEN** the system prohibits deletion or direct modification of historical ledger rows and requires compensating reversing entries (`CREDIT_NOTE` or `ADJUSTMENT`) for corrections

### Requirement: Multi-Warehouse Ledger Scoping
The system SHALL record `warehouse_id` on every financial ledger transaction and payment receipt.

#### Scenario: Filtering statement of account by warehouse
- **WHEN** a user generates a client statement of account filtering by a specific warehouse depot
- **THEN** the system returns only transactions recorded at that warehouse depot while calculating opening balance and running balances accurately for that scope

#### Scenario: Viewing company-wide global statement
- **WHEN** a user views a client statement without warehouse filter
- **THEN** the system returns all transactions across all depots with the overall consolidated running balance

### Requirement: Statement of Account (Extrait de Compte) and Export
The system SHALL provide an interactive Statement of Account view and printable PDF report.

#### Scenario: Generating Statement of Account PDF
- **WHEN** a user requests a PDF export of a client's statement for a specified date range
- **THEN** the system generates a formatted PDF document displaying client information, company header, period opening balance, tabular list of movements (Date, Warehouse, Type, Reference, Description, Debit, Credit, Running Balance), and closing debt summary
