## 1. Backend Route Updates

- [x] 1.1 Update `GET /api/products/export/csv` in `backend/src/routes/product.routes.ts` to prioritize `idsParam` and bypass `search` and `brand` filters when explicit IDs are provided
- [x] 1.2 Update `GET /api/inventory/export/csv` in `backend/src/routes/inventory.routes.ts` to prioritize `idsParam` and bypass `status`, `lowStock`, and `search` filters when explicit IDs are provided (retaining warehouse security scope)
- [x] 1.3 Add `ids` filter parameter support to `GET /api/products` in `backend/src/routes/product.routes.ts` and `GET /api/inventory/stock` in `backend/src/routes/inventory.routes.ts` to allow direct retrieval of selected items

## 2. Frontend Services & API Layer

- [x] 2.1 Update `catalog.service.ts` to support `ids` in `getProducts` and `getAllProducts`
- [x] 2.2 Update `operations.service.ts` to support `ids` in `getStock`
- [x] 2.3 Verify `exportProductsCsv` and `exportStockCsv` cleanly pass `ids` without extraneous discovery filters

## 3. Product Catalog Selection & Export Fixes

- [x] 3.1 Update `handleExportCsv` in `ProductListView.vue` to send only `ids` without `search` or `brand` when exporting a selection
- [x] 3.2 Update `getTargetProductsForAction` in `ProductListView.vue` to fetch all selected products by `ids` across filters/pages for PDF document generation
- [x] 3.3 Verify selection state retention in `ProductListView.vue` when filters are reset or page navigation occurs

## 4. Stock & Inventory Selection & Export Fixes

- [x] 4.1 Update `handleExportCsv` in `StockView.vue` to send only `ids` (and warehouse context) without `status` or `search` when exporting a selection
- [x] 4.2 Update `getTargetProductsForAction` in `StockView.vue` to fetch all selected stock items by `ids` across filters/pages for PDF document generation
- [x] 4.3 Verify selection state retention in `StockView.vue` when filters are reset or page navigation occurs

## 5. Verification & Testing

- [x] 5.1 Test cross-filter product selection and CSV export (select items, filter brand, select more, export CSV, verify all selected items are present)
- [x] 5.2 Test cross-page product selection and CSV export (select items across pages, export CSV, verify all selected items are present)
- [x] 5.3 Test Devis & Reference Catalog PDF generation with cross-filter and cross-page selections
- [x] 5.4 Test stock view cross-filter and cross-page selective export and document generation
