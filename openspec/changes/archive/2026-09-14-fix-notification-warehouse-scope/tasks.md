## 1. Backend Route & Scope Hardening

- [x] 1.1 Update `resolveTargetWarehouseId` in `backend/src/routes/notification.routes.ts` to inspect both query parameters and JSON request body for `warehouseId`
- [x] 1.2 Disallow ADMIN users from calling `PATCH /api/notifications/:id/read` and `POST /api/notifications/read-all`, returning a 403 Forbidden or failure response
- [x] 1.3 Harden `markNotificationRead` in `backend/src/common/notifications.ts` to require `warehouseId` and prevent unconstrained database updates
- [x] 1.4 Pass resolved target warehouse to `markAllNotificationsRead` in `POST /api/notifications/read-all`

## 2. Frontend Service & State Synchronization

- [x] 2.1 Update `notificationService.markAsRead` and `markAllAsRead` in `frontend/src/services/notification.service.ts` to accept optional `warehouseId` and pass it in the request
- [x] 2.2 Update `notificationStore.markAsRead` in `frontend/src/stores/notification.store.ts` to pass `authStore.activeWarehouseId` and only update local read state when API returns `success === true`
- [x] 2.3 Update `notificationStore.markAllAsRead` in `frontend/src/stores/notification.store.ts` to pass `authStore.activeWarehouseId` and validate response
- [x] 2.4 Implement race condition protection and request sequencing in `notificationStore.ts` so in-flight polling and focus refreshes do not overwrite optimistic read updates

## 3. Verification & Testing

- [x] 3.1 Refactor `backend/src/scripts/verify-notifications.ts` to remove dangerous table wipes (`DELETE FROM notifications WHERE warehouse_id IN (...)`) and isolate test data using unique run identifiers
- [x] 3.2 Add API test coverage for Super Manager active warehouse switching across listing, single-read, and mark-all-read endpoints
- [x] 3.3 Add test coverage ensuring ADMIN users cannot modify notification read statuses
- [x] 3.4 Run test verification and verify frontend type checking and linting pass cleanly
