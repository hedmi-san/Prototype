## ADDED Requirements

### Requirement: Multi-Warehouse File Ingestion and Header Tolerance
The system SHALL accept multiple warehouse client XLSX files concurrently, map source columns flexibly regardless of legacy spelling variations, and strip local auto-incremented `Code Cli.` values.

#### Scenario: Flexible column header detection
- **WHEN** an administrator uploads warehouse XLSX exports containing header variations (e.g. `Solde Actuel`, `Tyep Cli.`, `ACTIVITEE`, `TEL`, `Nº Registre`, `Nº Article`, `Nº Fiscal`)
- **THEN** the system correctly identifies and maps the corresponding fields while omitting the local `Code Cli.` column

#### Scenario: Address and commercial activity composition
- **WHEN** parsing a row with both `Adresse` and `Wilaya`, or both `Tyep Cli.` and `ACTIVITEE`
- **THEN** the system appends `Wilaya` to `Adresse` (if not already present), and combines `Tyep Cli.` and `ACTIVITEE` into `activite`

### Requirement: Client Entity Normalization
The system SHALL normalize client names, phone numbers, and fiscal identifiers to enable reliable cross-warehouse identity resolution.

#### Scenario: Legal form and accent normalization
- **WHEN** comparing names with variations in legal forms (e.g. `SARL`, `EURL`, `SNC`, `GROUPE`), accents, or punctuation
- **THEN** the system cleans and normalizes the tokens so that entities like `SARL GROUPE MERCURE` and `GROUPE MERCURE SARL` evaluate as matching identities

#### Scenario: Phone extraction from descriptive strings
- **WHEN** a phone field contains multiple numbers or contact names (e.g. `0661.63.06.56 / 0660201603 LOSSIF`)
- **THEN** the system extracts clean 9-10 digit Algerian phone numbers for matching while preserving the full original descriptive string for storage

#### Scenario: Preservation of leading zeros on tax identifiers
- **WHEN** parsing numeric-like tax identifiers (e.g. Article `06230120401` or RC `08.A.1840594`)
- **THEN** the system treats them strictly as strings, preserving leading zeros and stripping non-alphanumeric punctuation for comparison

### Requirement: Tiered Identity Matching
The system SHALL classify cross-warehouse client pairs into Tier 1 (Auto-Merge), Tier 2 (Manual Review Queue), and Tier 3 (Standalone Clients).

#### Scenario: Tier 1 auto-merging on strong tax identifier
- **WHEN** two or more records share an identical non-empty RC or Article number AND have consistent names (similarity $\ge 0.50$ or phone match)
- **THEN** the system automatically clusters them into a single consolidated client with their balances summed

#### Scenario: Tier 1 auto-merging on name and phone match
- **WHEN** two records share an identical normalized name and at least one matching phone number
- **THEN** the system automatically clusters them into a single consolidated client with their balances summed

#### Scenario: Tier 2 flagging on conflicting names with identical tax ID
- **WHEN** two records share an identical tax identifier (RC or Article) but have substantially different names (similarity $< 0.50$)
- **THEN** the system places the records in the Tier 2 manual review queue without summing their balances

#### Scenario: Tier 2 flagging on identical names with conflicting or missing phones
- **WHEN** two records share an identical name but have conflicting phone numbers or lack contact/tax identifiers
- **THEN** the system places the records in the Tier 2 manual review queue for human verification

### Requirement: Manual Review and Conflict Resolution Interface
The system SHALL provide an interactive visual review interface allowing operators to confirm or reject Tier 2 matches and select preferred values for conflicting fields.

#### Scenario: Resolving a Tier 2 match
- **WHEN** an operator reviews a flagged match and clicks "Merge Records"
- **THEN** the system consolidates the records, sums their opening balances, and applies the selected field values

#### Scenario: Rejecting a Tier 2 match
- **WHEN** an operator reviews a flagged match and clicks "Keep Separate"
- **THEN** the system treats the records as distinct independent clients with individual balances

### Requirement: Multi-Warehouse Opening Balance Ledger Integrity
The system SHALL preserve warehouse-level accountability by recording opening balance entries in `client_transactions` tagged to each source warehouse.

#### Scenario: Ledger entry creation per source warehouse
- **WHEN** a consolidated client is imported with balances originating from multiple warehouses (e.g. +50,000 DZD in Warehouse A and -10,000 DZD in Warehouse B)
- **THEN** the system creates a master client record with current balance +40,000 DZD and inserts distinct `OPENING_BALANCE` entries in `client_transactions` for Warehouse A and Warehouse B
