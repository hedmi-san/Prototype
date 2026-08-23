## Context

In the multi-warehouse tool distribution system, warehouses are registered in PostgreSQL with an `active BOOLEAN` flag. However, current endpoints and UI interfaces do not enforce restrictions around inactive warehouses. If an administrator deactivates a warehouse, no safety checks verify whether inter-warehouse transfers are currently in transit, staff accounts bound to the site are not governed into a clean read-only mode, and mutating endpoints (sales, transfers, inventory, expenses, salaries) do not prevent new transactions against the inactive site.

Furthermore, permanently decommissioning a warehouse requires emptying its physical inventory by transferring all remaining stock to one or multiple active warehouses. Manually entering hundreds of tool references across separate line-by-line transfer orders is slow and error-prone. A specialized Multi-Warehouse Relocation Matrix and atomic backend execution engine are needed to streamline liquidation.

## Goals / Non-Goals

**Goals:**
- Provide a robust deactivation flow in `backend/src/routes/warehouse.routes.ts` (`PUT /:id`) that validates that all inter-warehouse transfers involving the site are in terminal states (`CONFIRMED`, `CANCELLED`, `DECLINED`) before deactivation is permitted.
- Support instant reactivation (`active = true`) by an Admin with 1 click.
- Enforce Read-Only mode across the application for users (`MANAGER`, `ACCOUNTANT`) assigned to a deactivated warehouse:
  - Display a persistent notice banner informing the user of the inactive state.
  - Disable or hide all write/create/edit action buttons on the frontend.
  - Protect all mutation API endpoints (`POST /api/sales`, `POST /api/transfers`, `POST /api/expenses`, `POST /api/salaries`, etc.) against inactive target warehouses.
- Provide a **Multi-Warehouse Stock Relocation & Liquidation Matrix**:
  - Endpoint `POST /api/transfers/bulk-relocation` allowing Admins to distribute inventory from a closing warehouse across multiple active target warehouses in one atomic transaction.
  - Support immediate atomic execution (`immediateExecution = true`), automatically generating confirmed transfers and directly updating stock balances across source and destination sites.
  - Frontend interactive matrix with smart allocation helpers ("Tout vider sur [Dépôt]", "Répartir équitablement", "Vider les restes").
  - Offer a prompt to deactivate the warehouse once its total stock reaches 0.
- Filter warehouse dropdowns appropriately:
  - Operational creation forms (New Sale, Transfer Source/Destination, User/Employee assignment) only list active warehouses.
  - Historical reports, dashboards, and audit log filters list all warehouses, tagging inactive sites with an `(Inactif)` badge.
- Preserve 100% of historical transactional data, stock ledgers, and audit trails without deleting any rows.

**Non-Goals:**
- Automated user reassignment wizard on deactivation (admins will continue to manage user reassignments manually via `/admin/users` at their discretion).
- Forcing inventory physical liquidation to 0 prior to deactivation (temporary shutdowns can keep stock frozen in place).

## Decisions

1. **Pre-Deactivation Safety Validation in Backend (`PUT /api/admin/warehouses/:id`)**:
   - When `active` is being set to `false`, the handler queries:
     ```sql
     SELECT COUNT(*) as cnt FROM transfers
     WHERE (source_warehouse_id = $1 OR destination_warehouse_id = $1)
       AND status IN ('REQUESTED', 'APPROVED');
     ```
   - If `cnt > 0`, the endpoint returns HTTP 400 Bad Request with a clear message:
     `"Impossible de désactiver cet entrepôt car ${cnt} transfert(s) inter-dépôts sont en attente ou en cours. Veuillez d'abord les confirmer ou les annuler."`
   - Logs `WAREHOUSE_DEACTIVATED` / `WAREHOUSE_REACTIVATED` in `audit_logs`.

2. **Bulk Stock Relocation Engine (`POST /api/transfers/bulk-relocation`)**:
   - Accepts a payload:
     ```json
     {
       "sourceWarehouseId": 3,
       "immediateExecution": true,
       "notes": "Liquidation et fermeture définitive du dépôt",
       "distributions": [
         {
           "destinationWarehouseId": 1,
           "items": [{ "productId": 10, "quantity": 50 }]
         },
         {
           "destinationWarehouseId": 2,
           "items": [{ "productId": 10, "quantity": 25 }]
         }
       ]
     }
     ```
   - Inside `runTransaction`:
     - Locks and verifies available physical stock for all items at source warehouse.
     - For each destination warehouse with allocated items:
       - Inserts a record into `transfers` with a unique transfer number (`TRF-XXXXX`).
       - Inserts corresponding `transfer_items`.
       - If `immediateExecution`:
         - Sets transfer status to `CONFIRMED`, `confirmed_at = NOW()`.
         - Decrements `physical_quantity` at source (`TRANSFER_OUT`).
         - Increments `physical_quantity` at destination (`TRANSFER_IN`), creating stock rows at destination if they do not exist.
     - Records audit log `BULK_STOCK_RELOCATION`.
     - Returns summary of created transfer IDs and remaining stock at source.

3. **Frontend Multi-Warehouse Relocation Matrix Component (`StockRelocationModal.vue`)**:
   - Accessible from `WarehousesView.vue` ("Relocaliser / Vider le stock") and `TransfersView.vue`.
   - Allows selecting source warehouse and multiple active destination warehouses.
   - Matrix table displaying SKU rows, available stock, input per destination, and remaining balance badge.
   - Quick-fill helper buttons:
     - "Tout vider sur [Dépôt X]"
     - "Répartir équitablement"
     - "Vider les restes sur [Dépôt Central]"
   - On completion, checks if source warehouse stock is 0 and offers instant deactivation.

4. **Backend API Mutation Guards**:
   - `sale.routes.ts`: Validates that `warehouse.active === true` before running the sale transaction.
   - `transfer.routes.ts`: Validates that both `source_warehouse_id` and `destination_warehouse_id` are active.
   - `expense.routes.ts` & `salary.routes.ts`: Validates that the warehouse is active before recording payments.

5. **Frontend Warehouse Context & Banner (`DashboardLayout.vue`, `auth.store.ts`)**:
   - `auth.store.ts` evaluates computed properties:
     - `isWarehouseInactive`: `computed(() => { ... })` checking if the active warehouse is marked `active: false`.
     - `isReadOnly`: `computed(() => isWarehouseInactive.value && !isAdmin.value)`.
   - `DashboardLayout.vue` renders an amber alert banner when `isReadOnly` is true:
     `"⚠️ Mode Consultation Seule : L'entrepôt [Nom] est actuellement inactif. Toutes les opérations de vente et d'enregistrement sont suspendues."`

6. **Frontend Action Button Controls & Dropdowns**:
   - `SalesView.vue`: "Nouvelle Vente" button disabled or hidden if `isReadOnly` is true.
   - `TransfersView.vue`: "Nouveau Transfert" button disabled or hidden if `isReadOnly` is true.
   - `WarehousesView.vue`: Adds toggle button for Activer/Désactiver with confirmation dialog, displaying errors returned from the API (such as pending transfers).
   - `warehouse.store.ts` exposes `activeWarehouses` for operational forms and `allWarehousesFormatted` for reporting selectors.

## Risks / Trade-offs

- **[Risk] Unresolved Transfers in Transit**: Deactivating a warehouse while a truck is in transit could leave reservations stuck or inventory unaccounted for.
  → *Mitigation*: Hard blocking deactivation until all transfers are in `CONFIRMED` or `CANCELLED` status.
- **[Risk] Mass Stock Mismatch during Bulk Relocation**: Allocating more units than available across multiple destinations could corrupt inventory totals.
  → *Mitigation*: Backend validates total sum across all destinations against source physical quantity within an atomic transaction with row locking (`FOR UPDATE`).
- **[Risk] User Lockout vs Data Integrity**: Preventing all access could stop managers from viewing past invoices.
  → *Mitigation*: Provide full read-only access to historical records while strictly preventing mutations.
