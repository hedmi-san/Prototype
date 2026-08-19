## Context

The system supports inter-warehouse stock transfer requests (`REQUESTED` $\rightarrow$ `APPROVED` $\rightarrow$ `CONFIRMED` / `DECLINED` / `CANCELLED`). However, the existing endpoints and UI views lacked strict warehouse-level scoping, allowing users from unrelated warehouses (such as Warehouse D) to view, approve, confirm, or cancel transfers between Warehouses A and C. Additionally, confirmation timestamps were unpersisted, action permissions were not enforced on the client or server, and stock updates during confirmation needed explicit validation.

## Goals / Non-Goals

**Goals:**
- Enforce strict server-side scoping on `GET /api/transfers` and `GET /api/transfers/:id` so non-admin users only ever see transfers involving their assigned warehouse as source or destination.
- Enforce role & warehouse-level action authorization on backend routes (`approve`, `decline`, `confirm`, `cancel`) and return 403 Forbidden for unauthorized requests.
- Strictly block cancellation of `CONFIRMED`, `CANCELLED`, or `DECLINED` transfers.
- Persist `approved_at` and `confirmed_at` timestamps in SQLite `transfers` table and return them in API responses.
- Ensure transactional execution of `POST /api/transfers/:id/confirm` adjusting source and destination inventory, recording `TRANSFER_OUT` and `TRANSFER_IN` movements in `stock_movements`.
- Update `TransferListView.vue` to conditionally render action buttons (`Approuver`, `Refuser`, `Confirmer Réception`, `Annuler`) based on user role and warehouse participation.

**Non-Goals:**
- Changing existing inventory pricing or sales validation logic.
- Introducing multi-leg or third-party carrier transfer tracking.

## Decisions

1. **Server-Side Authorization & Query Scoping (`transfer.routes.ts`)**:
   - `GET /`: If `req.user.role !== 'ADMIN'` and user has a warehouse assigned, force filter `WHERE (t.source_warehouse_id = ? OR t.destination_warehouse_id = ?)`. If an Admin specifies `?warehouseId=X`, filter by `(source = X OR destination = X)`.
   - `GET /:id`: If `req.user.role !== 'ADMIN'` and user's warehouse is neither `source_warehouse_id` nor `destination_warehouse_id`, return 403 Forbidden.
   - `POST /:id/approve` & `POST /:id/decline`: Only Admin OR (Manager of `source_warehouse_id`).
   - `POST /:id/confirm`: Only Admin OR (Manager of `destination_warehouse_id`).
   - `POST /:id/cancel`: Only Admin OR (Manager of `destination_warehouse_id`) OR the `requested_by_user_id`. Disallow if `status === 'CONFIRMED' || status === 'CANCELLED' || status === 'DECLINED'`.

2. **Schema & Migration for Timestamps (`schema.ts`)**:
   - Add `approved_at TEXT` and `confirmed_at TEXT` to `transfers` table schema.
   - Run defensive `ALTER TABLE transfers ADD COLUMN ...` in `initSchema()` for existing databases.
   - Include `approved_at` and `confirmed_at` in SELECT queries and map to `approvedAt` and `confirmedAt`.

3. **Atomic Stock Mutation & Movement Generation**:
   - In `POST /:id/confirm`:
     Inside `runTransaction`:
     - Deduct approved quantity from source `physical_quantity` and `reserved_quantity`.
     - Insert `TRANSFER_OUT` movement for source warehouse with negative quantity.
     - Add approved quantity to destination `physical_quantity` (inserting stock row if not existing).
     - Insert `TRANSFER_IN` movement for destination warehouse with positive quantity.
     - Update transfer record with `status = 'CONFIRMED'`, `confirmed_at = datetime('now')`, `updated_at = datetime('now')`.

4. **Frontend Action Visibility Helpers (`TransferListView.vue`)**:
   - Implement helper functions `canApprove(t)`, `canDecline(t)`, `canConfirm(t)`, and `canCancel(t)` taking into account `authStore.user?.role`, `authStore.user?.warehouseId`, and `authStore.user?.id`.
   - Only display buttons when authorized, preventing confusing error states or unauthorized attempts.

## Risks / Trade-offs

- **[Existing transfers without confirmed_at]** → Older records will have `null` confirmedAt; UI gracefully displays `-`.
