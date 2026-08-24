## 1. Backend Implementation & Hardening

- [x] 1.1 Implement `DELETE /api/expenses/:id` endpoint in `backend/src/routes/expense.routes.ts` with role check (`ADMIN`, `MANAGER`, `ACCOUNTANT`), warehouse scope validation, and `EXPENSE_DELETED` audit logging.
- [x] 1.2 Harden `PUT /api/expenses/:id` endpoint in `backend/src/routes/expense.routes.ts` to enforce `validateWarehouseScope`, positive amount validation (`amount > 0`), and `EXPENSE_UPDATED` audit logging.

## 2. Frontend API Service

- [x] 2.1 Add `deleteExpense(id: number)` method to `expenseService` in `frontend/src/services/admin-reports.service.ts`.

## 3. Frontend View & UI Components

- [x] 3.1 Update `frontend/src/views/expenses/ExpenseListView.vue` table layout to include an "Actions" column with "Modifier" and "Supprimer" buttons.
- [x] 3.2 Implement dual create/edit state in `ExpenseListView.vue` to pre-populate modal fields when editing and dispatch `expenseService.updateExpense()`.
- [x] 3.3 Implement delete confirmation modal in `ExpenseListView.vue` with expense details, confirmation controls, and error/success messaging.

## 4. Verification & Validation

- [x] 4.1 Verify expense update functionality and validation (positive amounts, updating category and date).
- [x] 4.2 Verify expense deletion functionality and ensure confirmation modal prevents accidental deletion.
- [x] 4.3 Verify audit log generation for `EXPENSE_UPDATED` and `EXPENSE_DELETED` in the Admin Audit view.
- [x] 4.4 Verify dynamic recalculation of financial reports and dashboard expense totals after edit/delete.
