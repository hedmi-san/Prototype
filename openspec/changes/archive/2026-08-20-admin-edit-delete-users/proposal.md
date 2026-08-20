## Why

Currently, administrators can view and create user accounts in the administrative portal, but there is no ability to edit user profile details (full name, role, assigned warehouse, active status, password reset) or delete/deactivate user accounts. This prevents administrators from managing staff turnover, updating warehouse assignments, correcting mistakes, or resetting access credentials.

## What Changes

- **User Editing (`PUT /api/admin/users/:id`)**: Allow administrators to update user details including full name, role, assigned warehouse, active status (enable/disable), and optionally update/reset the user's password.
- **User Deletion / Deactivation Safeguards (`DELETE /api/admin/users/:id`)**: Provide a deletion endpoint with integrity protections. If a user has historical operational records (sales, transfers, audit logs), safely prevent deletion or allow deactivation; prevent self-deletion or deleting the primary admin account.
- **Admin Users UI Enhancements**:
  - Add "Modifier" (Edit) and "Supprimer" (Delete) action buttons to each user row in the Users table.
  - Implement an Edit User modal allowing admins to update full name, role, assigned warehouse, status, and reset password.
  - Implement a confirmation modal for deleting or deactivating users with clear feedback.
  - Full French localization consistent with the ERP UI.
- **Audit Logging**: Log `USER_UPDATED` and `USER_DELETED` events to maintain system auditability.

## Capabilities

### New Capabilities
<!-- No new standalone capabilities required; functionality extends existing auth and user management -->

### Modified Capabilities
- `auth-access-control`: Add requirements for complete user lifecycle management (edit user attributes, reset password, delete/deactivate with safety checks, and audit logging).

## Impact

- **Backend**:
  - `backend/src/routes/user.routes.ts`: Add `PUT /:id` and `DELETE /:id` handlers with validation, safeguards, and audit logging.
- **Frontend**:
  - `frontend/src/services/admin-reports.service.ts`: Add `updateUser` and `deleteUser` API methods.
  - `frontend/src/views/admin/UsersView.vue`: Add action column with Edit and Delete buttons, Edit User modal dialog, and Delete confirmation dialog.
- **Data & Security**:
  - Prevent self-demotion/deactivation or deletion of the active logged-in admin.
  - Ensure password hashing for password updates.
  - Preserve database foreign key integrity.
