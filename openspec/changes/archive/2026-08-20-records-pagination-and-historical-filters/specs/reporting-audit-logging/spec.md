## ADDED Requirements

### Requirement: Server-Side Paginated Audit Logs with Period Navigation
The system SHALL provide server-side pagination, search filtering, and historical period filtering for the audit logs endpoint (`GET /api/admin/audit-logs`), replacing unbounded and hardcoded limit queries with `page`, `limit`, `startDate`, `endDate`, `search`, and `warehouseId` query parameters.

#### Scenario: Query audit logs with pagination and search
- **WHEN** an Admin requests page 1 of audit logs with `limit=50`, `search="SALE"`, and `startDate="2025-01-01"`
- **THEN** the system SHALL return matching audit events up to the limit, total count, and total pages

#### Scenario: Audit logs view renders period navigator and pagination controls
- **WHEN** an Admin opens the audit logs view (`/audit-logs`)
- **THEN** the interface SHALL render `AppPeriodNavigator` and `AppPagination`, enabling inspection of past audit events across specific days, weeks, months, or years without performance degradation

### Requirement: High-Performance Database Indexing for Audit Logs
The system SHALL maintain composite database indexes on `audit_logs(created_at, warehouse_id)` and `audit_logs(action, created_at)` to support rapid audit timeline inspection across large datasets.

#### Scenario: Sub-millisecond audit trail queries
- **WHEN** an administrator views historical audit logs on a database with 500,000+ entries
- **THEN** the query SHALL execute against the `created_at` index and return in under 10 milliseconds
