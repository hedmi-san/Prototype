## ADDED Requirements

### Requirement: Multi-Warehouse Tenant Scope Enforcement
The system SHALL strictly isolate data between warehouses by enforcing warehouse ownership checks on all list queries and single-entity retrieval and mutation operations.

#### Scenario: Warehouse manager supplies arbitrary warehouseId in list query
- **WHEN** a user with role `MANAGER` or `ACCOUNTANT` queries a list endpoint (`/salaries`, `/client-payments`, `/expenses`, `/employees`, `/sales`, `/audit-logs`, `/inventory/movements`) passing a `warehouseId` query parameter different from their assigned warehouse
- **THEN** the system rejects the request with HTTP status `403 Forbidden` and error message indicating warehouse scope violation

#### Scenario: Warehouse manager requests record from another warehouse by ID
- **WHEN** a user with role `MANAGER` or `ACCOUNTANT` attempts to access, edit, or cancel a single record (`GET /sales/:id`, `PUT /sales/:id`, `POST /sales/:id/cancel`, `GET /client-payments/:id`, `GET /employees/:id/sales`, `GET /employees/:id/salaries`) belonging to an unassigned warehouse
- **THEN** the system rejects the request with HTTP status `403 Forbidden`

#### Scenario: Administrator queries across all warehouses
- **WHEN** a user with role `ADMIN` or global `SUPER_MANAGER` queries any list or single-entity endpoint with or without a `warehouseId`
- **THEN** the system processes the request without tenant restriction

### Requirement: Role-Based Authorization on Mutation and Sensitive Endpoints
The system SHALL enforce explicit role permissions on sensitive operations to prevent privilege escalation.

#### Scenario: Unauthorized user attempts to cancel a sale
- **WHEN** an authenticated user who is not an `ADMIN`, `SUPER_MANAGER`, or assigned `MANAGER` calls `POST /api/sales/:id/cancel`
- **THEN** the system returns HTTP status `403 Forbidden`

#### Scenario: Unauthorized user attempts to create a client payment
- **WHEN** an unprivileged authenticated user calls `POST /api/client-payments` without an authorized role (`ADMIN`, `SUPER_MANAGER`, `MANAGER`, `ACCOUNTANT`)
- **THEN** the system returns HTTP status `403 Forbidden`

#### Scenario: Unauthorized user attempts to view employee salaries
- **WHEN** an authenticated user without role `ADMIN`, `SUPER_MANAGER`, `MANAGER`, or `ACCOUNTANT` calls `GET /api/employees/:id/salaries`
- **THEN** the system returns HTTP status `403 Forbidden`

### Requirement: Cryptographic Key Configuration and Startup Validation
The system SHALL require a valid, non-fallback JWT secret on boot and reject default placeholder keys in non-development environments.

#### Scenario: Missing or default JWT secret on server boot
- **WHEN** the backend server starts and `JWT_SECRET` is missing, empty, or set to the known default placeholder key
- **THEN** the server process logs a fatal error and terminates execution with non-zero exit code

### Requirement: Restrictive Cross-Origin Resource Sharing (CORS)
The system SHALL restrict cross-origin access strictly to explicitly whitelisted client origins.

#### Scenario: Request from unapproved external origin
- **WHEN** a browser client sends a cross-origin HTTP request with an `Origin` header not listed in `CORS_ALLOWED_ORIGINS`
- **THEN** the server rejects the preflight or response without `Access-Control-Allow-Origin` for that origin

#### Scenario: Request from whitelisted client origin
- **WHEN** a request is received from an origin in the configured allowlist
- **THEN** the server returns `Access-Control-Allow-Origin` matching the allowed origin alongside allowed credentials

### Requirement: HTTP Security Headers and Infrastructure Defense
The system SHALL transmit standard HTTP security headers with all API responses using `helmet`.

#### Scenario: Client requests API response
- **WHEN** any HTTP request is processed by the Express application
- **THEN** the response headers include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and appropriate Content-Security-Policy headers

### Requirement: Formula Sanitization in CSV Exports
The system SHALL neutralize active formula execution characters when generating downloadable CSV reports.

#### Scenario: Data cell contains leading formula character
- **WHEN** exporting records where a field starts with `=`, `+`, `-`, `@`, `\t`, or `\r`
- **THEN** the CSV formatter prepends the value with a single apostrophe (`'`) so spreadsheet engines treat the cell strictly as text

### Requirement: Rate Limiting and Asynchronous Credential Verification
The system SHALL protect the authentication endpoint from automated credential stuffing, brute force, and event-loop starvation attacks.

#### Scenario: Excessive failed login attempts
- **WHEN** an IP address exceeds the configured maximum request threshold on `/api/auth/login` within the rate limit window
- **THEN** the system returns HTTP status `429 Too Many Requests`

#### Scenario: Password verification processing
- **WHEN** verifying credentials on login
- **THEN** password hashing comparison is computed asynchronously using non-blocking `bcrypt.compare`

### Requirement: Production Error Sanitization
The system SHALL prevent exposure of internal application structure, stack traces, and database errors.

#### Scenario: Unhandled server exception in production
- **WHEN** an unexpected 500 error occurs during request processing
- **THEN** the API response contains a generic error message without exposing database error details or execution traces
