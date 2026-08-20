## ADDED Requirements

### Requirement: Admin User Profile Modification and Password Reset
The system SHALL allow users with the `ADMIN` role to update existing user accounts, including full name, role, assigned warehouse, active status, and optional password reset.

#### Scenario: Admin successfully updates user details
- **WHEN** an Admin submits updated full name, role, and assigned warehouse for an existing user via `PUT /api/admin/users/:id`
- **THEN** the system SHALL update the user record in the database, log a `USER_UPDATED` audit entry, and return an HTTP 200 response with the updated user data

#### Scenario: Admin resets user password
- **WHEN** an Admin submits a non-empty new password for an existing user
- **THEN** the system SHALL hash the new password using bcrypt, update `password_hash`, and return HTTP 200

#### Scenario: Admin attempts self-deactivation or self-demotion
- **WHEN** an authenticated Admin attempts to set `active = false` or change their own role away from `ADMIN` on their own user ID
- **THEN** the system SHALL reject the modification with an HTTP 400 Bad Request error preventing administrative self-lockout

### Requirement: Admin User Deletion and Deactivation Safeguards
The system SHALL allow users with the `ADMIN` role to delete unused user accounts and safeguard referenced historical records and the active admin account against deletion.

#### Scenario: Admin deletes an unreferenced user account
- **WHEN** an Admin requests deletion of a user ID that has no dependent transactional records (sales, transfer requests)
- **THEN** the system SHALL remove the user from the database, log a `USER_DELETED` audit entry, and return an HTTP 200 success response

#### Scenario: Admin attempts to delete a user with transactional history
- **WHEN** an Admin requests deletion of a user ID that has associated sales or transfers
- **THEN** the system SHALL reject the hard deletion with an HTTP 400 response explaining that the account has transactional history and should be deactivated instead

#### Scenario: Admin attempts to delete their own account
- **WHEN** an Admin requests deletion of the currently authenticated user's ID
- **THEN** the system SHALL reject the request with an HTTP 400 response preventing self-deletion
