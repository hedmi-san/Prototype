## MODIFIED Requirements

### Requirement: Warehouse-Scoped Notification Persistence
The system SHALL persist notifications in a dedicated database table, addressed to a specific warehouse depot, tracking read/unread state, notification type, title, message, target deep link, and creation timestamp.

#### Scenario: Persisting a new notification for a target warehouse
- **WHEN** an operational trigger occurs targeting Warehouse B
- **THEN** the system inserts a notification record with `warehouse_id = Warehouse B`, `is_read = false`, populated title, message, and target link

#### Scenario: Marking a single notification as read within warehouse scope
- **WHEN** an operator clicks on an unread notification or explicitly marks it as read within warehouse scope B
- **THEN** the system updates `is_read = true` and `read_at = NOW()` where `id = :id` AND `warehouse_id = B`, returning true if a record was updated, and false if no matching warehouse-scoped notification was found

#### Scenario: Marking all notifications as read for a warehouse
- **WHEN** an operator triggers "Mark all as read" for Warehouse B
- **THEN** the system sets `is_read = true` and `read_at = NOW()` on all unread notifications belonging to Warehouse B and returns the count of updated records

### Requirement: Role-Based Notification Scoping and Admin Exclusion
The system SHALL enforce strict role-based scoping on all notification queries and mutations:
- Standard warehouse staff SHALL only receive and mark notifications belonging to their assigned `warehouseId`.
- Super Managers SHALL receive and mark notifications belonging to their actively selected warehouse context across list, count, single-read, and mark-all-read endpoints.
- Administrators SHALL receive no notifications, SHALL NOT see the notification bell, and SHALL NOT mutate notification read states.

#### Scenario: Warehouse staff querying notifications
- **WHEN** a manager or cashier assigned to Warehouse 2 queries `/api/notifications`
- **THEN** the system returns only notifications where `warehouse_id = 2`

#### Scenario: Super Manager querying notifications with active warehouse
- **WHEN** a Super Manager with currently selected warehouse 3 queries `/api/notifications` or `/api/notifications/counts`
- **THEN** the system returns notifications and counts where `warehouse_id = 3`

#### Scenario: Super Manager marking notification read with active warehouse
- **WHEN** a Super Manager assigned to Warehouse 1 but actively viewing Warehouse 3 marks a notification as read with `warehouseId = 3`
- **THEN** the system marks the notification read scoped to Warehouse 3 and returns success

#### Scenario: Super Manager marking all notifications read with active warehouse
- **WHEN** a Super Manager assigned to Warehouse 1 but actively viewing Warehouse 3 triggers "Mark all as read" with `warehouseId = 3`
- **THEN** the system updates all unread notifications belonging to Warehouse 3 and returns the updated count

#### Scenario: Administrator attempting notification mutations
- **WHEN** an Administrator attempts to call `PATCH /api/notifications/:id/read` or `POST /api/notifications/read-all`
- **THEN** the system denies or safe-fails the mutation without updating unconstrained records across the database

#### Scenario: Administrator accessing notification interface
- **WHEN** an Administrator logs into the application
- **THEN** the notification bell icon is hidden from the header and no notification polling requests are executed

## ADDED Requirements

### Requirement: Frontend Notification State Synchronization and Race Condition Protection
The frontend notification store SHALL guarantee consistency between remote backend state and optimistic UI updates:
1. When marking a notification as read, the store SHALL verify that the API confirms success before permanently committing the read state and decrementing the unread counter. If the API returns `{ success: false }` or errors, the optimistic state SHALL be reverted.
2. The store SHALL guard against race conditions and out-of-order responses from background polling or window focus refreshes, ensuring stale responses initiated prior to a read action cannot overwrite newer read states.

#### Scenario: Optimistic single-read confirmed by backend
- **WHEN** the user marks a notification as read and the API responds with `{ success: true }`
- **THEN** the notification remains marked as read in the UI and the unread count remains decremented

#### Scenario: Single-read failure rollback
- **WHEN** the user marks a notification as read and the API responds with `{ success: false }` or fails
- **THEN** the notification is restored to unread in the UI, the unread count is preserved, and an error is logged

#### Scenario: In-flight polling response arriving after read action
- **WHEN** a background poll or focus refresh is in-flight while a user marks a notification as read
- **THEN** the arrival of the poll response does not revert the notification back to unread in the UI
