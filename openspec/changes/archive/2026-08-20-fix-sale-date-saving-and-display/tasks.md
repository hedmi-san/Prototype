## 1. Database Schema & Migration

- [x] 1.1 Update `backend/src/db/schema.ts` to include `sale_date` in the `sales` table schema and add automatic runtime migration to add the column if missing in existing databases and backfill from `created_at`
- [x] 1.2 Update `backend/src/db/seed.ts` demo records to populate `sale_date` explicitly

## 2. Backend Sales API

- [x] 2.1 Update `GET /sales` and `GET /sales/:id` in `backend/src/routes/sale.routes.ts` to select and return `saleDate`
- [x] 2.2 Update `POST /sales` in `backend/src/routes/sale.routes.ts` to accept `saleDate` (defaulting to current timestamp if omitted) and insert it into `sale_date`
- [x] 2.3 Update `PUT /sales/:id` in `backend/src/routes/sale.routes.ts` to accept `saleDate` and update `sale_date`

## 3. Frontend Types & Services

- [x] 3.1 Update `frontend/src/types/index.ts` and `frontend/src/services/operations.service.ts` to support `saleDate` in `createSale` and `updateSale` API calls

## 4. Frontend UI Implementation

- [x] 4.1 Add "Date de Vente" input in `frontend/src/views/sales/CreateSaleView.vue` defaulting to current local date/time and binding to submission payload
- [x] 4.2 Add "Date de Vente" input in the Edit Sale modal within `frontend/src/views/sales/SalesListView.vue` and update form handling in `openEditModal` and `handleSaveEdit`
- [x] 4.3 Verify that `SalesListView.vue` table column, invoice preview modal, and dashboard display the formatted `saleDate`

## 5. Verification & Testing

- [x] 5.1 Validate backend build, run migrations, and test API endpoints for sale creation and date retrieval
- [x] 5.2 Validate frontend build and end-to-end user workflows for sale creation, display, and modification
