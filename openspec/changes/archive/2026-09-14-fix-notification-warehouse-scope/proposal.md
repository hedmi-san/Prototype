## Why

In the multi-warehouse notification system, Super Managers can switch their active viewing context between different warehouse depots (e.g. assigned to Oran while actively viewing Algiers Central Hub). While notification listing and badge count endpoints honor the active warehouse, read actions (`markAsRead` and `markAllAsRead`) omit the active warehouse context. This causes the backend to fall back to the user's home warehouse or update nothing, leading to an immediate reversion to unread state upon the next poll or window focus. Additionally, the frontend treats failed read operations as successful, background polling lacks concurrency guards against overwriting recent reads, and administrators can inappropriately mark arbitrary notification IDs as read via the API due to unconstrained warehouse fallbacks. Finally, the existing test verification script poses data-loss risks by issuing unconstrained deletions against active warehouses without validating the actual HTTP API routes.

## What Changes

- **Propagate Active Warehouse Context**: Update frontend `notificationService` and `notificationStore` to include the current `activeWarehouseId` in both `markAsRead` (`PATCH /api/notifications/:id/read`) and `markAllAsRead` (`POST /api/notifications/read-all`).
- **Backend Route Scoping & Body Support**: Update backend `resolveTargetWarehouseId` in `notification.routes.ts` to inspect both query parameters and request body for `warehouseId`, ensuring Super Manager warehouse overrides are applied across GET, PATCH, and POST actions.
- **Admin Authorization Hardening**: Explicitly deny or safely no-op notification read mutations for ADMIN users in `notification.routes.ts`, and enforce warehouse scoping in `markNotificationRead` so arbitrary notifications cannot be modified without proper warehouse authority.
- **Frontend Mutation Validation & Error Handling**: Update `notificationStore.markAsRead` to inspect the API return value (`success: boolean`) and only mutate local state when the backend confirms success; roll back or warn if the update failed.
- **Polling & Race Condition Protection**: Implement sequence tracking / request versioning or active-mutation guards in `notificationStore` so that in-flight or delayed polling/focus responses cannot overwrite recent read mutations with stale unread state.
- **Safe & Comprehensive Verification**: Refactor `verify-notifications.ts` (or provide an isolated test suite) to remove destructive table wipe commands (`DELETE FROM notifications WHERE warehouse_id IN ...`) and validate real HTTP API behavior including Super Manager active warehouse switching, staff scoping, and admin authorization guards.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `cross-warehouse-notifications`: Update requirement specifications for warehouse-scoped notification read actions, Super Manager active warehouse context propagation, admin mutation restrictions, frontend state synchronization, and safe test verification.

## Impact

- **Frontend Services & Stores**: `frontend/src/services/notification.service.ts` and `frontend/src/stores/notification.store.ts`.
- **Backend Routes & Helpers**: `backend/src/routes/notification.routes.ts` and `backend/src/common/notifications.ts`.
- **Scripts & Verification**: `backend/src/scripts/verify-notifications.ts`.
- **API Endpoints**: `PATCH /api/notifications/:id/read` and `POST /api/notifications/read-all` now accept `warehouseId` (via query param or JSON body).
