## 1. Backend CSV Utilities & Response Helpers

- [x] 1.1 Create `backend/src/common/csv.ts` implementing RFC 4180 CSV serialization, cell quoting/escaping, header formatting, and UTF-8 BOM (`\uFEFF`) prefix.
- [x] 1.2 Add helper function `sendCsv(res, filename, csvString)` to set appropriate `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="..."` headers.

## 2. Backend CSV Export Endpoints

- [x] 2.1 Add `GET /api/products/export/csv` endpoint in `product.routes.ts` to export product catalog with SKU, barcode, category, prices, min stock, unit, and active status.
- [x] 2.2 Add `GET /api/sales/export/csv` endpoint in `sale.routes.ts` supporting `startDate`, `endDate`, `search`, and role-based `warehouseId` scoping.
- [x] 2.3 Add `GET /api/inventory/export/csv` endpoint in `inventory.routes.ts` supporting `warehouseId`, `lowStock` filtering, physical/available stock quantities, and valuation totals.

## 3. Frontend Export Service & Download Utilities

- [x] 3.1 Create `frontend/src/utils/export.ts` with `downloadBlob(blob, defaultFilename)` and filename extraction from Content-Disposition header.
- [x] 3.2 Add `exportProductsCsv(filters)` to `frontend/src/services/catalog.service.ts`.
- [x] 3.3 Add `exportSalesCsv(filters)` and `exportStockCsv(filters)` to `frontend/src/services/operations.service.ts`.

## 4. Frontend UI Integration

- [x] 4.1 Add "Exporter CSV" button with loading state to `frontend/src/views/products/ProductListView.vue`.
- [x] 4.2 Add "Exporter CSV" button with loading state to `frontend/src/views/sales/SalesListView.vue` respecting period navigator range and warehouse selection.
- [x] 4.3 Add "Exporter CSV" button with loading state to `frontend/src/views/inventory/StockView.vue` respecting active warehouse selection.
- [x] 4.4 Add CSV export actions to financial and stock valuation report views (`FinancialReportsView.vue`, `StockValuationView.vue`).

## 5. Verification & Validation

- [x] 5.1 Test backend CSV generation endpoints and verify RFC 4180 formatting with UTF-8 BOM encoding for French characters.
- [x] 5.2 Validate warehouse isolation rules during CSV export across Admin, Manager, and Accountant roles.
- [x] 5.3 Verify browser file downloads and UI feedback across Products, Sales, and Inventory views.
