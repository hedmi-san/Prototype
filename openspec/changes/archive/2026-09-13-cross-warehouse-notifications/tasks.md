## 1. Database Schema & Shared Types

- [x] 1.1 Create `notifications` table and index in `backend/src/db/schema.ts`
- [x] 1.2 Define notification interfaces, enums, and request types in `backend/src/types/index.ts` and `frontend/src/types/index.ts`

## 2. Backend Notification Service & API Routes

- [x] 2.1 Implement notification helper utility in `backend/src/common/notifications.ts` supporting transactional inserts and warehouse-scoped queries
- [x] 2.2 Implement `backend/src/routes/notification.routes.ts` with endpoints for listing notifications, fetching badge counts, marking single read, and marking all read
- [x] 2.3 Register notification routes and enforce role scoping in `backend/src/server.ts`

## 3. Transactional Event Hook Integrations

- [x] 3.1 Integrate notification triggers into `backend/src/routes/transfer.routes.ts` for transfer creation (`TRANSFER_REQUESTED`), approval (`TRANSFER_APPROVED`), confirmation (`TRANSFER_CONFIRMED`), decline (`TRANSFER_DECLINED`), and cancellation (`TRANSFER_CANCELLED`)
- [x] 3.2 Integrate notification triggers into `backend/src/routes/sale.routes.ts` for cross-warehouse pickup creation (`SALE_PICKUP_PENDING`), pickup completion (`SALE_PICKUP_COMPLETED`), and line cancellation (`SALE_PICKUP_CANCELLED`)

## 4. Frontend Notification Store & Polling Engine

- [x] 4.1 Implement `frontend/src/services/notification.service.ts` for notification API calls
- [x] 4.2 Implement `frontend/src/stores/notification.store.ts` with reactive unread state, periodic 20-second polling, window focus refresh, and HTML5 Web Notification API desktop alerts

## 5. UI Presentation: Header Bell, Popover & Sidebar Badges

- [x] 5.1 Create `frontend/src/components/notifications/NotificationMenu.vue` with bell icon, unread pill badge, popover dropdown, relative time formatting, and direct navigation links
- [x] 5.2 Integrate `NotificationMenu.vue` into `frontend/src/layouts/DashboardLayout.vue` with admin-exclusion visibility rules
- [x] 5.3 Add real-time numeric badges to sidebar items for `Transferts Inter-Entrepôts` and `Ventes & Factures` in `frontend/src/layouts/DashboardLayout.vue`

## 6. Verification & End-to-End Testing

- [x] 6.1 Create automated test script `backend/src/scripts/verify-notifications.ts` verifying notification emittance, scoping rules, mark-read operations, and badge counters
- [x] 6.2 Validate complete transfer and sale pickup user flows in the browser interface
