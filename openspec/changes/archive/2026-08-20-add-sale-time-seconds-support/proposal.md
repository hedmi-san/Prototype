## Why

While the sale date is currently tracked, the precise transaction time including seconds (`HH:mm:ss`) is not fully preserved or displayed across the point of sale, backend normalization, and frontend date formatters. Cashiers and accountants require exact timestamp precision (`YYYY-MM-DD HH:mm:ss`) to accurately distinguish consecutive sales, audit fiscal receipts, and inspect exact transaction times on invoices and sales history.

## What Changes

- **Frontend Date Formatters**:
  - Update `formatDateTime` in `frontend/src/utils/formatters.ts` to include seconds (`second: '2-digit'`), formatting timestamps as `DD/MM/YYYY HH:mm:ss` (or configurable).
- **Frontend POS & Sales Views**:
  - Update default datetime initialization in `CreateSaleView.vue` and `SalesListView.vue` to include seconds (`YYYY-MM-DDTHH:mm:ss`).
  - Add `step="1"` to all `type="datetime-local"` input controls so users can view and specify seconds.
- **Backend API Normalization**:
  - Enhance date normalization in `backend/src/routes/sale.routes.ts` (`POST /sales`, `PUT /sales/:id`) to ensure any timestamp input (ISO, datetime-local, or minutes-only) is normalized into standard SQLite `YYYY-MM-DD HH:mm:ss` format with explicit seconds.

## Capabilities

### New Capabilities
<!-- No new capabilities; extends sales-management -->

### Modified Capabilities
- `sales-management`: Update requirements for sale date persistence and formatting to mandate second-level timestamp precision (`HH:mm:ss`) on creation, modification, and display.

## Impact

- **Backend**: `backend/src/routes/sale.routes.ts`.
- **Frontend**: `frontend/src/utils/formatters.ts`, `frontend/src/views/sales/CreateSaleView.vue`, `frontend/src/views/sales/SalesListView.vue`.
