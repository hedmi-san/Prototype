## Why

Currently, all registered warehouses in the system are permanently considered active. If a distributor temporarily shuts down a warehouse (e.g. for maintenance, renovation, seasonal pause) or permanently decommissions a site, there is no mechanism to deactivate the warehouse while safely preserving all historical transactional data (sales, stock logs, transfers, expenses, payroll, and audit trails). 

Furthermore, permanently decommissioning a warehouse requires emptying its physical inventory by transferring all remaining stock to one or multiple active warehouses. Manually entering hundreds of tool references across separate line-by-line transfer orders is slow, tedious, and error-prone. A governed read-only mode for assigned staff and an automated Multi-Warehouse Stock Relocation Matrix are needed to safely liquidate and close facilities.

## What Changes

- **Warehouse Deactivation & Reactivation (`PUT /api/admin/warehouses/:id`)**:
  - Allow Admins to toggle warehouse status between Active and Inactive.
  - Implement safety validation: Prevent deactivating a warehouse if unresolved inter-warehouse transfers (`REQUESTED` or `APPROVED`) are pending for that warehouse.
- **Assigned User Read-Only Experience**:
  - When a warehouse is deactivated, assigned `MANAGER` and `ACCOUNTANT` accounts enter Read-Only mode.
  - They can log in and view historical invoices, inventory, reports, and expenses, but all mutation operations (new sale, new transfer, stock adjustments, new expense/salary) are disabled in the UI and guarded on the backend.
  - A persistent visual banner informs users that their assigned warehouse is in read-only consultation mode.
- **Multi-Warehouse Stock Relocation & Liquidation Matrix (`POST /api/transfers/bulk-relocation`)**:
  - Provide a visual bulk distribution matrix allowing Admins to relocate the entire remaining inventory of a closing warehouse to a single destination or split it across multiple active regional warehouses in a single grid.
  - Include smart allocation helpers: "Tout vers [Dépôt X]", "Répartir équitablement", and "Vider les restes".
  - Support immediate atomic execution (`immediateExecution = true`), automatically generating confirmed transfers, adjusting inventory counts, and recording stock ledger movements without manual approval steps.
  - Display a prompt offering immediate warehouse deactivation once all stock reaches 0 units.
- **Operational Selectors & Dropdown Filtering**:
  - Hide inactive warehouses from operational creation dropdowns (New Sale, Transfer Source/Destination, New Employee/User creation).
  - Retain inactive warehouses with an `(Inactif)` label in administrative filter selectors (Dashboard Switcher, Sales Reports, P&L, Inventory Ledger, Audit Logs) to ensure seamless historical analysis.
- **Backend API Integrity Guards**:
  - Reject new sale creation (`POST /api/sales`), new transfer creation (`POST /api/transfers`), and expense/salary creation when targeted at an inactive warehouse.
- **Audit Logging**:
  - Record audit log entries when a warehouse is deactivated, reactivated, or subjected to bulk stock relocation.

## Capabilities

### New Capabilities
<!-- No new standalone capabilities required; extends existing warehouse, transfer, and sales management -->

### Modified Capabilities
- `warehouse-management`: Add requirements for deactivating/reactivating warehouses, safety validations regarding pending transfers, post-liquidation zero-stock deactivation prompt, and assigned staff read-only restrictions.
- `transfers-management`: Add requirements for the Multi-Warehouse Stock Relocation Matrix, bulk atomic transfers, and restrictions preventing inactive warehouses from initiating or receiving new transfer requests.
- `sales-management`: Add validation preventing new sales on inactive warehouses while allowing historical invoice consultation and reprint.

## Impact

- **Backend**:
  - `backend/src/routes/warehouse.routes.ts`: Add pending transfers validation check before setting `active = false`.
  - `backend/src/routes/transfer.routes.ts`: Implement `POST /bulk-relocation` for multi-destination atomic stock transfers, and validate that source and destination warehouses are active.
  - `backend/src/routes/sale.routes.ts`: Validate that the target warehouse is active before permitting sale creation.
  - `backend/src/routes/expense.routes.ts` & `backend/src/routes/salary.routes.ts`: Reject creation against inactive warehouses.
- **Frontend**:
  - `frontend/src/views/admin/WarehousesView.vue`: Add status toggle with pending transfer safety validation, and "Relocaliser le stock" liquidation action.
  - `frontend/src/components/transfers/StockRelocationModal.vue`: Interactive multi-destination relocation matrix grid with smart allocation helpers.
  - `frontend/src/layouts/DashboardLayout.vue`: Display a prominent notice banner when the user's active warehouse context is inactive.
  - `frontend/src/views/sales/SalesView.vue`, `frontend/src/views/transfers/TransfersView.vue`: Disable or hide create actions when operating within an inactive warehouse context.
  - `frontend/src/stores/auth.store.ts` & `frontend/src/stores/warehouse.store.ts`: Add helpers for checking if current warehouse is active and filtering active vs inactive warehouses in dropdowns.
- **Database & Data**:
  - Preserves all relational data and foreign keys (`ON DELETE` is never triggered; records are kept permanently).
