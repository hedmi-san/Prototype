## Why

The inter-warehouse transfer module currently has critical access control, state management, and inventory synchronization gaps:
1. **Unrestricted Cross-Warehouse Access**: Any user (including accountants and managers of uninvolved warehouses) can view and execute actions (e.g., cancelling or confirming) on transfers between other warehouses.
2. **Missing Action Guards**: Confirmed transfers or unauthorized users can trigger cancellation.
3. **Inventory & Movement Synchronization**: Confirmation must guarantee physical/reserved stock deduction at the source warehouse, physical stock addition at the destination warehouse, and immutable `TRANSFER_OUT` / `TRANSFER_IN` audit movement logging in `stock_movements`.
4. **Missing Confirmation Timestamps**: The date/time of transfer confirmation (`confirmed_at`) is not persisted in the database or rendered in the transfer ledger.

## What Changes

- **Warehouse-Scoped Visibility & Action Authorization**:
  - `GET /api/transfers` and `GET /api/transfers/:id`: Restrict non-admin users so they can only query transfers where their assigned warehouse is either the source or destination.
  - `POST /api/transfers/:id/approve` and `POST /api/transfers/:id/decline`: Enforce that only the source warehouse Manager or an Admin can approve/decline.
  - `POST /api/transfers/:id/confirm`: Enforce that only the destination warehouse Manager or an Admin can confirm receipt.
  - `POST /api/transfers/:id/cancel`: Enforce that only the requester, destination warehouse Manager, or Admin can cancel, and only when the transfer is in `REQUESTED` or `APPROVED` status.
- **Strict Cancellation Lifecycle Invariant**: Reaffirm that `CONFIRMED`, `CANCELLED`, and `DECLINED` transfers cannot be canceled.
- **Stock Movement & Inventory Parity on Confirmation**: Ensure transactional execution of stock deductions, stock additions, and creation of `TRANSFER_OUT` and `TRANSFER_IN` records in `stock_movements`.
- **Timestamp Tracking**: Add `approved_at` and `confirmed_at` columns to `transfers`, populate them upon approval and confirmation, and expose them in API transfer responses and frontend tables.
- **Frontend Action Controls**: Update `TransferListView.vue` to conditionally render action buttons (`Approuver`, `Refuser`, `Confirmer Réception`, `Annuler`) based on current user role, assigned warehouse, and transfer status.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `transfers-management`: Update requirements for warehouse-scoped transfer visibility, role-based action authorization, confirmation timestamps, and non-cancellable confirmed status.

## Impact

- `backend/src/db/schema.ts`: Add `approved_at` and `confirmed_at` columns to `transfers` table schema and migration.
- `backend/src/routes/transfer.routes.ts`: Scoping filters in `GET /` and `GET /:id`, authorization guards for approve/decline/confirm/cancel, timestamp updates, and verified stock movement creation.
- `frontend/src/views/transfers/TransferListView.vue`: Permission-based action buttons, display of confirmation date, and filtered transfer views.
- `frontend/src/types/index.ts`: Ensure `Transfer` type definitions correctly declare `approvedAt` and `confirmedAt`.
