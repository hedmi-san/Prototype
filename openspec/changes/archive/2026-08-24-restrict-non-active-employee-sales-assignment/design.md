## Context

Employees in the ERP have one of four HR statuses: `ACTIVE`, `ON_LEAVE`, `SUSPENDED`, or `TERMINATED`. When creating or editing sales, an employee can be optionally assigned as the follow-up worker (`employee_id`). Currently, `CreateSaleView.vue` and `SalesListView.vue` fetch all warehouse employees regardless of status, allowing staff on leave or terminated workers to be assigned to new sales transactions. Furthermore, the backend endpoint `POST /sales` and `PUT /sales/:id` does not validate the employee's status.

## Goals / Non-Goals

**Goals:**
- Prohibit assigning non-active employees (`ON_LEAVE`, `SUSPENDED`, `TERMINATED`) to new sales in the POS frontend.
- Enforce backend validation in `sale.routes.ts` so API calls with non-active `employeeId` are rejected with HTTP 400.
- Allow `SalesListView.vue` edit modal to preserve an already assigned non-active employee for historical edits unless the user chooses to reassign to a different active worker.

**Non-Goals:**
- Changing past historical sales records retroactively.
- Preventing inactive employees from viewing their past sales history in their profile.

## Decisions

### 1. Frontend: Filter POS Dropdown to Status 'ACTIVE'
- **Decision**: In `CreateSaleView.vue`, call `employeeService.getEmployees({ warehouseId, status: 'ACTIVE' })` when warehouse changes.
- **Rationale**: Cleanest UX; cashiers only see people currently on shift/available on the warehouse floor.

### 2. Frontend: Sale Edit Modal Backward Compatibility
- **Decision**: In `SalesListView.vue`, fetch active employees for assignment, but if the edited sale has an existing assigned `employeeId` that is not in the active list (e.g. they went on leave afterwards), retain and display that employee with a `[Non actif]` tag so the assignment is not silently lost or cleared.
- **Rationale**: Prevents accidental unassignment during unrelated edits (like adjusting notes or prices on historical invoices).

### 3. Backend: Active Status Validation in Sale Routes
- **Decision**: In `backend/src/routes/sale.routes.ts`:
  - When creating a sale (`POST /sales`) with `employeeId`:
    ```sql
    SELECT id, full_name, status, active FROM employees WHERE id = $1 AND warehouse_id = $2
    ```
    If employee not found, return 400.
    If `status !== 'ACTIVE'` or `active === false`, return 400 (`L'employé sélectionné n'est pas actif (statut: ...)`).
  - When updating a sale (`PUT /sales/:id`) with modified `employeeId`:
    Validate the newly assigned employee is `ACTIVE`. If unchanged from current sale's `employee_id`, allow it.

## Risks / Trade-offs

- **[Risk]** Existing drafts or historical sales with non-active employees might fail editing if validation is too strict.
  → **Mitigation**: Allow preserving the existing assigned employee on update; only block if reassigning to a *different* employee who is non-active.
