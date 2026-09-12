## 1. Database Migrations & Data Models

- [x] 1.1 Add schema migrations in `backend/src/db/schema.ts` for `sale_fulfillment_lines`, `stock_reservations`, `inter_warehouse_settlements`, and alter `sales`.
- [x] 1.2 Add composite indexes for pending pickup lookups, reservation status, and warehouse queries.
- [x] 1.3 Add TypeScript interfaces in `backend/src/types/index.ts` for fulfillment lines, reservations, settlements, and updated sale request bodies.

## 2. Stock Reservation & Concurrency Engine

- [x] 2.1 Implement atomic reservation helper function with `SELECT FOR UPDATE` row locking to prevent overselling.
- [x] 2.2 Implement reservation release and cancellation helper function updating both `stock_reservations` and `stock.reserved_quantity`.
- [x] 2.3 Implement automated TTL expiry sweep helper function to release expired reservations on inventory reads and scheduled intervals.

## 3. Backend Routing & Middleware Scoping

- [x] 3.1 Update `auth.ts` middleware to grant `MANAGER` role cross-warehouse stock read visibility and origin-scoped transfer initiation.
- [x] 3.2 Update `POST /api/sales` in `sale.routes.ts` to accept multi-warehouse fulfillment allocations, executing atomic splits and reservations.
- [x] 3.3 Implement `GET /api/sales/fulfillment-lines/pending` and count endpoint for destination warehouse pending pickup queues.
- [x] 3.4 Implement `POST /api/sales/fulfillment-lines/:id/fulfill` to handle customer pickup, optional cash collection, and physical stock decrement.
- [x] 3.5 Implement `POST /api/sales/fulfillment-lines/:id/cancel` to release stock reservations before pickup.
- [x] 3.6 Implement `GET /api/transfers/settlements/balances` and `POST /api/transfers/settlements/clear` for inter-branch treasury reconciliation.
- [x] 3.7 Add hard-delete rejection in `DELETE /api/sales/:id` prohibiting hard deletion of any sale with inter-warehouse lines.
- [x] 3.8 Update `POST /api/sales/:id/cancel` to enforce state-branched cancellation (full cancellation if all pending, partial cancellation with `PARTIALLY_CANCELLED` parent status if mixed, return workflow if all fulfilled).
- [x] 3.9 Implement `PUT /api/sales/fulfillment-lines/:id` supporting atomic cancel-and-recreate for quantity updates, payment mode changes, and destination warehouse reassignment.

## 4. Frontend Sale Creation (POS Shortfall & Split Allocation)

- [x] 4.1 Update `operations.service.ts` with API client methods for inter-warehouse sales, pending pickups, fulfillment, and settlements.
- [x] 4.2 In `CreateSaleView.vue`, add inline cross-warehouse stock availability badges when entered quantity exceeds local warehouse stock.
- [x] 4.3 Create the Inter-Warehouse Split Fulfillment modal in `CreateSaleView.vue` allowing multi-destination allocation, TTL selection, and payment routing.
- [x] 4.4 Build the printable Bon de Retrait (Pickup Slip) voucher component with prominent pre-paid vs pay-on-pickup indicators.

## 5. Destination Pickup Queue & Settlement UI

- [x] 5.1 In `SalesListView.vue`, add a dedicated "Pending Pickups / Retraits en attente" tab with badge counts and TTL countdown indicators.
- [x] 5.2 Build the Pickup Fulfillment modal at the destination warehouse supporting invoice verification, cash collection, and stock release.
- [x] 5.3 Add an Inter-Warehouse Balances card in reports/transfers to visualize net debits/credits between warehouses with a settlement action button.
- [x] 5.4 Update sale detail/cancel UI in frontend to handle partial cancellation and provide edit/reassign action for pending lines.

## 6. End-to-End Verification

- [x] 6.1 Verify full transfer flow: sale at Warehouse A, stock reserved at Warehouse B, customer picks up at Warehouse B pre-paid.
- [x] 6.2 Verify split fulfillment flow: local fulfillment at Warehouse A, remote reservation at Warehouse B, customer pays on pickup at Warehouse B.
- [x] 6.3 Verify multi-destination split across multiple remote warehouses.
- [x] 6.4 Verify reservation TTL expiration (120h) and manual cancellation inventory restoration.
- [x] 6.5 Verify full cancellation when all lines are pending (reservations released, payment refunded, status `CANCELLED`).
- [x] 6.6 Verify partial cancellation when some lines are fulfilled (pending lines released, fulfilled lines intact, status `PARTIALLY_CANCELLED`).
- [x] 6.7 Verify pending line warehouse reassignment (reservation migrated from Warehouse B to Warehouse C atomically with row locks).
