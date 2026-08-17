# employee-salary-management Specification

## Purpose
TBD - created by archiving change multi-warehouse-tool-distribution-system. Update Purpose after archive.
## Requirements
### Requirement: Warehouse Employee Management
The system SHALL allow Managers to register, update, and manage employee profiles belonging to their warehouse with fixed monthly base salary rates.

#### Scenario: Register warehouse employee
- **WHEN** a Manager creates an employee record with first name, last name, position, contact phone, hire date, and monthly base salary
- **THEN** the system SHALL create the employee record associated with the Manager's warehouse

### Requirement: Monthly Salary and Holiday Bonus Logging
The system SHALL record monthly salary disbursement records and support up to two holiday bonus allocations per employee.

#### Scenario: Record monthly salary with holiday bonus
- **WHEN** a Manager logs a salary record for period "2026-08" with base salary 60,000 DZD, bonus 1 of 10,000 DZD, and bonus 2 of 0 DZD
- **THEN** the system SHALL compute total amount 70,000 DZD, save the salary record in `PAID` status, and include it in warehouse salary totals

