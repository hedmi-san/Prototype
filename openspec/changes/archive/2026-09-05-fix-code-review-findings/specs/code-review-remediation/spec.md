## ADDED Requirements

### Requirement: Complete Route Error Boundary Protection
The system SHALL encapsulate all asynchronous database operations, entity validations, and audit logging within comprehensive `try / catch` blocks in every route handler to prevent unhandled promise rejections and hung HTTP connections.

#### Scenario: Database failure during preliminary entity lookup in sale cancellation
- **WHEN** an authenticated user calls `POST /api/sales/:id/cancel` and the database connection fails during the initial sale query
- **THEN** the system catches the error and responds with HTTP status `500` and a structured error message rather than triggering an unhandled rejection

#### Scenario: Error during transfer decline operation
- **WHEN** an authorized user calls `POST /api/transfers/:id/decline` and any database query fails
- **THEN** the system catches the error within a route `try / catch` block and returns HTTP status `500` with an error message

#### Scenario: Database failure during transfer approval or confirmation lookup
- **WHEN** an authorized user calls `POST /api/transfers/:id/approve` or `POST /api/transfers/:id/confirm` and a failure occurs during the initial transfer lookup
- **THEN** the system catches the error and returns a standard HTTP error response rather than terminating uncaught

---

### Requirement: Non-Blocking Asynchronous Password Hashing
The user management service SHALL use asynchronous non-blocking cryptographic functions when generating salt and password hashes to avoid starving Node.js event-loop workers.

#### Scenario: User creation with password
- **WHEN** an administrator creates a new user via `POST /api/users` with a plaintext password
- **THEN** the server generates the salt and password hash using asynchronous `await bcrypt.genSalt()` and `await bcrypt.hash()` without blocking concurrent HTTP requests

#### Scenario: User password update
- **WHEN** an administrator modifies a user password via `PUT /api/users/:id`
- **THEN** the server re-hashes the password using asynchronous `await bcrypt.hash()` without blocking event loop processing

---

### Requirement: Deterministic Element Identity in Dynamic Form Collections
All dynamic Vue form line-item collections that support row addition, deletion, or reordering SHALL bind each list element using a unique, immutable client-side identifier rather than the array index.

#### Scenario: Deleting an intermediate item in sale creation
- **WHEN** a user deletes an intermediate line item from the POS sale interface in `CreateSaleView`
- **THEN** the remaining row items retain their assigned products, prices, quantities, and combobox states without index shift corruption

#### Scenario: Deleting an intermediate item in sale editing
- **WHEN** a user removes an article line from `SalesListView` edit modal
- **THEN** the remaining invoice line items preserve their selected product IDs, unit prices, and quantities without DOM recycling artifacts

#### Scenario: Deleting an intermediate item in transfer creation
- **WHEN** a user removes a product row from `TransferListView` creation form
- **THEN** the remaining transfer rows preserve their selected products and requested quantities accurately
