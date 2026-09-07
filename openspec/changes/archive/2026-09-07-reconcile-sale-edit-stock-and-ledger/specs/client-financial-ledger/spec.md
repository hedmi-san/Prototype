## ADDED Requirements

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
