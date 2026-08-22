## MODIFIED Requirements

### Requirement: Database Initialization and Atomic Transactions
The system SHALL use PostgreSQL with connection pooling (`pg.Pool`), parameterized query execution, schema initialization with composite indexing, and transactional isolation (`BEGIN`, `COMMIT`, `ROLLBACK`) to enforce concurrency and data consistency across multi-user enterprise operations.

#### Scenario: Database schema and seed data setup on boot
- **WHEN** the backend boots up connected to a PostgreSQL database
- **THEN** it automatically initializes tables for users, roles, warehouses, products, stock, movements, sales, sale_items, transfers, transfer_items, expenses, employees, salaries, and audit_logs, and seeds demo accounts and initial stock if empty.

## ADDED Requirements

### Requirement: PostgreSQL Connection Pooling and Environment Configuration
The backend SHALL establish and manage a PostgreSQL connection pool configured via environment variables (`DATABASE_URL` or `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`), supporting connection retry and graceful shutdown.

#### Scenario: Backend connects using environment variables
- **WHEN** the backend server boots with valid PostgreSQL connection credentials
- **THEN** it acquires pool clients, successfully verifies connectivity, and serves asynchronous API requests.
