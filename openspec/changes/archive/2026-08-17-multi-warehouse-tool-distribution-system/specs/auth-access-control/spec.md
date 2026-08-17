## ADDED Requirements

### Requirement: User Authentication with JWT
The system SHALL authenticate users using username and password credentials, returning a signed JSON Web Token (JWT) on success, and reject invalid credentials with an unauthorized error.

#### Scenario: Successful user login
- **WHEN** a user submits valid username and password credentials to the login endpoint
- **THEN** the system SHALL authenticate the user, return an HTTP 200 response with a JWT token, user profile details, assigned role, and assigned warehouse ID (if applicable)

#### Scenario: Failed user login with invalid credentials
- **WHEN** a user submits invalid username or password credentials
- **THEN** the system SHALL reject the request with an HTTP 401 Unauthorized status and not issue a token

### Requirement: Role-Based Authorization and Warehouse Data Isolation
The system SHALL enforce backend authorization checks on all protected API endpoints according to the user's role (`ADMIN`, `MANAGER`, `SUPER_MANAGER`, `ACCOUNTANT`) and their assigned warehouse.

#### Scenario: Warehouse isolation for Manager and Accountant
- **WHEN** a Manager or Accountant attempts to view, create, or modify resources (stock, sales, expenses, HR) belonging to a warehouse other than their assigned warehouse
- **THEN** the system SHALL deny the request with an HTTP 403 Forbidden status

#### Scenario: Cross-warehouse stock visibility for Super Manager
- **WHEN** a Super Manager requests read-only stock data for other warehouses
- **THEN** the system SHALL permit read access to stock across all warehouses, but deny any modification actions for warehouses other than their assigned warehouse

#### Scenario: Global access for Admin
- **WHEN** an Admin requests access to any warehouse, financial summary, audit log, or administrative configuration
- **THEN** the system SHALL permit full administrative access across all warehouses
