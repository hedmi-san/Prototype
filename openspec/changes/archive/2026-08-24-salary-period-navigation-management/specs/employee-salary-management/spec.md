## ADDED Requirements

### Requirement: Salary Period Navigation and Filtering
The system SHALL provide a period navigation component on the salary management view allowing users to filter salary records by calendar periods (`Mois`, `Trimestre`, `Année`) and navigate between periods using unit steppers, date pickers, or reset shortcuts.

#### Scenario: Navigate to a previous month
- **WHEN** an authorized user views the salary management page and clicks the previous period stepper button in Month mode
- **THEN** the system SHALL update the active period to the preceding month and fetch salary disbursements matching that period

#### Scenario: Display total disbursed for selected period
- **WHEN** an active period is selected
- **THEN** the salary management summary badge SHALL compute and display the sum of total disbursed salaries for that period

### Requirement: Salary Records Pagination and Search
The system SHALL support server-side pagination and text search for salary records based on employee name, warehouse name, and payment period.

#### Scenario: Paginate through salary records
- **WHEN** an authorized user requests page 2 with page size 10 of salary disbursements
- **THEN** the backend SHALL return the corresponding page of 10 items along with total records, total pages, and current page metadata

#### Scenario: Search salary records
- **WHEN** a user enters a search term into the search input
- **THEN** the system SHALL filter salary records by employee name, warehouse name, or period matching the query within the selected period scope

### Requirement: Salary Record Update and Scope Authorization
The system SHALL allow users with `ADMIN`, `SUPER_MANAGER`, or `MANAGER` roles to update existing salary records within their warehouse scope while recalculating total amounts and logging audit trails.

#### Scenario: Manager updates salary bonus for an employee in their warehouse
- **WHEN** a Manager updates `bonus1` to 15,000 DZD and `paymentDate` to "2026-08-25" for a salary record in their assigned warehouse
- **THEN** the system SHALL recalculate `total_amount = base_salary + bonus1 + bonus2`, persist the changes, and create an audit log entry with action `SALARY_UPDATED` containing old and new values

#### Scenario: Unauthorized role attempts to update salary record
- **WHEN** an `ACCOUNTANT` or unauthenticated user attempts to call `PUT /api/salaries/:id`
- **THEN** the system SHALL reject the request with HTTP 403 Forbidden

### Requirement: Salary Record Deletion and Audit Logging
The system SHALL allow users with `ADMIN`, `SUPER_MANAGER`, or `MANAGER` roles to delete salary records within their warehouse scope with full audit logging.

#### Scenario: Super Manager deletes an erroneous salary record
- **WHEN** a Super Manager confirms the deletion of a salary disbursement record
- **THEN** the system SHALL delete the record from the database, record an audit log with action `SALARY_DELETED` detailing the deleted record, and refresh the salary table

### Requirement: HTML5 Month Selector for Payroll Period Validation
The system SHALL use HTML5 month selector inputs (`type="month"`) for payroll period selection in salary disbursement and edit forms, enforcing the standard `YYYY-MM` format.

#### Scenario: Select payroll period using month picker
- **WHEN** a user opens the salary disbursement or edit modal and selects August 2026
- **THEN** the input SHALL store and submit the period value strictly in `YYYY-MM` format ("2026-08")
