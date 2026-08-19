## Why

The Stock Movement Audit Ledger page (`/movements`) fails to display vital movement information (movement type badge shows `-`, delta quantity shows `0`, and reason/reference is blank `—`), while the Dashboard's recent movements widget displays these correctly. This occurs due to field mapping inconsistencies between the backend inventory movements endpoint response (`GET /api/inventory/movements`), frontend TypeScript interfaces, and the `StockMovementsView.vue` template.

## What Changes

- **Backend Movement API Normalization**: Update `GET /api/inventory/movements` to return consistent field aliases (`type`, `movementType`, `quantity`, `quantityChange`, `reason`, `notes`, `reference`) aligned with the dashboard endpoint and frontend contracts.
- **Frontend Type & Component Alignment**: Update `StockMovementsView.vue` and `StockMovement` interface in `frontend/src/types/index.ts` to reliably read movement types, signed quantities, reason/reference descriptions, and handle fallbacks for legacy/current field names.
- **Search & Filtering Consistency**: Ensure type filtering and keyword searches on the stock movements page correctly match against movement types (`INITIAL_STOCK`, `SALE`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`) and notes/reference values.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `inventory-management`: Update the stock movement audit ledger requirement so that movement type, delta quantity with sign, warehouse, product, and reason/reference details are accurately queried and rendered across both dashboard widgets and the full audit ledger view.

## Impact

- `backend/src/routes/inventory.routes.ts`: `GET /movements` handler mapping.
- `frontend/src/views/inventory/StockMovementsView.vue`: Template data bindings, search filter logic, and type filter matching.
- `frontend/src/types/index.ts`: `StockMovement` interface definitions.
