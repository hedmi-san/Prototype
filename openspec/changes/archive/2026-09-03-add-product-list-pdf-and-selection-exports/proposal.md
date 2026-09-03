## Why

Users currently can only export all filtered products into a CSV file from the product catalog. There is no way to selectively choose specific products for export or generate formatted printable PDF documents such as sales quotations ("Devis / Liste de Vente") or minimalist product reference sheets for inventory and catalog sharing.

Adding multi-item selection combined with PDF and CSV export capabilities allows users to quickly generate tailored pricing sheets, quotations, and reference lists for either all filtered items or a handpicked subset of products.

## What Changes

- **Row Selection in Product Catalog**: Add checkboxes to the product catalog table allowing users to select individual products, select/deselect all visible items on the current page, or clear the selection.
- **Dynamic Contextual Action Bar**: Introduce a persistent/contextual export action bar displaying the count of selected items with quick action buttons.
- **Multi-Format Product Export & Document Generation**:
  - **CSV Export**: Support exporting either all filtered products or strictly the selected products.
  - **PDF Liste de Vente / Devis**: Generate a clean, branded A4 printable document containing product reference, designation, brand, box packaging/colisage, and unit sale price (DZD).
  - **PDF Catalogue Références**: Generate a clean, minimalist A4 printable product list containing reference and product designation.
- **Interactive A4 Print Preview Modal**: Provide an in-app preview modal for the generated documents with one-click A4 printing and PDF saving (`window.print()`).

## Capabilities

### New Capabilities
- `product-document-export`: Multi-product selection, selective CSV export, and formatted A4 PDF generation for sales price lists (devis) and clean reference lists.

### Modified Capabilities
<!-- None -->

## Impact

- **Frontend**:
  - `ProductListView.vue`: Table selection checkboxes, selection state management, export action bar and dropdown.
  - `ProductDocumentModal.vue` / Printable components: New A4 printable document templates with `@media print` styling for sales pricing and reference lists.
  - `catalog.service.ts` / `export.ts`: Helpers for selective CSV export and document data compilation.
- **Backend**:
  - `/products/export/csv`: Support optional `ids` filtering (comma-separated product IDs) in query parameters to export specific selected items.
