## MODIFIED Requirements

### Requirement: Warehouse Expense Tracking and Categorization
The system SHALL allow authorized users (Admin, Manager, Accountant) to record, edit, view, and delete operating expenses for warehouses categorized under predefined categories, with warehouse scoping and audit logging.

#### Scenario: Record warehouse operating expense
- **WHEN** a Manager logs an expense of 15,000 DZD for category `ELECTRICITY` with date and description
- **THEN** the system SHALL store the expense record bound to the Manager's warehouse and make it available in warehouse financial reporting

#### Scenario: Validate expense positive amount
- **WHEN** a user attempts to record or update an expense with a non-positive amount (amount <= 0)
- **THEN** the system SHALL reject the submission with a validation error

#### Scenario: Edit existing warehouse expense
- **WHEN** an authorized user modifies the amount, category, date, or description of an existing expense
- **THEN** the system SHALL update the expense record, validate positive amount and warehouse scope, update financial reporting totals dynamically, and log an `EXPENSE_UPDATED` audit record with previous and new values

#### Scenario: Delete existing warehouse expense
- **WHEN** an authorized user confirms the deletion of an existing expense record
- **THEN** the system SHALL remove the expense record from the database, adjust financial calculations dynamically, and record an `EXPENSE_DELETED` audit event

#### Scenario: Prevent cross-warehouse expense mutation
- **WHEN** a Manager attempts to edit or delete an expense belonging to a different warehouse
- **THEN** the system SHALL reject the request with an unauthorized 403 error
