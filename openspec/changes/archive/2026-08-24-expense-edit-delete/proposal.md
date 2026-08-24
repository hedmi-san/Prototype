## Why

Currently, users cannot modify or delete recorded operating expenses in the Expense section (`ExpenseListView.vue`). While `PUT /api/expenses/:id` partially exists on the backend, there is no UI trigger, no warehouse scoping check on updates, no `DELETE /api/expenses/:id` endpoint in the backend, and no `deleteExpense` method in the frontend API client. This causes errors when correcting mistaken entries and prevents managers/administrators from keeping expense ledgers accurate.

## What Changes

- **Frontend Expense Actions & Edit Modal**: Add an "Actions" column to `ExpenseListView.vue` with "Modifier" (Edit) and "Supprimer" (Delete) action buttons.
- **Edit Expense Workflow**: Support opening a pre-populated modal for modifying category, amount, description, and expense date with client-side positive-amount validation.
- **Delete Expense Workflow**: Support a confirmation modal for removing an expense with detailed warning information and loading states.
- **Frontend API Service Expansion**: Add `deleteExpense(id: number)` to `admin-reports.service.ts`.
- **Backend Expense Delete Endpoint**: Implement `DELETE /api/expenses/:id` with role authorization (`ADMIN`, `MANAGER`, `ACCOUNTANT`), warehouse scoping validation, and `EXPENSE_DELETED` audit logging.
- **Backend Expense Update Scope & Validation**: Harden `PUT /api/expenses/:id` with `validateWarehouseScope` checks, positive amount enforcement, and audit logging with old/new values.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `expense-management`: Add requirements and scenarios for editing existing expenses, deleting expenses with authorization checks and warehouse scoping, and maintaining full audit logging.

## Impact

- **Frontend Files**:
  - `frontend/src/views/expenses/ExpenseListView.vue`: Table columns, action buttons, edit state, delete confirmation modal.
  - `frontend/src/services/admin-reports.service.ts`: `deleteExpense(id)` method.
- **Backend Files**:
  - `backend/src/routes/expense.routes.ts`: `DELETE /:id` endpoint, improved `PUT /:id` validation and scope checking.
- **Financial Reports & Audit**:
  - `backend/src/routes/report.routes.ts`: Dynamically reflects edited/deleted expenses without schema migrations.
  - `audit_logs` table: Captures `EXPENSE_UPDATED` and `EXPENSE_DELETED` entries.
