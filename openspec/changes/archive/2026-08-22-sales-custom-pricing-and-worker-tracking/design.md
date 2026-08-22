## Context

In the multi-warehouse tool distribution workflow, customer interaction follows a two-tier operational model:
1. **Floor Consultation**: A warehouse worker greets the customer upon entry, determines their tool/equipment requirements, writes the selected items on a paper order form, and accompanies the customer to the sales counter.
2. **Counter Checkout**: The accountant/cashier receives the paper order and inputs the sale into the system. During checkout, commercial flexibility often requires overriding default unit catalog prices (e.g. negotiated discounts or custom bundle pricing).

Currently, the POS view (`CreateSaleView.vue`) locks the unit price to the catalog price (`Product.salePrice`) and calculates line totals without allowing modification. Additionally, the sale record does not record the floor worker (`employee_id`), preventing management from tracking which workers assist customers or evaluating worker sales contribution. Invoice views also omit the explicit issuing accountant and assisting worker.

## Goals / Non-Goals

**Goals:**
- Enable in-place unit sale price editing for each line item in `CreateSaleView.vue` and the edit modal in `SalesListView.vue`, auto-recalculating line subtotals and overall invoice totals.
- Extend `sales` database table with indexed `employee_id` referencing `employees(id)` to establish a clean relational data model for future worker profile performance analytics.
- Enable selecting the assisting warehouse worker (from active employees of the warehouse) during sale creation and modification.
- Return and display both the issuing accountant ("Émise par : [User Name]") and assisting worker ("Agent de suivi / Conseiller : [Worker Name]") across POS, sales list table, fiscal invoice viewer modal, invoice print view, and CSV export.

**Non-Goals:**
- Dynamic salesperson commission calculations or full worker profile performance dashboards (this change establishes the foundational schema and data capture; the profile metrics UI will be implemented in a subsequent phase).
- Redesigning the employee management CRUD module.

## Decisions

### 1. Database Schema & Foreign Key Indexing
- **Decision**: Add `employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL` column to the `sales` table, and create index `idx_sales_employee_id ON sales(employee_id)`.
- **Rationale**: Keeps worker attribution flexible (nullable if unassigned) while ensuring referential integrity. Indexing `sales(employee_id)` prepares the database for sub-millisecond aggregation queries when worker profile performance screens are introduced.
- **Alternatives considered**: Storing free-text `worker_name` directly in `sales`. Rejected because selecting from the `employees` table guarantees consistency, relational integrity, and seamless integration with future employee profile statistics.

### 2. Line Item Custom Unit Price Handling
- **Decision**: Include `unitPrice: number` in the line item state and payload for `POST /api/sales` and `PUT /api/sales/:id`.
- **Behavior**: When a product is selected in `AppProductCombobox`, `unitPrice` is initialized with `product.salePrice`. The accountant can edit this field in the number input (`min="0"`, `step="any"`). Line subtotal is computed as `quantity * unitPrice`.
- **Rationale**: Backend `sale.routes.ts` already checks `item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.sale_price)`. Exposing an editable number input in the frontend completes end-to-end support with zero backend breaking changes.

### 3. Employee Selector in POS & Edit Modals
- **Decision**: Fetch warehouse employees using `employeeService.getEmployees(warehouseId)` when `selectedWarehouseId` changes in `CreateSaleView.vue` and `SalesListView.vue`.
- **Behavior**: Provide a `<select>` dropdown titled "Agent de suivi (Conseiller)" with an optional default option `"-- Aucun / Non spécifié --"`.

### 4. Invoice Modal & Table Presentation
- **Decision**: Display dual attribution in the invoice preview header:
  - **Émise par**: `sale.createdByName` (or `sale.userName`)
  - **Agent de suivi**: `sale.employeeName || 'Non assigné'`
- **Decision**: Add "Agent de suivi" column / pill in `SalesListView.vue` table alongside "Émis par".

## Risks / Trade-offs

- **[Risk] Price override errors (unintended negative or zero values)** → **Mitigation**: Add validation in UI (`min="0"`, positive number check) and backend verification (`unitPrice >= 0`).
- **[Risk] Performance impact of employee JOIN in sales queries** → **Mitigation**: Add foreign key index `idx_sales_employee_id` on `sales(employee_id)`. The paginated queries already join with `warehouses` and `users`; joining with `employees` adds negligible overhead.
