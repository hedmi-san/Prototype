## 1. Backend Timestamp Normalization

- [x] 1.1 Add `normalizeSaleDate` helper in `backend/src/routes/sale.routes.ts` to ensure ISO, datetime-local, and partial inputs are stored in `YYYY-MM-DD HH:mm:ss` format with explicit seconds

## 2. Frontend Date Formatting

- [x] 2.1 Update `formatDateTime` in `frontend/src/utils/formatters.ts` to include `second: '2-digit'` and format timestamps as `DD/MM/YYYY HH:mm:ss`

## 3. Frontend Point of Sale and Edit Modal

- [x] 3.1 Update `CreateSaleView.vue` default datetime initialization to include seconds (`YYYY-MM-DDTHH:mm:ss`) and add `step="1"` to the datetime-local input control
- [x] 3.2 Update `SalesListView.vue` `formatToDatetimeLocal` helper to include seconds and add `step="1"` to the edit modal datetime-local input control

## 4. Verification & Testing

- [x] 4.1 Validate backend and frontend builds
- [x] 4.2 Verify end-to-end saving and second-precision display of sales timestamps in the table list and invoice modal
