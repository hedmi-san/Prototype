## Context

In our multi-warehouse distribution environment, cross-warehouse inventory coordination occurs primarily through two operational flows:
1. **Stock Transfer Requests**: Warehouse A (destination) requests inventory replenishment from Warehouse B (source), which requires Warehouse B's review, approval, and physical dispatch before Warehouse A confirms reception.
2. **Inter-Warehouse Sales Pickups**: A cashier at Warehouse A sells products with remote fulfillment, allocating stock items to be picked up at Warehouse B with an active stock reservation and a pickup slip (Bon de Retrait).

Currently, branch operators have no active notification mechanism. A branch manager at Warehouse B has no immediate awareness that Warehouse A just created a transfer request or reserved stock for a customer who will arrive at Warehouse B for pickup. Staff are forced to repeatedly refresh tables or hunt through tabs.

This document details the architectural design for an event-driven, warehouse-scoped notification system spanning database persistence, backend lifecycle integration, top-header notification center with an unread badge, always-on sidebar count badges, and browser desktop notifications.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated, persistent notification engine tracking lifecycle events for stock transfers and cross-warehouse sales.
- Support bi-directional alerts across the entire lifecycle: initial request, approvals/fulfillments, rejections/cancellations, and receipt confirmations.
- Strict role and warehouse scoping:
  - Warehouse staff only see notifications addressed to their assigned warehouse.
  - Super Managers see notifications scoped to their actively selected warehouse context.
  - Administrators are excluded from operational notifications (header bell hidden/disabled).
- Real-time or near real-time delivery via lightweight polling (20-30s intervals) and instant window focus refresh.
- Header Bell with popover panel listing unread notifications, one-click deep links, and mark-as-read controls.
- Always-on sidebar navigation badges showing pending action counts.
- Native HTML5 browser desktop notifications for operators working in background tabs.

**Non-Goals:**
- External channels such as SMS, WhatsApp, or email notifications.
- Heavy WebSocket infrastructure for v1 (lightweight polling + window focus triggers provide the needed responsiveness without persistent socket connection overhead).
- Global broadcast chat or direct user-to-user messaging.

## Decisions

### Decision 1: Dedicated `notifications` PostgreSQL Table with Scoped Querying
- **Choice**: Store notifications in a dedicated table `notifications` rather than calculating dynamic counters on the fly.
- **Rationale**: 
  - Dynamic queries cannot track read/unread state per branch.
  - Dynamic queries cannot deliver feedback on resolution events (e.g. notifying the requester that a transfer was approved or rejected, because once approved it ceases to be "pending").
  - Persistent records provide an audit trail of notifications and allow instant index lookups on `(warehouse_id, is_read, created_at DESC)`.
- **Alternatives Considered**: 
  - *Ad-hoc status queries on transfers and sales tables*: Rejected because it cannot support "mark as read" or bi-directional feedback on completed events.

### Decision 2: Warehouse-Centric Scoping
- **Choice**: Notifications are addressed to a `warehouse_id` rather than individual `user_id`s (though `user_id` is recorded optionally as the actor who triggered it).
- **Rationale**: Multiple operators (cashiers, warehousemen, branch managers) share operational responsibilities at a given warehouse depot. Scoping to `warehouse_id` ensures that whoever is on shift at that depot receives and can act upon the request.
- **Role Scoping Rules**:
  - `role IN ('MANAGER', 'CASHIER', 'EMPLOYEE')`: Filter `WHERE warehouse_id = user.warehouseId`.
  - `role = 'SUPER_MANAGER'`: Filter `WHERE warehouse_id = selectedWarehouseId` (dynamically bound to their active warehouse selector).
  - `role = 'ADMIN'`: Header bell hidden, API returns empty or rejects with no-op.

### Decision 3: Bi-directional Lifecycle Event Hooks in Route Transactions
- **Choice**: Emit notification records directly within the database transactions in `transfer.routes.ts` and `sale.routes.ts`.
- **Transfer Lifecycle Events**:
  1. `POST /api/transfers`: Emits `TRANSFER_REQUESTED` to `source_warehouse_id`.
  2. `POST /api/transfers/:id/approve`: Emits `TRANSFER_APPROVED` to `destination_warehouse_id`.
  3. `POST /api/transfers/:id/confirm`: Emits `TRANSFER_CONFIRMED` to `source_warehouse_id`.
  4. `POST /api/transfers/:id/decline`: Emits `TRANSFER_DECLINED` to `destination_warehouse_id`.
  5. `POST /api/transfers/:id/cancel`: Emits `TRANSFER_CANCELLED` to `source_warehouse_id`.
- **Inter-Warehouse Sale Lifecycle Events**:
  1. `POST /api/sales` (with cross-warehouse fulfillment lines): Emits `SALE_PICKUP_PENDING` to each unique remote `fulfillment_warehouse_id`.
  2. `POST /api/sales/fulfillment-lines/:id/fulfill`: Emits `SALE_PICKUP_COMPLETED` to `origin_warehouse_id`.
  3. Cancellation/Void of fulfillment line: Emits `SALE_PICKUP_CANCELLED` to `fulfillment_warehouse_id`.

### Decision 4: Client Polling Architecture with Window Focus Sync
- **Choice**: 20-second interval polling via Pinia `notification.store.ts` complemented by an immediate sync on `window.addEventListener('focus')` and route changes.
- **Rationale**: Avoids the complexity of WebSocket server states, reconnection handling, and sticky sessions in production, while delivering near-instant notification updates. Lightweight endpoint queries indexed rows in <5ms.
- **Alternatives Considered**: 
  - *WebSockets / Socket.io*: Deemed overkill for current prototype scale; introduces connection lifecycle edge cases.

### Decision 5: Header Bell + Popover and Always-On Sidebar Badges
- **Choice**:
  - Header Bell: Positioned in `DashboardLayout.vue` next to the warehouse selector for non-admin users. Shows a vibrant pill badge with unread count. Clicking opens a popover panel with notifications, relative timestamps, type icons, and direct navigation links.
  - Sidebar Badges: Numeric pills on `Transferts Inter-Entrepôts` and `Ventes & Factures` links representing pending action items for the active warehouse context.
  - Desktop Notifications: Integrated via `Notification.requestPermission()`. When new unread notifications arrive while `document.hidden` is true, trigger a browser desktop alert with direct focus on click.

## Data Model & Schema Changes

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_wh_read_created 
  ON notifications(warehouse_id, is_read, created_at DESC);
```

## Risks / Trade-offs

- **[Risk] High Notification Volume Clutter**: Rapid transactions could generate numerous notifications for busy depots.
  - **Mitigation**: Add "Mark all as read" button; auto-mark as read when user clicks an item; limit dropdown to latest 20 notifications; paginate full history.
- **[Risk] Multiple Staff at Same Depot Reading Same Alert**: If Operator A clicks "Mark as read", Operator B at the same depot also sees it marked as read.
  - **Mitigation**: This is the desired operational behavior for branch-level teamwork (once an order has been seen/acknowledged by the team, the team's alert is cleared).
- **[Risk] Browser Notification Permission Denial**: If a user rejects browser notification permission, in-app UX must not break.
  - **Mitigation**: Desktop notifications are strictly optional and progressive enhancement. In-app bell, badges, and toasts continue working regardless of permission state.
