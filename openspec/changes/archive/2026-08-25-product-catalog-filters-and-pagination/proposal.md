## Why

The product catalog currently loads all products into browser memory simultaneously with client-side searching and no pagination or sorting controls. As the catalog scales past 1,000+ products and multiple users concurrently read and update products, this causes high network overhead, DOM sluggishness, and risks of stale data. Introducing server-side pagination, dynamic sorting, brand filtering, and high-concurrency request management will ensure instantaneous responsiveness, low bandwidth consumption, and fresh data.

## What Changes

- **Server-Side Pagination & Filtering for Products**: Support `page`, `limit`, `search`, `brand`, `sortBy`, and `sortOrder` on the `GET /products` API endpoint.
- **Dedicated Brand Facet Endpoint**: Add `GET /products/brands` to fetch distinct active product brands efficiently.
- **PostgreSQL Index Optimizations**: Add dedicated B-tree indexes for `sale_price`, `purchase_price`, `name`, and `brand` to support sub-millisecond sorting and filtering.
- **Frontend Catalog Controls**:
  - Add interactive column header sorting (Ascending / Descending indicators `▲▼`) for Reference, Name, Purchase Price, and Sale Price.
  - Add a dedicated "Sort By" dropdown for quick selection (Price low-to-high, Price high-to-low, Purchase price low-to-high, Purchase price high-to-low, Name A-Z, Name Z-A).
  - Add a single-select Brand filter dropdown (All Brands, plus distinct brands like WEHAND, KRAFT, BOSCH, etc.).
  - Integrate `AppPagination.vue` for page size selection (10, 25, 50, 100) and page navigation.
- **High-Concurrency & Smart Loading Safeguards**:
  - 300ms debounced search input.
  - Request sequence tracking / cancellation to discard out-of-order stale network responses.
  - Immediate local re-fetch after product creation, edit, or price update modals.
  - Auto-refetch on window focus / visibility change.
  - Retain lightweight lookup caching for POS / Sales combobox without polluting the main paginated catalog.

## Capabilities

### Modified Capabilities
- `product-management`: Add server-side pagination, multi-criteria sorting (sale price, purchase price, name, reference), brand filtering, and distinct brand retrieval to the product catalog specification.

## Impact

- **Backend**: `backend/src/routes/product.routes.ts`, `backend/src/db/schema.ts`.
- **Frontend**: `frontend/src/views/products/ProductListView.vue`, `frontend/src/services/catalog.service.ts`, `frontend/src/types/index.ts`.
- **Database**: PostgreSQL indexes added on `products` table.
- **Breaking Changes**: None; `GET /products` supports optional `all=true` or unpaginated fallbacks for legacy/internal combobox queries.
