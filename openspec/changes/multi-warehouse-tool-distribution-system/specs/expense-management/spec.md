## ADDED Requirements

### Requirement: Warehouse Expense Tracking and Categorization
The system SHALL allow Managers to record, edit, and view operating expenses for their assigned warehouse categorized under predefined categories.

#### Scenario: Record warehouse operating expense
- **WHEN** a Manager logs an expense of 15,000 DZD for category `ELECTRICITY` with date and description
- **THEN** the system SHALL store the expense record bound to the Manager's warehouse and make it available in warehouse financial reporting

#### Scenario: Validate expense positive amount
- **WHEN** a user attempts to record an expense with a non-positive amount (amount <= 0)
- **THEN** the system SHALL reject the submission with a validation error
