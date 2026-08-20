## Why

Users (Administrators, Warehouse Managers, Accountants) currently view critical business data—including product catalogs, sales records, and inventory stock levels—only within web dashboard tables. To perform offline bookkeeping, accounting audits, spreadsheet reconciliation in Excel/Sheets, or external regulatory filings, users require the ability to export and download structured CSV (Comma/Semicolon Separated Values) data directly from their respective views and reports.

## What Changes

- **Backend CSV Export Endpoints**:
  - Add `GET /api/products/export/csv` to export product catalog with pricing, category, unit, barcode, and thresholds.
  - Add `GET /api/sales/export/csv` to export historical sales with date filtering, warehouse scoping, customer info, payment status, totals, and line-item details.
  - Add `GET /api/inventory/export/csv` to export current warehouse stock levels, low-stock flags, purchase valuations, and warehouse locations.
  - Optional support for date range query parameters (`startDate`, `endDate`), search queries, and warehouse filters (`warehouseId`).
  - Stream CSV with UTF-8 BOM encoding for seamless Microsoft Excel and Google Sheets character recognition.

- **Frontend Export Actions**:
  - Add explicit "Export CSV" / "Exporter CSV" buttons to Product List (`ProductListView.vue`), Sales List (`SalesListView.vue`), Inventory/Stock (`StockView.vue`), and Financial/Stock Reports.
  - Integrate downloading with automatic filename timestamping (e.g. `products_export_2026-08-20.csv`, `sales_export_2026-08-20.csv`, `stock_export_2026-08-20.csv`).
  - Provide visual loading and toast feedback while generating downloads.

- **Access Control & Scoping**:
  - Enforce role-based access control and warehouse scoping (Managers and Accountants download only data belonging to their assigned warehouse; Admins can export all or filter by warehouse).

## Capabilities

### New Capabilities
- `data-export-csv`: CSV export generation and download capabilities for products, sales transactions, and warehouse stock inventories with proper character encoding, filtering, and role scoping.

### Modified Capabilities
<!-- No requirement changes to existing base specs -->

## Impact

- **Backend**:
  - New export routes or sub-routes in `product.routes.ts`, `sale.routes.ts`, `inventory.routes.ts`, or a consolidated `export.routes.ts`.
  - CSV formatting/serialization utility with escaping, headers, and UTF-8 BOM.
- **Frontend**:
  - New export button triggers in `ProductListView.vue`, `SalesListView.vue`, `StockView.vue`, and report views.
  - API client methods to trigger blob/file downloads.
- **Dependencies**:
  - Zero required new heavy dependencies; can be implemented with native streams/generators or lightweight CSV utility.
