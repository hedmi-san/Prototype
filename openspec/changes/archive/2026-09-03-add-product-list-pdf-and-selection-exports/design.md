## Context

`ProductListView.vue` currently lists products with server-side pagination (25 per page), search filtering, brand filtering, and sorting. It has a single export button that downloads a CSV file containing all filtered products.

This change introduces multi-row selection, dynamic export scoping (selected vs. all filtered), and two distinct A4 printable PDF document types:
1. **Liste de Vente / Devis**: Shows Reference, Designation, Brand, Packaging/Box Size, and Unit Sale Price.
2. **Catalogue Références**: Shows Reference and Designation (minimalist reference sheet).

## Goals / Non-Goals

**Goals:**
- Enable row selection on the product catalog table with master checkbox toggle on the current page.
- Add a dynamic contextual selection action bar that displays the count of selected products and provides quick export/print actions.
- Enhance the CSV export to support selective exports when rows are checked.
- Create reusable, high-fidelity A4 printable Vue components (`ProductPriceListDocument.vue` and `ProductCatalogDocument.vue`) with print-optimized styling (`@media print`, page breaks, typography).
- Provide an interactive modal dialog for instant print preview and direct browser printing / PDF generation (`window.print()`).

**Non-Goals:**
- Creating custom backend PDF renderers with headless browser dependencies (e.g. Puppeteer); Vue modal preview with standard browser print/PDF provides instant rendering, exact styling fidelity, and zero server overhead.
- Editing product details or quantities inside the generated devis (that belongs in the Sales creation module).

## Decisions

### Decision 1: Client-Side Printable Components vs. Server-Side PDF Rendering
- **Choice**: Build client-side Vue printable components ([ProductPriceListDocument.vue](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/components/products/ProductPriceListDocument.vue) and [ProductCatalogDocument.vue](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/components/products/ProductCatalogDocument.vue)) and render them in a preview modal using standard `@media print` CSS.
- **Rationale**:
  - Consistent with the existing invoice printing architecture in `InvoiceDocument.vue` and report printing in `StockValuationView.vue`.
  - Immediate visual feedback, exact rendering of fonts/branding, and native "Save as PDF" / printer support across all browsers without adding heavy npm dependencies.
- **Alternative Considered**: Server-side PDFKit/Puppeteer generation. Rejected due to performance overhead and maintenance complexity.

### Decision 2: Selection Scope Strategy
- **Choice**: If `selectedProductIds` is empty, export/document actions target **all filtered products** by querying the full dataset (`productService.getAllProducts`). If `selectedProductIds` has items, actions target **selected items only**.
- **Rationale**: Provides intuitive, friction-free UX. If a user filters by "KRAFT" and clicks "Devis PDF", they get all KRAFT products without having to select 100 checkboxes. If they check 3 specific items, they get those 3 items.

### Decision 3: Backend CSV Endpoint Support for Product IDs
- **Choice**: Update `/products/export/csv` route in `product.routes.ts` to accept an optional `ids` query parameter (comma-separated list of IDs).
- **Rationale**: Allows consistent server-side CSV formatting whether exporting all filtered or a specific set of IDs.

## Risks / Trade-offs

- **[Risk] Large Datasets when Exporting All Filtered**: Printing a PDF with thousands of products could cause page performance lag during print rendering.
  - **Mitigation**: Standard usage involves filtered subsets (e.g., specific brand or search). We will add a loading indicator while compiling the print preview data and optimize print CSS tables with `page-break-inside: avoid`.
