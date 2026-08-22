## Why

In warehouse distribution operations, clients are greeted and assisted on the warehouse floor by workers who prepare their order on paper before the accountant enters the transaction at the counter. Currently, the system lacks the ability to adjust the unit sale price per item dynamically during checkout/editing, does not record or display the assigned warehouse worker who assisted the customer, and does not clearly display the issuing user ("Émise par : [user name]") on invoices and sales records.

Attaching the assisting warehouse worker to each sale provides immediate operational transparency and establishes the relational data foundation required to track and evaluate worker performance in upcoming employee profile features.

## What Changes

- **Custom Unit Sale Price**: Allow cashiers and accountants to modify the unit sale price directly per line item in the POS interface (`CreateSaleView.vue`) and edit modal (`SalesListView.vue`), defaulting to the catalog price but editable on the fly, with real-time recalculation of subtotals and invoice total amount.
- **Worker / Employee Follow-up Assignment & Performance Traceability**: Allow selecting which warehouse worker/employee followed up with the customer (from the active employees of the warehouse), persisting `employee_id` on the `sales` record with relational indexing to enable future worker profile performance analytics.
- **Issuer & Worker Display on Invoices**: Explicitly record and display the issuing user ("Émise par : [User Name]") and the assisting worker ("Agent de suivi / Conseiller : [Worker Name]") across the fiscal invoice viewer modal, invoice print view, sales list table, and sales CSV exports.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `sales-management`: Add customizable line item sale pricing during sale creation and modification, attach warehouse employee follow-up tracking to sales records, and display both the issuing accountant/user and assisting warehouse worker on invoice views and sales listings.
- `data-export-csv`: Include issuing user and follow-up worker columns in sales CSV export output.

## Impact

- **Database**: Add `employee_id` column with foreign key to `employees(id)` on `sales` table along with a B-tree index `idx_sales_employee_id` to support future high-performance worker aggregation and profile analytics.
- **Backend API**: Update `POST /api/sales`, `PUT /api/sales/:id`, `GET /api/sales`, `GET /api/sales/:id`, and `GET /api/sales/export/csv` to accept, validate, persist, and return `employeeId`, `employeeName`, and customized `unitPrice` per line item.
- **Frontend**: Update `CreateSaleView.vue`, `SalesListView.vue`, `operations.service.ts`, and TypeScript types (`Sale`, `CreateSaleRequest`, etc.) to support editable unit prices, employee selection dropdown, and display both "Émise par" and "Agent de suivi / Conseiller" in tables and invoice preview/print modals.
