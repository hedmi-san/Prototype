## MODIFIED Requirements

### Requirement: Client Registry and Directory Management
The system SHALL provide a central registry for managing commercial clients with unique codes, contact details, commercial activity, and fiscal identifiers (RC, NIF, NIS, Art, and Num Fiscal) across all warehouse depots.

#### Scenario: Registering a new client
- **WHEN** an authorized user creates a new client with a unique code, name, phone (up to 150 characters to support multi-line or annotated numbers), email, address, and optional fiscal identifiers (RC, NIF, NIS, Art, Num Fiscal)
- **THEN** the system stores the client record with an initial cached balance equal to their opening balance and marks them as active

#### Scenario: Duplicate client code prevention
- **WHEN** a user attempts to create or update a client with a code that already exists
- **THEN** the system rejects the operation with a validation error indicating the code is already taken

## ADDED Requirements

### Requirement: Fiscal and Tax Identification Attributes
The system SHALL support and index client fiscal identification numbers including Numéro Fiscal (`num_fiscal`), NIF, NIS, RC, and Art for commercial accounting, invoices, and client verification.

#### Scenario: Storing and indexing Numéro Fiscal
- **WHEN** a client is created or imported with a `num_fiscal` value
- **THEN** the system persists the field in the client record and enables indexed search queries on this identifier
