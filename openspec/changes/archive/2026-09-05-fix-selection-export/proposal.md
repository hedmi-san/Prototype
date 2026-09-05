## Why

When users select items in the Product Catalog or Stock & Inventory views (e.g., across multiple pages or while filtering by brand/status/search), exporting to CSV or generating PDF documents only includes items matching the *currently active filter* or visible page, rather than all selected items. This causes silent data omission where the UI indicates N items are selected, but the exported file only contains a subset.

## What Changes

- **Strict Selection-Scoped CSV Export**: When an explicit selection of IDs is provided, the export endpoints and frontend handlers must export all selected IDs without applying active search, brand, or status filters as restrictive criteria.
- **Cross-Filter / Cross-Page Document Generation**: When generating A4 PDF documents (Devis or Reference Catalog) from an active selection, the target products dataset must retrieve and retain all selected items across pages and filters, instead of filtering down to only the currently loaded page or currently filtered query results.
- **Filter-Independent Selection State**: Ensure that resetting or changing search/brand/status filters maintains the selected items count and correctly reflects checkbox states when navigating across pages or clearing filters.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `product-document-export`: Update selective CSV export and document generation requirements so that when items are selected, the operation strictly encompasses all selected product IDs regardless of active search queries, brand filters, or current page.
- `stock-document-export`: Update selective CSV export and document generation requirements so that when stock rows are selected, the operation strictly encompasses all selected stock items regardless of active status or search filters.

## Impact

- **Backend APIs**:
  - `GET /api/products/export/csv`: When `ids` parameter is present, bypass `search` and `brand` WHERE filters.
  - `GET /api/inventory/export/csv`: When `ids` parameter is present, bypass `status`, `lowStock`, and `search` WHERE filters (preserving user warehouse authorization scope).
  - `GET /api/products`: Support optional `ids` query parameter (or bypass search/brand constraints when fetching specific selected items for document generation).
- **Frontend Views & Services**:
  - `ProductListView.vue`: Do not pass `searchQuery` and `selectedBrand` to `exportProductsCsv` when `scope === 'selection'`; ensure `getTargetProductsForAction('selection')` fetches all selected products regardless of active search/brand filters.
  - `StockView.vue`: Do not pass `searchQuery` or `statusFilter` to `exportStockCsv` when `scope === 'selection'`; ensure `getTargetProductsForAction('selection')` fetches all selected stock records regardless of active search/status filters.
