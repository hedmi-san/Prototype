## Context

In the multi-warehouse architecture, standard warehouse operators (cashiers, branch managers) have a fixed `warehouseId` assigned in their user profile. Super Managers have a home assigned `warehouseId`, but can switch their operational context to any active warehouse via the UI warehouse selector (`authStore.activeWarehouseId`).

Currently:
1. **Context Drop on Read Mutations**: While notification listings (`GET /api/notifications`) and badge counters (`GET /api/notifications/counts`) pass `warehouseId` via query parameters, `markAsRead` (`PATCH /api/notifications/:id/read`) and `markAllAsRead` (`POST /api/notifications/read-all`) send no warehouse context. The backend route helper `resolveTargetWarehouseId` only inspects `req.query.warehouseId` and falls back to `user.warehouseId`. As a result, when a Super Manager assigned to Oran operates in Algiers, their read actions either target Oran or fail silently.
2. **Ignored Mutation Failure**: `notification.store.ts` marks notifications read in local state regardless of the backend response (`{ success: false }`), masking backend failures until the next refresh.
3. **Overlapping Polling Race Conditions**: Background polling (every 20s) and window focus refreshes lack concurrency control, allowing stale responses initiated before a read action to revert the UI back to unread.
4. **Admin Authorization Hole**: Admins resolve `warehouseId` to `null`. In `PATCH /api/notifications/:id/read`, `warehouseId || undefined` becomes `undefined`, triggering `UPDATE notifications SET is_read = TRUE WHERE id = $1` without any warehouse constraint.
5. **Dangerous Verification Script**: `verify-notifications.ts` wipes all notifications for the first two active warehouses (`DELETE FROM notifications WHERE warehouse_id IN (...)`) and bypasses HTTP route logic entirely.

## Goals / Non-Goals

**Goals:**
- **Full Warehouse Scope Propagation**: Propagate `activeWarehouseId` through frontend services (`notificationService.markAsRead`, `markAllAsRead`) to backend routes via both request body and query parameters.
- **Robust Route Handling**: Support both `req.body.warehouseId` and `req.query.warehouseId` in backend `resolveTargetWarehouseId`, ensuring Super Manager overrides apply uniformly to `GET`, `PATCH`, and `POST`.
- **Enforced Backend Scoping**: Require `warehouseId` in `markNotificationRead` (no unconstrained `WHERE id = $1` queries). Deny Admin mutations on notification endpoints with 403 Forbidden.
- **Frontend Mutation Validation & Rollback**: Validate API success in `notificationStore.markAsRead`; revert local state and log warning if the backend reports `success: false`.
- **Race Condition Immunity**: Implement sequence tracking and optimistic ID guards in `notificationStore` so background polling cannot revert newly read notifications.
- **Safe, Isolated Verification**: Rewrite `verify-notifications.ts` to test Super Manager context switching, Admin denial, and staff scoping without deleting existing warehouse data (cleaning up only self-created test records).

**Non-Goals:**
- Changing database schema or adding new notification columns (existing schema supports all needed fields).
- Modifying WebSocket architecture (system currently uses HTTP polling and desktop notification APIs).
- Allowing Admins to receive or manage warehouse notifications (Admins remain globally excluded from warehouse-level notification flows).

## Decisions

### 1. Dual-Transport Warehouse Resolution (Body + Query)
- **Decision**: Update `resolveTargetWarehouseId(req: AuthRequest)` to check `req.body?.warehouseId ?? req.query.warehouseId`.
- **Rationale**: While GET endpoints naturally use query params, PATCH and POST endpoints commonly use JSON request bodies. Accepting both ensures consistency across REST clients without breaking query-based calls.
- **Alternatives Considered**:
  - *Query parameters only for all methods*: Awkward for POST/PATCH requests, violates REST conventions.
  - *Header-based context (`X-Warehouse-Id`)*: Requires configuring axios interceptors and CORS exposed/allowed headers; more invasive than body/query support.

### 2. Strict Scoping in Database Helper `markNotificationRead`
- **Decision**: Change signature of `markNotificationRead(id: number, warehouseId: number)` to require `warehouseId`. If `!warehouseId`, return `false` immediately without executing an unconstrained SQL update.
- **Rationale**: Closes the security vulnerability where an omitted warehouse ID allowed updating arbitrary notifications across any warehouse depot.
- **Alternatives Considered**:
  - *Keep `warehouseId` optional and check user role in helper*: The helper is a shared database utility; it should enforce multi-tenant isolation by default rather than relying on callers to pass the filter.

### 3. Admin Authorization Rejection
- **Decision**: In `PATCH /api/notifications/:id/read` and `POST /api/notifications/read-all`, return `403 Forbidden` (`Admins do not receive or manage warehouse notifications`) if `req.user.role === 'ADMIN'`.
- **Rationale**: Admins do not belong to warehouses and have no notification inbox. Explicitly rejecting mutations prevents accidental or malicious tampering.

### 4. Optimistic Update with Rollback and Pending Read Set
- **Decision**: In `notificationStore`:
  1. Maintain `pendingReadIds = ref(new Set<number>())` for active in-flight reads.
  2. Optimistically update local item `isRead = true` and decrement `unreadCount`.
  3. If API responds with `success: false` or throws, roll back `isRead = false`, increment `unreadCount`, and remove from `pendingReadIds`.
  4. In `fetchNotifications()`, preserve `isRead = true` for any item ID currently in `pendingReadIds`.
- **Rationale**: Provides instantaneous snappy UI response when clicking items, while guaranteeing that slow or overlapping poll responses cannot resurrect unread states, and rolling back if the server rejected the action.

### 5. Safe Verification via Tracked Test IDs
- **Decision**: Refactor `verify-notifications.ts` to record all generated test notification IDs into an array `createdIds: number[]`, and delete only those specific IDs in a `finally` block: `DELETE FROM notifications WHERE id = ANY($1::int[])`.
- **Rationale**: Eliminates the catastrophic `DELETE FROM notifications WHERE warehouse_id IN (...)` statement, allowing safe execution against shared or staging environments.

## Risks / Trade-offs

- **[Risk] Super Manager switches active warehouse while read request is in-flight** → *Mitigation*: The request captures the specific `warehouseId` at invocation time, and the backend validates against that ID. If the notification does not match, it safe-fails with `{ success: false }` and the store rolls back.
- **[Risk] Network failure during mark-all-read** → *Mitigation*: The store catches the network error, triggers a full `fetchNotifications()` to re-align local state with database truth, and surfaces the error in console.
- **[Risk] Existing external callers of `markNotificationRead` without `warehouseId`** → *Mitigation*: Verified that `notification.routes.ts` and test scripts are the only callers. All callers are updated to pass `warehouseId`.

## Migration Plan

1. Update `backend/src/common/notifications.ts` to require `warehouseId` in `markNotificationRead`.
2. Update `backend/src/routes/notification.routes.ts` to handle body/query warehouse resolution and enforce Admin 403 rejection.
3. Update `frontend/src/services/notification.service.ts` to accept and send `warehouseId` on `markAsRead` and `markAllAsRead`.
4. Update `frontend/src/stores/notification.store.ts` with optimistic rollback and polling concurrency protection.
5. Update `backend/src/scripts/verify-notifications.ts` with safe cleanup and tests covering Super Manager context switching and Admin restrictions.
