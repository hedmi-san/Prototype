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

### Requirement: Client Ledger Adjustment on Sale Modification
The system SHALL post compensating or complementary financial entries in `client_transactions` and update `clients.current_balance` when an invoice total attached to a client is modified.

#### Scenario: Nominative client invoice total decreased
- **WHEN** an invoice for a nominative client is edited such that $\Delta_{\text{total}} = \text{newTotal} - \text{oldTotal} < 0$ (e.g., -101,000 DA)
- **THEN** the system inserts a `CREDIT_NOTE` row into `client_transactions` with `credit = 101,000`, `debit = 0`, `reference_type = 'SALES_EDIT'`, `reference_id = sale.id`, `description = '[<revRef>] Avoir suite modification facture <invoiceNumber> (-101 000,00 DA)'`, and reduces `clients.current_balance` by 101,000 DA

#### Scenario: Nominative client invoice total increased
- **WHEN** an invoice for a nominative client is edited such that $\Delta_{\text{total}} = \text{newTotal} - \text{oldTotal} > 0$ (e.g., +49,000 DA)
- **THEN** the system inserts an `INVOICE` row into `client_transactions` with `debit = 49,000`, `credit = 0`, `reference_type = 'SALES_EDIT'`, `reference_id = sale.id`, `description = '[<revRef>] Complément de facturation suite modification <invoiceNumber> (+49 000,00 DA)'`, and increases `clients.current_balance` by 49,000 DA

#### Scenario: Walk-in counter customer cash refund tracking
- **WHEN** an invoice for the default walk-in client (`is_default = true`) is edited downwards
- **THEN** the system inserts a `CREDIT_NOTE` for the amount reduction followed by a compensating cash refund (`REFUND`) debit for the same amount, keeping the walk-in client balance at 0.00 DA while providing full cash register auditability

#### Scenario: Invoice total unchanged
- **WHEN** a sale invoice is edited without changing the total amount ($\Delta_{\text{total}} = 0$, e.g. customer name update or offsetting item changes)
- **THEN** no financial transactions are added to `client_transactions` and `clients.current_balance` remains untouched

### Requirement: Client Advance Cash Refund Posting
The system SHALL post an immutable `REFUND` debit transaction in `client_transactions` and update `clients.current_balance` algebraically when cash is disbursed to a nominative client holding an advance credit balance.

#### Scenario: Cash refund disbursed to nominative client with advance
- **WHEN** a cash refund of amount $X$ is disbursed to a nominative client with `current_balance < 0`
- **THEN** the system inserts a transaction row into `client_transactions` with `type = 'REFUND'`, `debit = X`, `credit = 0`, `reference_type = 'REFUND'`, `reference_id = refund.id`, `warehouse_id = refund.warehouse_id`, `description = 'Remboursement d\'avance en espèces [<refund_number>]'`, and updates `clients.current_balance = current_balance + X` within the same database transaction


