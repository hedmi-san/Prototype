# Cross-Warehouse Notifications Specification

## Purpose
Provides an event-driven, warehouse-scoped notification system that alerts branch operators and super managers about incoming stock transfer requests, transfer approvals, customer pickup orders, and completion events, featuring a top-bar notification center, unread count badges, always-on sidebar indicators, and desktop alerts.

## Requirements

### Requirement: Warehouse-Scoped Notification Persistence
The system SHALL persist notifications in a dedicated database table, addressed to a specific warehouse depot, tracking read/unread state, notification type, title, message, target deep link, and creation timestamp.

#### Scenario: Persisting a new notification for a target warehouse
- **WHEN** an operational trigger occurs targeting Warehouse B
- **THEN** the system inserts a notification record with `warehouse_id = Warehouse B`, `is_read = false`, populated title, message, and target link

#### Scenario: Marking a single notification as read
- **WHEN** an operator at Warehouse B clicks on an unread notification or explicitly marks it as read
- **THEN** the system updates `is_read = true` and records `read_at = NOW()` for that notification

#### Scenario: Marking all notifications as read for a warehouse
- **WHEN** an operator at Warehouse B triggers "Mark all as read"
- **THEN** the system sets `is_read = true` and `read_at = NOW()` on all unread notifications belonging to Warehouse B

### Requirement: Role-Based Notification Scoping and Admin Exclusion
The system SHALL enforce strict role-based scoping on all notification queries:
- Standard warehouse staff SHALL only receive notifications belonging to their assigned `warehouseId`.
- Super Managers SHALL receive notifications belonging to their actively selected warehouse context.
- Administrators SHALL receive no notifications and SHALL NOT see the notification bell.

#### Scenario: Warehouse staff querying notifications
- **WHEN** a manager or cashier assigned to Warehouse 2 queries `/api/notifications`
- **THEN** the system returns only notifications where `warehouse_id = 2`

#### Scenario: Super Manager querying notifications with active warehouse
- **WHEN** a Super Manager with currently selected warehouse 3 queries `/api/notifications`
- **THEN** the system returns notifications where `warehouse_id = 3`

#### Scenario: Administrator accessing notification interface
- **WHEN** an Administrator logs into the application
- **THEN** the notification bell icon is hidden from the header and no notification polling requests are executed

### Requirement: Bi-Directional Stock Transfer Lifecycle Alerts
The system SHALL generate automated notifications to the respective counterparty warehouse at each transition of the stock transfer lifecycle:
1. `TRANSFER_REQUESTED`: When a destination warehouse creates a transfer request, notify the source warehouse.
2. `TRANSFER_APPROVED`: When the source warehouse approves the transfer, notify the destination warehouse.
3. `TRANSFER_CONFIRMED`: When the destination warehouse confirms reception, notify the source warehouse.
4. `TRANSFER_DECLINED`: When the source warehouse declines the request, notify the destination warehouse.
5. `TRANSFER_CANCELLED`: When the destination warehouse cancels the request, notify the source warehouse.

#### Scenario: Notification upon transfer creation
- **WHEN** Warehouse A requests 20 units of a product from Warehouse B
- **THEN** a notification of type `TRANSFER_REQUESTED` is created for Warehouse B with a link pointing to the transfer details

#### Scenario: Notification upon transfer approval
- **WHEN** Warehouse B approves the transfer request from Warehouse A
- **THEN** a notification of type `TRANSFER_APPROVED` is created for Warehouse A indicating that stock has been approved and dispatched

#### Scenario: Notification upon transfer confirmation
- **WHEN** Warehouse A confirms reception of the transferred goods
- **THEN** a notification of type `TRANSFER_CONFIRMED` is created for Warehouse B confirming receipt

#### Scenario: Notification upon transfer rejection
- **WHEN** Warehouse B declines the transfer request from Warehouse A
- **THEN** a notification of type `TRANSFER_DECLINED` is created for Warehouse A detailing that the request was refused

### Requirement: Header Notification Bell and Dropdown UI
The system SHALL render a notification bell in the top navigation header for non-admin users, displaying an unread counter badge and a dropdown popover listing recent notifications.

#### Scenario: Displaying unread count badge
- **WHEN** there are 3 unread notifications for the active warehouse
- **THEN** a badge displaying "3" appears over the notification bell

#### Scenario: Clicking notification item in dropdown
- **WHEN** an operator clicks a notification item in the dropdown
- **THEN** the system marks the notification as read, closes the popover, and navigates to the associated record URL

### Requirement: Always-On Sidebar Badges
The system SHALL display real-time numeric badges on navigation sidebar items for outstanding action items matching the active warehouse:
- `Transferts Inter-Entrepôts`: count of pending transfer requests awaiting action.
- `Ventes & Factures`: count of pending customer pickups awaiting fulfillment.

#### Scenario: Rendering sidebar badge counts
- **WHEN** Warehouse B has 2 pending transfer requests awaiting approval and 1 pending customer pickup
- **THEN** the sidebar displays a badge of 2 next to "Transferts Inter-Entrepôts" and a badge of 1 next to "Ventes & Factures"

### Requirement: Browser Desktop Notifications Integration
The system SHALL request HTML5 browser notification permissions and emit native desktop notifications when new unread notifications are received while the application tab is in the background or minimized.

#### Scenario: Triggering native desktop notification in background tab
- **WHEN** a new notification arrives via background polling and the browser tab is hidden (`document.hidden = true`)
- **THEN** the system emits a native HTML5 browser notification with the notification title, message, and icon, which focuses the tab when clicked
