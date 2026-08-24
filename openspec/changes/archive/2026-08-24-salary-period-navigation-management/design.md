## Context

The Multi-Warehouse Tool Distribution System records monthly salary disbursements for employees. Currently, the salary view in the frontend retrieves all records without temporal grouping or server pagination. Furthermore, salary records cannot be corrected or deleted when errors happen, and period inputs in the disbursement modal rely on standard text inputs without browser month picker enforcement.

This design outlines the integration of `AppPeriodNavigator` and `AppPagination`, API enhancements for period/pagination filtering, secured `PUT` / `DELETE` endpoints, and HTML5 `<input type="month">` controls.

## Goals / Non-Goals

**Goals:**
- Provide time-period navigation (`AppPeriodNavigator`) on the Salary Management view with granularities (Month, Quarter, Year) defaulting to Month.
- Implement server-side pagination (`page`, `limit`) and search for salary disbursements.
- Expose `PUT /api/salaries/:id` and `DELETE /api/salaries/:id` with warehouse-scoped authorization for `ADMIN`, `SUPER_MANAGER`, and `MANAGER` roles.
- Provide comprehensive audit trails (`SALARY_UPDATED`, `SALARY_DELETED`) with old/new values.
- Standardize the payroll period input to HTML5 month selectors (`type="month"`) in create and edit modals.

**Non-Goals:**
- Creating automated payroll generation or bank disbursement batch integrations.
- Modifying employee contract base salary from the salary disbursement modal (employee base salaries remain managed via employee profiles).

## Decisions

### 1. Period Filtering Query Strategy
- **Decision**: Filter salary records in backend SQL using both `period` and date ranges. In month mode, match `s.period = :period` or `s.payment_date BETWEEN :startDate AND :endDate`.
- **Alternatives Considered**: Client-side filtering only. Rejected because client-side filtering does not scale with thousands of historical salary records.

### 2. Role-Based Access Control (RBAC) Matrix
- **Decision**:
  - `GET /api/salaries`: `ADMIN`, `SUPER_MANAGER`, `MANAGER`, `ACCOUNTANT`.
  - `POST /api/salaries`: `ADMIN`, `SUPER_MANAGER`, `MANAGER`, `ACCOUNTANT`.
  - `PUT /api/salaries/:id`: `ADMIN`, `SUPER_MANAGER`, `MANAGER` (Accountant excluded).
  - `DELETE /api/salaries/:id`: `ADMIN`, `SUPER_MANAGER`, `MANAGER` (Accountant excluded).
- **Scope**:
  - `ADMIN` and `SUPER_MANAGER` can access and modify records across all warehouses.
  - `MANAGER` is strictly scoped to `req.user.warehouseId`.
- **Alternatives Considered**: Allowing `ACCOUNTANT` to edit/delete. Rejected per business requirements to keep financial modification permissions restricted to managerial and admin roles.

### 3. HTML5 Month Picker (`<input type="month">`)
- **Decision**: Use `AppInput type="month"` or native `<input type="month">` in create and edit dialogs.
- **Rationale**: HTML5 month pickers natively output and accept strings in the format `YYYY-MM` (e.g. "2026-08"), avoiding format conversion issues while providing native year/month navigation.

### 4. Paginated API Response Schema
- **Decision**: Return a paginated object structure:
  ```json
  {
    "success": true,
    "data": {
      "items": [ ... ],
      "pagination": {
        "page": 1,
        "limit": 25,
        "total": 42,
        "totalPages": 2
      },
      "summary": {
        "totalDisbursed": 2850000.00
      }
    }
  }
  ```
- **Rationale**: Matches conventions used in `auditService`, `saleService`, and `operations.service.ts`.

## Risks / Trade-offs

- **[Risk] Uniqueness Conflict on Period Edit**: Changing an employee's salary period to a month that already has a recorded salary could create a duplicate.
  - *Mitigation*: In `PUT /api/salaries/:id`, verify that no other record exists with `employee_id = target.employee_id AND period = newPeriod AND id != currentId`.
- **[Risk] Warehouse Deactivation**: Editing a salary for a deactivated warehouse.
  - *Mitigation*: Re-verify warehouse active status before executing salary updates.
