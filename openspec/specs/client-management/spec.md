# Client Management Specification

## Purpose
Provides a central client registry for managing commercial customer accounts, contact details, walk-in counter buyer handling, and company-wide client directory access across all warehouse depots.

## Requirements

### Requirement: Client Registry and Directory Management
The system SHALL provide a central registry for managing commercial clients with unique codes, contact details, and activity status.

#### Scenario: Registering a new client
- **WHEN** an authorized user creates a new client with a unique code, name, phone, email, and address
- **THEN** the system stores the client record with an initial cached balance equal to their opening balance and marks them as active

#### Scenario: Duplicate client code prevention
- **WHEN** a user attempts to create or update a client with a code that already exists
- **THEN** the system rejects the operation with a validation error indicating the code is already taken

### Requirement: Default Walk-in Customer (Client Passager / Comptoir)
The system SHALL maintain a pre-seeded default client record designated for anonymous walk-in counter sales without requiring manual registration for casual buyers.

#### Scenario: Automatic seeding of walk-in client
- **WHEN** the database schema is initialized or migrated
- **THEN** the system ensures a default client record with code `CLT-COMPTOIR` and name `Client Passager / Comptoir` exists and is marked as the default client

#### Scenario: Walk-in client balance handling
- **WHEN** cash sales are completed for the default walk-in customer
- **THEN** the sales are recorded consistently while maintaining a zero-debt status on the default customer profile

### Requirement: Client Profile and Key Metrics
The system SHALL provide a dedicated client profile view displaying master details, real-time debt, total sales volume, and total payments collected.

#### Scenario: Viewing client profile summary
- **WHEN** a user navigates to a client's profile page
- **THEN** the system displays the client's current balance (color-coded as debtor, settled, or creditor), total sales amount, total payments received, and count of open unpaid invoices

### Requirement: Global Client Access Across Warehouses
The system SHALL allow clients to be accessed, selected, and billed globally across all warehouses within the distribution network.

#### Scenario: Accessing client from any warehouse depot
- **WHEN** a salesperson or cashier at any active warehouse selects a client
- **THEN** the client is available in the selection list and their global company balance is displayed
