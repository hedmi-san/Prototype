## 1. Database & Backend API

- [x] 1.1 Update `backend/src/db/schema.ts` to add `employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL` on the `sales` table, and ensure column existence on database initialization
- [x] 1.2 Update `backend/src/routes/sale.routes.ts` query selects in `GET /` and `GET /:id` to join `employees` table and return `employeeId` and `employeeName`
- [x] 1.3 Update `backend/src/routes/sale.routes.ts` `POST /` to accept and persist `employeeId` and custom `unitPrice` per item
- [x] 1.4 Update `backend/src/routes/sale.routes.ts` `PUT /:id` to allow updating `employeeId` and custom `unitPrice`
- [x] 1.5 Update `backend/src/routes/sale.routes.ts` `GET /export/csv` to include "Émis par" (User Name) and "Agent de suivi" (Employee Name) columns

## 2. Frontend Services & Types

- [x] 2.1 Update `frontend/src/types/index.ts` to add `employeeId` and `employeeName` to `Sale`, and `unitPrice` to line item interfaces
- [x] 2.2 Update `saleService.createSale` and `saleService.updateSale` in `frontend/src/services/operations.service.ts` to support `employeeId` and item `unitPrice`

## 3. Point of Sale & Invoicing (CreateSaleView)

- [x] 3.1 Load active warehouse employees on warehouse selection in `frontend/src/views/sales/CreateSaleView.vue`
- [x] 3.2 Add "Agent de suivi / Conseiller" dropdown selector in `CreateSaleView.vue` sidebar form
- [x] 3.3 Replace static unit price column with an editable number input for each line item in `CreateSaleView.vue`, initialized from the selected product's catalog price
- [x] 3.4 Dynamically recalculate line item subtotals and overall invoice total amount whenever `unitPrice` or `quantity` changes
- [x] 3.5 Pass `employeeId` and item `unitPrice` values in sale submission payload

## 4. Sales List, Edit Modal & Invoice Viewer

- [x] 4.1 Update `frontend/src/views/sales/SalesListView.vue` table to display both "Émis par" (User) and "Agent de suivi" (Worker)
- [x] 4.2 Update `SalesListView.vue` edit sale modal to allow editing the assigned worker and item unit prices
- [x] 4.3 Update `SalesListView.vue` fiscal invoice preview and printable view to display "Émise par : [User Name]" and "Agent de suivi : [Worker Name]"
