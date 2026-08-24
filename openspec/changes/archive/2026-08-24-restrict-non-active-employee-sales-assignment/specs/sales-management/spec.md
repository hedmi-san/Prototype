## ADDED Requirements

### Requirement: Active Employee Assignment Restriction for Sales
The system SHALL strictly restrict sales follow-up worker assignment (`employee_id`) to employees whose status is `ACTIVE`. The POS sale creation interface (`CreateSaleView.vue`) SHALL only present `ACTIVE` employees from the selected warehouse in the worker dropdown. The backend (`POST /sales` and `PUT /sales/:id`) SHALL validate that any assigned employee is currently active, rejecting assignment of employees with status `ON_LEAVE`, `SUSPENDED`, or `TERMINATED` with an HTTP 400 error. In the sale edit modal (`SalesListView.vue`), only `ACTIVE` employees SHALL be selectable for reassignment, while any previously assigned employee who subsequently became inactive SHALL remain displayed with an indicator.

#### Scenario: POS worker dropdown only displays active employees
- **WHEN** a cashier or accountant loads the POS sale creation form for a warehouse
- **THEN** the worker assignment dropdown SHALL only list employees from that warehouse whose status is `ACTIVE`, completely omitting employees on leave (`ON_LEAVE`), suspended (`SUSPENDED`), or terminated (`TERMINATED`)

#### Scenario: Reject sale creation with non-active employee assignment
- **WHEN** a client sends a `POST /api/sales` request containing an `employeeId` for a worker whose status is `ON_LEAVE`, `SUSPENDED`, or `TERMINATED`
- **THEN** the system SHALL reject the request with an HTTP 400 Bad Request error and an explanatory French error message

#### Scenario: Reject sale modification with non-active employee reassignment
- **WHEN** an authorized user edits an existing sale via `PUT /api/sales/:id` and attempts to assign a different employee whose status is not `ACTIVE`
- **THEN** the system SHALL reject the modification with an HTTP 400 Bad Request error

#### Scenario: Preserve existing historical non-active employee on sale edit
- **WHEN** an authorized user opens the edit modal for a historical sale that was previously assigned to an employee who is now `ON_LEAVE` or `TERMINATED`
- **THEN** the edit form SHALL display the previously assigned employee with an inactive status badge without forcing reassignment unless explicitly changed
