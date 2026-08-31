## Why

The Stock & Inventory view (`StockView.vue`) currently only allows exporting all filtered stock items to CSV with a static button. Users cannot select specific stock rows or generate formatted A4 PDF documents like Sales Price Quotations ("Devis / Liste de Vente") or simple Reference Catalogs directly from current warehouse inventory.

Applying the calm contextual selection and dual PDF generation pattern to the stock page provides a consistent, streamlined user experience across the ERP.

## What Changes

- **Row Selection in Stock View**: Add row checkboxes and master page checkbox to `StockView.vue` for selecting stock records.
- **Calm Header & Overflow Export Menu**: Replace standalone export buttons with a clean `[ Exporter ▾ ]` dropdown menu in the header for whole filtered inventory export (CSV, Devis PDF, Catalogue PDF).
- **Contextual Selection Toolbar**: When items are selected, show a calm, floating contextual bar with `✓ N produits sélectionnés`, an `[ Actions ▾ ]` dropdown menu (`Exporter CSV (N)`, `Devis PDF (N)`, `Catalogue PDF (N)`), and a `[ ✕ ]` clear selection button.
- **Selective Stock CSV Export**: Update backend `/inventory/export/csv` and frontend `inventoryService.exportStockCsv` to support filtering by specific stock row IDs.
- **A4 PDF Document Generation from Stock**: Connect `ProductDocumentModal.vue` to allow generating and printing Devis and Reference Catalog documents from filtered or selected stock items.

## Capabilities

### New Capabilities
- `stock-document-export`: Multi-row selection, selective CSV export, and A4 PDF generation (Devis & Reference Catalog) from the Stock & Inventory view.

### Modified Capabilities
<!-- None -->

## Impact

- **Frontend**:
  - `StockView.vue`: Selection state, contextual selection toolbar, overflow export dropdown, integration with `ProductDocumentModal.vue`.
  - `operations.service.ts`: Update `exportStockCsv` to accept optional `ids` parameter.
- **Backend**:
  - `inventory.routes.ts`: Update `/inventory/export/csv` to filter by comma-separated `ids` parameter.
