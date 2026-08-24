## ADDED Requirements

### Requirement: Employee Operational Status Enforcement in Business Workflows
The system SHALL enforce that employees with non-active statuses (`ON_LEAVE`, `SUSPENDED`, `TERMINATED`) are excluded from active operational assignments including POS sale creation and live order attribution, while preserving their historical performance and remuneration records.

#### Scenario: Filter employees by active status for operational services
- **WHEN** frontend operational views request employees with `status: 'ACTIVE'` via `employeeService.getEmployees`
- **THEN** the API SHALL return exclusively employees whose `status` equals `ACTIVE` and `active` is `true`
