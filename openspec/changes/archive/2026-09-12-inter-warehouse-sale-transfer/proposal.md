## Why

In a multi-warehouse distribution environment, customers frequently request product quantities exceeding local stock at a given branch (Warehouse A). Currently, staff have no mechanism to fulfill a sale using stock from other branches (Warehouse B, C) or reserve inventory for customer pickup. This leads to lost sales, manual out-of-band coordination, and inventory overselling. Adding inter-warehouse sale transfer with stock reservations and flexible payment routing enables seamless cross-warehouse order fulfillment while maintaining strict financial and inventory integrity.

## What Changes

- **Inter-Warehouse Sale Routing**: Allow sales created at an origin warehouse to allocate shortfalls across one or more destination warehouses for customer pickup (supporting both full transfer and split fulfillment).
- **Dual-Track Revenue & Payment Accounting**: Record origin warehouse, fulfilling warehouse, and payment collection warehouse independently per fulfillment line.
- **Stock Reservation Engine**: Implement atomic stock reservations per fulfillment line with automated TTL expiry (default 120h), preventing overselling at destination branches while orders are in transit/pending pickup.
- **Inter-Warehouse Financial Reconciliation**: Introduce an audited clearing ledger (`inter_warehouse_settlements`) tracking balances when cash is collected at one branch while inventory is supplied by another.
- **Role Permissions Scoping**: Allow branch managers read-only stock visibility across all warehouses and authority to initiate transfers from their own warehouse, while reserving universal multi-branch dispatch for administrators.
- **Pickup Slip (Bon de Retrait)**: Generate printable vouchers per destination branch clearly detailing items, pickup location, and whether the order is prepaid or payment is due upon pickup.
- **Deletion & Editing Lifecycle**: Disallow hard deletion on cross-warehouse sales; enforce line-level immutability for fulfilled lines; branch cancellation into full or partial cancellation (`PARTIALLY_CANCELLED`); execute pending line edits/reassignments via atomic cancel-and-recreate transactions.

## Capabilities

### New Capabilities
- `inter-warehouse-sales`: Cross-warehouse fulfillment line allocation, destination pickup processing, Bon de Retrait voucher generation, and inter-warehouse treasury settlement balance tracking.
- `stock-reservations`: Line-item stock reservation records with row-level atomic locking, TTL expiration, active reserve quantity derivation, and manual cancellation.

### Modified Capabilities
- `sales-payment-tracking`: Extend sales payment and order completion to support multi-line fulfillment statuses (`FULFILLED`, `PENDING_PICKUP`), cross-warehouse payment collection locations, and pickup-stage settlement.

## Impact

- **Database**: New tables `sale_fulfillment_lines`, `stock_reservations`, `inter_warehouse_settlements`; extensions to `sales` table (`origin_warehouse_id`, `has_inter_warehouse_fulfillment`).
- **Backend APIs**: Updates to `/api/sales` (create sale with fulfillment allocations), new routes for `/api/sales/fulfillment-lines` (list pending pickups, fulfill line, cancel line) and `/api/transfers/settlements` (query balances, record clearing).
- **Middleware**: Scoping updates in `auth.ts` granting managers cross-warehouse stock read visibility and origin-constrained transfer initiation.
- **Frontend**: Modifications to `CreateSaleView.vue` (inline shortfall alerts, cross-warehouse split modal), additions to `SalesListView.vue` (Pending Pickups tab with countdown TTL), and pickup slip printing templates.
