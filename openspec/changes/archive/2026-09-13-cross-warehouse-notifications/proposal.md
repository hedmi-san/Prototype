## Why

In a multi-warehouse distribution environment, cross-warehouse transfer requests and counter sales with remote customer pickups require immediate coordination between autonomous branch staff. Currently, operators have no proactive notification mechanism, forcing them to manually refresh pages or hunt across tabs to discover pending transfer approvals and customer pickup vouchers. Adding a warehouse-scoped notification system with a top-bar notification center, unread counters, always-on sidebar badges, and browser desktop notifications eliminates coordination latency, prevents order fulfillment bottlenecks, and ensures branch staff act on stock requests promptly.

## What Changes

- **Warehouse-Scoped Notifications Engine**: Introduce a dedicated persistent notification table and backend API tracking lifecycle events across warehouses.
- **Bi-directional Stock Transfer Alerts**: Notify destination or source warehouses at each stage of the transfer lifecycle (Transfer Requested -> Transfer Approved -> Transfer Confirmed / Declined / Cancelled).
- **Bi-directional Inter-Warehouse Sale Pickup Alerts**: Notify the fulfilling warehouse when a sale creates a pending customer pickup voucher, and notify the origin selling branch when the customer completes pickup or if the voucher is cancelled.
- **Role Scoping & Visibility Constraints**: 
  - Warehouse Staff (Cashiers, Managers) see exclusively notifications addressed to their assigned warehouse.
  - Super Managers see notifications scoped to their actively selected warehouse context.
  - Administrators receive no notification noise (bell hidden/disabled).
- **Top Header Notification Center**: Unread count badge on a bell icon in `DashboardLayout.vue` with a popover listing recent notifications, relative timestamps, and one-click deep links to relevant records.
- **Always-on Sidebar Badges**: Dynamic numeric counter badges on navigation links (`Transferts Inter-Entrepôts` and `Ventes & Factures`) displaying outstanding action items.
- **Native Browser Desktop Notifications**: Optional HTML5 desktop notification triggers when the application tab is in the background.

## Capabilities

### New Capabilities
- `cross-warehouse-notifications`: Data persistence, lifecycle generation, scoping, polling, and UI presentation (bell dropdown, sidebar badges, browser alerts) for multi-warehouse operational notifications.

### Modified Capabilities
- `inter-warehouse-sales`: Extend fulfillment creation, line cancellation, and pickup completion workflows to emit automated cross-warehouse notification records.

## Impact

- **Database**: New table `notifications` with indexed queries on `warehouse_id`, `is_read`, and `created_at`.
- **Backend APIs**: New `/api/notifications` routes (list, badge counts, mark read, mark all read); updates to `/api/transfers` and `/api/sales` route handlers to emit notification records within transactional boundaries.
- **Frontend**: New `notification.store.ts` with interval polling and browser Notification API integration; new `NotificationMenu.vue` component integrated into `DashboardLayout.vue`; badge indicators on sidebar links.
