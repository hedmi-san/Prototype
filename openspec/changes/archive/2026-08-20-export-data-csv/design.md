## Context

The Multi-Warehouse Tool Distribution Management System manages products, multi-warehouse stock, and sales transactions. While users can view and filter these records in web UI tables (with pagination and period navigation), there is currently no facility to export and download this data for external accounting, spreadsheet modeling, audits, or offline analysis.

This change introduces unified CSV export capabilities across the backend and frontend for Products, Sales, and Warehouse Inventory Stock & Valuations.

## Goals / Non-Goals

**Goals:**
- Provide secure backend endpoints for CSV export:
  - `GET /api/products/export/csv`
  - `GET /api/sales/export/csv`
  - `GET /api/inventory/export/csv`
- Implement standard RFC 4180 CSV serialization with UTF-8 Byte Order Mark (`\uFEFF`) for out-of-the-box Microsoft Excel and Google Sheets compatibility (preserving French accents and numerical accuracy).
- Support relevant filtering parameters on export endpoints: date range (`startDate`, `endDate`), warehouse (`warehouseId`), search keywords (`search`), and low-stock criteria.
- Enforce strict role-based authorization and warehouse data isolation (Managers and Accountants can only export data for their assigned warehouse).
- Add intuitive "Export CSV" buttons with loading indicators and automated browser download handling across Product List, Sales List, and Stock/Inventory views.

**Non-Goals:**
- Binary XLSX or PDF report rendering (CSV covers all spreadsheet requirements with maximum performance and minimal complexity).
- Background asynchronous worker queues or email delivery (synchronous HTTP streaming is optimal for the system's operational scale).
- Generic ad-hoc SQL query export tools.

## Decisions

### 1. Backend Server-Side Generation vs Client-Side JSON Conversion
- **Decision**: Implement server-side CSV export endpoints in the backend rather than converting currently loaded frontend Vue table rows into CSV.
- **Rationale**: Vue table views are paginated (e.g., 25 sales per page). Generating CSV on the backend ensures users export the entire filtered dataset (all matching records in the selected period/filter), not just the current page.
- **Alternatives Considered**:
  - *Client-side conversion of visible table*: Would only export the currently visible page (25 rows) unless the frontend made multiple sequential requests.

### 2. Lightweight Custom RFC 4180 CSV Formatter with UTF-8 BOM
- **Decision**: Implement a clean, dependency-free CSV generator in `backend/src/common/csv.ts`.
- **Rationale**: Adding heavy external dependencies is unnecessary for tabular records. A dedicated formatter ensures:
  - UTF-8 BOM prefix (`\uFEFF`) to prevent Excel encoding corruptions.
  - Correct quotation and escaping of fields containing quotes (`" -> ""`), commas, newlines, and semicolons.
  - Deterministic column ordering and localized French header labels matching the application terminology.

### 3. File Download Mechanism
- **Decision**: Authenticated API request via Axios (`responseType: 'blob'`) combined with browser temporary object URL creation (`URL.createObjectURL(blob)`).
- **Rationale**: Export endpoints require JWT `Authorization: Bearer <token>` headers. Direct `<a href="/api/...">` links cannot pass authorization headers securely without token query string leaks.

## Architecture & Data Flow

```
[ Vue Frontend ]
   │
   ├─► Clicks "Export CSV" (ProductListView / SalesListView / StockView)
   ├─► Axios GET /api/{resource}/export/csv?filters... (headers: Bearer JWT)
   │
[ Express Backend ]
   │
   ├─► Authenticate JWT & Validate Warehouse Scoping
   ├─► Query SQLite Database (with date/warehouse/search filters)
   ├─► Format rows via CSV formatter (headers, escaping, UTF-8 BOM)
   └─► Send Response (Content-Type: text/csv; charset=utf-8, Content-Disposition: attachment)
   │
[ Browser Client ]
   ├─► Receives Blob, creates Object URL, auto-clicks download link
   └─► User receives timestamped file: e.g. "ventes_2026-08-20.csv"
```

## Risks / Trade-offs

- **[Risk] Excel delimiter mismatch across locales** (Comma `,` vs Semicolon `;`)
  → *Mitigation*: Use standard comma delimiter with RFC 4180 quote wrapping and UTF-8 BOM. Numbers are formatted cleanly without extraneous currency symbols to allow direct mathematical formulas in Excel.
- **[Risk] Unauthorized data exposure across warehouses**
  → *Mitigation*: Apply `validateWarehouseScope` middleware and enforce session warehouse constraints identical to JSON API endpoints.
- **[Risk] High memory usage for massive sales exports**
  → *Mitigation*: Database queries select only relevant columns and format cleanly; pagination limit guardrails are bypassed only on export routes which execute single-pass SQLite statements.
