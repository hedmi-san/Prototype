## 1. Backend User Management API

- [x] 1.1 Implement `PUT /api/admin/users/:id` in `backend/src/routes/user.routes.ts` supporting full name, role, warehouse ID, active status, optional password reset, self-protection checks, and `USER_UPDATED` audit logging
- [x] 1.2 Implement `DELETE /api/admin/users/:id` in `backend/src/routes/user.routes.ts` with self-deletion protection, transactional foreign key reference verification (`sales`, `transfers`), user deletion, and `USER_DELETED` audit logging

## 2. Frontend Service Integration

- [x] 2.1 Add `updateUser` and `deleteUser` methods to `adminService` in `frontend/src/services/admin-reports.service.ts`

## 3. Frontend User Management Interface

- [x] 3.1 Add Actions column to user list table in `frontend/src/views/admin/UsersView.vue` with Edit and Delete buttons
- [x] 3.2 Implement Edit User modal dialog in `frontend/src/views/admin/UsersView.vue` supporting profile edits, role selection, warehouse assignment, active toggle, and optional password reset
- [x] 3.3 Implement Delete confirmation modal in `frontend/src/views/admin/UsersView.vue` with error and deactivation guidance handling

## 4. Verification and Validation

- [x] 4.1 Verify editing user profile, changing role, assigning warehouse, toggling active status, and updating password
- [x] 4.2 Verify deletion constraints (prevent self-delete, prevent deleting users with sales/transfers with informative error, delete unreferenced accounts)
- [x] 4.3 Verify audit logs in `AuditLogsView.vue` capture `USER_UPDATED` and `USER_DELETED` entries
