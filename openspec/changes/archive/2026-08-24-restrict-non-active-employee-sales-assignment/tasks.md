## 1. Backend Validation

- [x] 1.1 In `backend/src/routes/sale.routes.ts` (`POST /sales`), validate `employeeId` if provided to ensure the employee exists, belongs to the sale warehouse, and has `status = 'ACTIVE'` (reject with HTTP 400 if on leave, suspended, or terminated)
- [x] 1.2 In `backend/src/routes/sale.routes.ts` (`PUT /sales/:id`), validate modified `employeeId` to ensure the reassigned employee is `ACTIVE` (while allowing unchanged historical employeeId)

## 2. Frontend POS & Sales Views

- [x] 2.1 In `frontend/src/views/sales/CreateSaleView.vue`, update `fetchWarehouseEmployees` to request `{ warehouseId: selectedWarehouseId.value, status: 'ACTIVE' }` so only active workers appear in the dropdown
- [x] 2.2 In `frontend/src/views/sales/SalesListView.vue`, update employee fetching in `openEditModal` to fetch active employees for reassignment while preserving and displaying the currently assigned employee if they became inactive

## 3. Verification & Testing

- [x] 3.1 Test creating a sale with an active employee in POS (should succeed)
- [x] 3.2 Test changing employee status to `ON_LEAVE` and verify they no longer appear in the POS worker dropdown in `CreateSaleView.vue`
- [x] 3.3 Test sending a direct API request assigning a non-active employee (verify HTTP 400 rejection)
- [x] 3.4 Verify build succeeds (`npm run build --prefix backend` & `npm run build --prefix frontend`)
