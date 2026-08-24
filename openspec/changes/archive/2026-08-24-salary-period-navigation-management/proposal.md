## Why

Currently, the Salary Management module displays salary disbursements without time-period filtering or server pagination, which hampers navigation as salary history grows. Additionally, salary disbursements cannot be edited or deleted by authorized managers when adjustments or corrections are needed, and entering the payment period manually via free text is prone to typographical formatting errors. 

Introducing period navigation, pagination, strict role-based edit/delete capabilities, and a standardized HTML5 month selector provides an efficient, error-resistant, and secure payroll management workflow.

## What Changes

- **Payment Period Navigation**: Integrate time-period navigation into the Salary Management view with granular selection (Month, Quarter, Year) and stepper actions, defaulting to the current month.
- **Server Pagination & Search**: Add pagination (limit, page, total) and server-side filtering for salary records.
- **Salary Record Edit & Delete**: Enable `ADMIN`, `SUPER_MANAGER`, and `MANAGER` roles to edit (base salary, bonuses, payment date, period) and delete salary records within their warehouse scope with full audit logging.
- **HTML5 Month Selector**: Replace manual text inputs for payroll periods with native HTML5 month pickers (`type="month"`) in both creation and modification forms to enforce standard `YYYY-MM` formats.
- **Role-Based Access Control**: Restrict update and delete operations strictly to `ADMIN`, `SUPER_MANAGER`, and `MANAGER` (excluding `ACCOUNTANT`).

## Capabilities

### New Capabilities
<!-- No brand new standalone capabilities; modifications extend existing capabilities -->

### Modified Capabilities
- `employee-salary-management`: Adds period filtering, server-side pagination, update/delete salary operations for authorized roles (`ADMIN`, `SUPER_MANAGER`, `MANAGER`), and HTML5 month selector validation.

## Impact

- **Frontend**:
  - `frontend/src/views/salaries/SalaryManagementView.vue`: Integrate `AppPeriodNavigator`, `AppPagination`, Action buttons (Edit/Delete), Edit Modal, and native HTML5 month input.
  - `frontend/src/services/admin-reports.service.ts`: Update `salaryService` to support paginated/filtered queries (`getSalaries`), `updateSalary`, and `deleteSalary`.
- **Backend**:
  - `backend/src/routes/salary.routes.ts`: Update `GET /` with pagination, period, and search query parameters; add `PUT /:id` and `DELETE /:id` with `requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER')`, warehouse scoping, and audit logs (`SALARY_UPDATED`, `SALARY_DELETED`).
- **Database**:
  - Existing `salaries` and `audit_logs` tables remain compatible; audit logging records old and new values for salary updates.
