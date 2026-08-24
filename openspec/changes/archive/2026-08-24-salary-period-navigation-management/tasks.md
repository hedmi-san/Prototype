## 1. Backend Route & RBAC Enhancements

- [x] 1.1 Update `GET /api/salaries` in `backend/src/routes/salary.routes.ts` to support `page`, `limit`, `period`, `startDate`, `endDate`, `search`, returning paginated items and total summary
- [x] 1.2 Update `POST /api/salaries` role permissions to allow `ADMIN`, `SUPER_MANAGER`, `MANAGER`, and `ACCOUNTANT`
- [x] 1.3 Implement `PUT /api/salaries/:id` with `requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER')`, warehouse scoping, uniqueness check on `(employee_id, period)`, and `SALARY_UPDATED` audit log
- [x] 1.4 Implement `DELETE /api/salaries/:id` with `requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER')`, warehouse scoping, and `SALARY_DELETED` audit log

## 2. Frontend Services & Types

- [x] 2.1 Update `SalaryRecord` and `salaryService` in `frontend/src/services/admin-reports.service.ts` to support paginated queries, `updateSalary`, and `deleteSalary`
- [x] 2.2 Verify response compatibility with existing frontend salary consumers (e.g. employee details view)

## 3. Frontend UI & UX Enhancements

- [x] 3.1 Integrate `AppPeriodNavigator` in `frontend/src/views/salaries/SalaryManagementView.vue` with granularities (Month, Quarter, Year) defaulting to Month mode
- [x] 3.2 Update salary period input in disbursement modal to use HTML5 month selector (`type="month"`)
- [x] 3.3 Add `AppPagination` to `SalaryManagementView.vue` for page and limit management
- [x] 3.4 Add Edit & Delete action buttons in the salaries table, conditionally rendered for `ADMIN`, `SUPER_MANAGER`, and `MANAGER`
- [x] 3.5 Implement Salary Edit modal with prefilled employee data, recalculation of net amount, and month selector
- [x] 3.6 Implement Delete confirmation dialog using `ConfirmDialog` component

## 4. Verification & Testing

- [x] 4.1 Test period navigation and month stepper actions across different months and granularities
- [x] 4.2 Test pagination and search filtering in salary management view
- [x] 4.3 Test salary edit and delete workflows under `ADMIN`, `MANAGER`, and `ACCOUNTANT` roles to verify RBAC enforcement
- [x] 4.4 Verify audit logs recorded for `SALARY_PAID`, `SALARY_UPDATED`, and `SALARY_DELETED`
