## Why

When an employee's HR status is changed to `ON_LEAVE` (En congé), `SUSPENDED` (Suspendu), or `TERMINATED` (Inactif), they are not currently working or available to serve customers. However, the POS sale creation and editing interfaces currently allow selecting and attaching non-active workers as the assigned sales agent ("Agent de suivi"). Furthermore, the backend does not enforce employee status validation during sale creation. This allows assigning sales and commission metrics to absent or terminated staff.

## What Changes

- **POS Sale Creation Employee Restriction**: In `CreateSaleView.vue`, filter the employee selector to only list `ACTIVE` employees from the selected warehouse. Employees with status `ON_LEAVE`, `SUSPENDED`, or `TERMINATED` are excluded from new sale assignment.
- **Sale Editing Employee Filtering**: In `SalesListView.vue`, restrict the agent selector to `ACTIVE` employees, while gracefully preserving and displaying any previously assigned employee (even if their status subsequently changed to non-active).
- **Backend Validation**: In `backend/src/routes/sale.routes.ts` (`POST /sales` and `PUT /sales/:id`), validate that if an `employeeId` is provided, the employee exists, belongs to the sale's warehouse, and has status `ACTIVE`. Return a `400 Bad Request` with an appropriate French error message if attempting to assign a non-active employee to a new sale.
- **Service Query Parameter**: Update `employeeService.getEmployees` calls in sales views to request `{ warehouseId, status: 'ACTIVE' }` for operational assignment.

## Capabilities

### New Capabilities
<!-- No new capabilities needed -->

### Modified Capabilities
- `sales-management`: Restrict follow-up worker assignment (`employee_id`) during sale creation and updates to active employees only (`status = 'ACTIVE'`), with backend enforcement.
- `employee-salary-management`: Enforce operational status scoping where non-active employees (`ON_LEAVE`, `SUSPENDED`, `TERMINATED`) are prohibited from active sales assignment workflows.

## Impact

- **Frontend**: `CreateSaleView.vue` (POS), `SalesListView.vue` (Sale edit modal).
- **Backend**: `backend/src/routes/sale.routes.ts` (`POST /sales`, `PUT /sales/:id` validation).
- **APIs**: `employeeService.getEmployees` with status filtering.
- **Database**: No schema changes required (`status` column already exists in `employees`).
