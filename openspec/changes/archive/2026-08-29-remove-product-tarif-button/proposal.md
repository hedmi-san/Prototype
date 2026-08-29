## Why

Currently, the product catalog table displays two separate action buttons on each row: "Tarif" (which opens a dedicated price adjustment modal) and "Modifier" (which opens the complete product edit modal). Because the "Modifier" modal already includes fields to update both purchase price and sale price, having a standalone "Tarif" button adds unnecessary interface clutter and redundant workflows. Removing the "Tarif" button and its dedicated modal simplifies the user experience by unifying all product and pricing updates in the single "Modifier" dialog.

## What Changes

- **Remove "Tarif" Action Button**: Eliminate the "Tarif" button from the table actions column in `ProductListView.vue`.
- **Remove Standalone Price Modal**: Remove the `AppModal` for price updates and its associated state (`showPriceModal`, `priceUpdatingProduct`, `priceForm`) and method (`handleUpdatePrice`).
- **Consolidate Pricing Workflow**: Retain the "Modifier" button as the sole interface for modifying product details and prices.

## Capabilities

### New Capabilities
- `catalog-actions`: Streamlined table row actions in the product catalog, standardizing price updates within the main product edit modal and removing duplicate modals.

### Modified Capabilities

## Impact

- **Frontend Views**: `frontend/src/views/products/ProductListView.vue` (removes "Tarif" button, price modal template, and unused component state).
- **Backend & Database**: No changes required (backend endpoints remain intact for backwards compatibility).
