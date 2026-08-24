## Context

In the Multi-Warehouse Tool Distribution Management system, operating expenses (such as electricity, water, rent, fuel, and maintenance) are recorded per warehouse. While the initial backend implementation introduced `GET /api/expenses`, `POST /api/expenses`, and a basic `PUT /api/expenses/:id`, the frontend `ExpenseListView.vue` only supported creation without any row action buttons or edit/delete workflows. Furthermore, `DELETE /api/expenses/:id` was never implemented on the server, and `PUT /api/expenses/:id` lacked warehouse scope validation.

This design establishes a unified UX and secure backend endpoints for editing and deleting expense records.

## Goals / Non-Goals

**Goals:**
- Provide a responsive, consistent table action UI in `ExpenseListView.vue` featuring `Modifier` (Edit) and `Supprimer` (Delete) buttons.
- Implement a dual-mode modal (Create / Edit) with pre-filled fields and client-side validation.
- Implement a dedicated delete confirmation modal with clear expense details and destructive action styling.
- Provide `deleteExpense(id: number)` in the frontend `admin-reports.service.ts`.
- Implement `DELETE /api/expenses/:id` in Express with authentication, role enforcement (`ADMIN`, `MANAGER`, `ACCOUNTANT`), warehouse scoping checks, and audit logging.
- Harden `PUT /api/expenses/:id` with strict warehouse scoping, positive amount validation, and audit logging.

**Non-Goals:**
- Introducing complex recurring expense automation or scheduled invoicing.
- Altering the database schema or creating soft-delete flags (the database uses physical deletion with audit log persistence).
- Modifying financial report calculation logic (reports query dynamically from `expenses` and automatically reflect changes).

## Decisions

### 1. Dual-Purpose Modal vs. Separate Edit Component
- **Decision**: Adapt the existing `AppModal` in `ExpenseListView.vue` to dynamically handle both creation and editing depending on `editingExpense.value`.
- **Rationale**: Keeps the codebase concise and eliminates duplicated form markup and validation logic.
- **Alternatives Considered**: Creating a standalone `EditExpenseModal.vue` component. Rejected because the expense entity has only 5 fields (`warehouseId`, `category`, `amount`, `description`, `expenseDate`), making a single managed form cleaner and easier to maintain.

### 2. Delete Confirmation Dialog Pattern
- **Decision**: Use a dedicated `AppModal` with warning banner and confirmation actions rather than native browser `window.confirm()`.
- **Rationale**: Aligns with the design patterns established in `UsersView.vue` and `InventoryListView.vue`, providing localized French messaging, clear visual feedback, and asynchronous loading states.

### 3. Role and Warehouse Scoping Rules
- **Decision**:
  - `ADMIN`: Full authority to edit and delete any expense across all warehouses.
  - `MANAGER` & `ACCOUNTANT`: Authority to edit and delete expenses restricted to their assigned warehouse via `validateWarehouseScope(req.user, expense.warehouse_id)`.
  - `SALESPERSON`: No access to expense management endpoints.

### 4. Audit Logging Strategy
- **Decision**:
  - On Edit: Call `logAudit(req.user, 'EXPENSE_UPDATED', 'EXPENSE', id, ...)` capturing `old_values` and `new_values` JSON.
  - On Delete: Call `logAudit(req.user, 'EXPENSE_DELETED', 'EXPENSE', id, ...)` capturing full deleted record context in `old_values`.

## Risks / Trade-offs

- **[Risk] Retroactive Financial Reporting Changes** → Modifying or deleting past expenses will change the historical net profit calculations for that month.
  - *Mitigation*: All modifications and deletions are tracked in the immutable `audit_logs` table with previous and updated amounts, user ID, timestamp, and warehouse.
- **[Risk] Accidental Deletion** → A user might mistakenly click delete.
  - *Mitigation*: The delete confirmation modal explicitly displays the expense amount, date, category, and warehouse name, requiring an intentional confirmation click.
