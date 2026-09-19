## MODIFIED Requirements

### Requirement: Statement of Account (Extrait de Compte) and Export
The system SHALL provide an interactive Statement of Account view, paginated ledger API, and printable PDF/CSV report bounded by a mandatory or default date range.

#### Scenario: Default date-range scoping for regular clients
- **WHEN** a user navigates to the statement view for a named client without specifying date parameters
- **THEN** the system defaults the filter to the current month (first calendar day of the current month through today) and queries only transactions within that period

#### Scenario: Calculating period opening balance via indexed range query
- **WHEN** a statement is requested with a start date filter
- **THEN** the system calculates the prior opening balance using a dedicated indexed aggregate query (`SUM(debit) - SUM(credit)` for transactions before the start date) and displays it as the starting balance

#### Scenario: Paginated ledger rows with dynamic running balances
- **WHEN** a user requests a specific page (e.g. 50 records per page) within a statement period
- **THEN** the system returns only that page's slice of transactions while projecting the correct progressive running balance for each row starting from the period's carried-forward balance

#### Scenario: Warehouse-filtered statement running balance
- **WHEN** a user filters the statement by a specific warehouse depot
- **THEN** the system restricts both the prior opening balance query and the period transaction query to the specified warehouse, dynamically computing running balances specific to that depot

#### Scenario: Generating Statement of Account PDF
- **WHEN** a user requests a PDF export of a client's statement for a specified date range
- **THEN** the system generates a formatted PDF document displaying client information, company header, period opening balance, tabular list of movements (Date, Warehouse, Type, Reference, Description, Debit, Credit, Running Balance), and closing debt summary

## ADDED Requirements

### Requirement: Default Walk-in Client Ledger Scoping and Audit Navigation
The system SHALL provide specialized daily scoping, performance safeguards, and audit navigation for the default walk-in counter customer (`Client Passager / Comptoir`).

#### Scenario: Default daily scoping for walk-in client
- **WHEN** a user opens the profile or statement of the default walk-in client (`is_default = true`)
- **THEN** the system defaults the date range filter to the current day (`today 00:00:00` to `23:59:59`) rather than the entire month

#### Scenario: Informational banner on high-volume walk-in ledger
- **WHEN** viewing the default walk-in client statement
- **THEN** the UI displays an informational notice explaining that the profile aggregates anonymous counter sales and that the view is restricted to today by default to optimize performance

#### Scenario: Cross-navigation to sales journal for walk-in audits
- **WHEN** an operator needs to conduct cross-cutting audits (e.g. by till, cashier, or receipt number) for walk-in sales
- **THEN** the UI provides a direct shortcut link navigating to the Sales Journal pre-filtered on the default walk-in client
