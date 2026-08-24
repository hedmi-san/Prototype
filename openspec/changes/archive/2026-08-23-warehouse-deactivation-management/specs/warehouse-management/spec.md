## ADDED Requirements

### Requirement: Warehouse Deactivation Safety Validation
The system SHALL validate that no unresolved inter-warehouse transfers (`REQUESTED` or `APPROVED` status) exist involving a warehouse before allowing an Admin to deactivate it (`active = false`).

#### Scenario: Admin deactivates warehouse with no pending transfers
- **WHEN** an Admin submits `active = false` for a warehouse via `PUT /api/admin/warehouses/:id` and there are 0 transfers in `REQUESTED` or `APPROVED` status involving this warehouse as source or destination
- **THEN** the system SHALL set `active = false`, record a `WAREHOUSE_DEACTIVATED` audit log, and return HTTP 200 with the updated warehouse record

#### Scenario: Admin attempts to deactivate warehouse with pending transfers
- **WHEN** an Admin submits `active = false` for a warehouse that has one or more transfers in `REQUESTED` or `APPROVED` status as source or destination
- **THEN** the system SHALL reject the request with an HTTP 400 Bad Request error stating the number of pending transfers that must be completed or cancelled before deactivation

#### Scenario: Post-liquidation deactivation prompt
- **WHEN** a bulk relocation or liquidation transfer results in total physical stock reaching 0 for a decommissioned warehouse
- **THEN** the system interface SHALL present the user with an option to immediately deactivate the empty warehouse

### Requirement: Assigned Staff Read-Only Experience on Inactive Warehouse
The system SHALL restrict non-admin users (`MANAGER`, `ACCOUNTANT`) assigned to an inactive warehouse to read-only access mode, allowing full historical consultation while prohibiting all data creation and modification operations.

#### Scenario: Manager or Accountant logs into an inactive warehouse
- **WHEN** a Manager or Accountant assigned to an inactive warehouse authenticates and accesses the dashboard
- **THEN** the system SHALL display a persistent consultation banner indicating the warehouse is inactive, permit viewing and searching past invoices, stock levels, expense reports, and salary history, and disable all creation and mutation action buttons

#### Scenario: Block mutation requests on inactive warehouse
- **WHEN** a user or client attempts to submit a new transaction or modification targeting an inactive warehouse
- **THEN** the backend API SHALL reject the operation with an HTTP 400 or 403 error indicating that write operations are prohibited on inactive warehouses

### Requirement: Inactive Warehouse Selectors and Filter Filtering
The system SHALL filter out inactive warehouses from operational creation dropdowns while maintaining their availability with an inactive indicator in administrative and reporting filter selectors.

#### Scenario: Operational dropdowns omit inactive warehouses
- **WHEN** a user opens a creation form requiring warehouse selection (e.g. transfer destination, new user assignment)
- **THEN** the dropdown SHALL only include warehouses where `active = true`

#### Scenario: Reporting and analytics filters display inactive warehouses with badge
- **WHEN** an Admin or Super Manager opens a global filter selector for reports, audit logs, or dashboard analytics
- **THEN** the selector SHALL list all warehouses, clearly appending an `(Inactif)` label to deactivated warehouses
