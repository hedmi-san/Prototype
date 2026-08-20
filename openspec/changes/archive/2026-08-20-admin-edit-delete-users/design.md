## Context

In the multi-warehouse management system, administrative users (`ADMIN`) configure user accounts, roles (`ADMIN`, `SUPER_MANAGER`, `MANAGER`, `ACCOUNTANT`), and warehouse assignments. While `GET /api/admin/users` and `POST /api/admin/users` exist, the administrative backend and frontend lack the endpoints and UI controls required to update existing users or delete/deactivate accounts.

## Goals / Non-Goals

**Goals:**
- Provide backend endpoints `PUT /api/admin/users/:id` and `DELETE /api/admin/users/:id` restricted to `ADMIN` role.
- Support updating user details: full name, role, warehouse assignment, active status, and optional password reset.
- Implement safeguards: prevent self-deletion, self-deactivation, and self-demotion from the `ADMIN` role to prevent lockout.
- Support safe deletion of user accounts that have no dependent transactional references (sales, transfer requests); return clear guidance to deactivate accounts with transaction history to preserve auditability and referential integrity.
- Provide responsive, intuitive UI controls in `UsersView.vue` including an Edit User modal, a Delete confirmation modal, and status toggles.
- Log `USER_UPDATED` and `USER_DELETED` events in the audit trail.

**Non-Goals:**
- Self-service profile editing by non-admin users (handled separately if needed).
- Changing immutable database username identifiers (usernames remain unique identity handles).

## Decisions

1. **User Edit Endpoint (`PUT /api/admin/users/:id`)**:
   - Accepts `{ fullName, roleName, warehouseId, active, password }`.
   - Validates existence of the user and role.
   - If `roleName === 'ADMIN'`, sets `warehouseId = null`. Otherwise ensures a valid warehouse ID is supplied.
   - If `password` is provided and non-empty (e.g. min 4 characters), hashes it with bcrypt and updates `password_hash`.
   - **Self-protection rule**: If the requesting admin is modifying their own record (`req.user.id === targetId`), disallow setting `active = 0` or changing `roleName` away from `ADMIN`.
   - Records an audit log with entity type `USER`, action `USER_UPDATED`.

2. **User Deletion Endpoint (`DELETE /api/admin/users/:id`)**:
   - **Self-deletion protection**: If `req.user.id === targetId`, returns HTTP 400 ("Cannot delete your own account").
   - **Referential integrity check**: Checks if the user is referenced in `sales` or `transfers`.
     - If referenced: Returns HTTP 400 explaining that the user has historical transaction records and should be deactivated (active = 0) rather than hard-deleted.
     - If not referenced: Deletes the user record from `users` and records audit log `USER_DELETED`.

3. **Frontend Service & UI (`UsersView.vue` and `admin-reports.service.ts`)**:
   - Add `updateUser(id, data)` and `deleteUser(id)` to `adminService`.
   - Add an Actions column to the users table with "Modifier" (pencil icon) and "Supprimer" (trash icon) buttons.
   - For the currently logged-in user, disable the delete action or indicate "(Compte actuel)".
   - Implement an Edit modal pre-filled with the selected user's data, with an optional password reset input.
   - Implement a Delete confirmation modal.

## Risks / Trade-offs

- **[Risk] Foreign Key Constraint Violation**: Deleting a user with sales or transfer records could crash SQLite foreign key constraints.
  → *Mitigation*: Perform pre-deletion check on dependent tables (`sales`, `transfers`), rejecting hard delete with a friendly message advising the admin to deactivate the user instead.
- **[Risk] Admin Self-Lockout**: An admin could accidentally deactivate themselves or change their role to MANAGER, losing administrative privileges.
  → *Mitigation*: Explicit backend check preventing self-demotion and self-deactivation.
- **[Risk] Accidental Password Overwrite**: Editing a user without entering a password might erase or corrupt the password.
  → *Mitigation*: Only update `password_hash` if a non-empty password string is provided.
