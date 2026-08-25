## 1. Database Indexing & Backend Routes

- [x] 1.1 Add PostgreSQL indexes in `backend/src/db/schema.ts` for `products(sale_price)`, `products(purchase_price)`, `products(name)`, and `products(brand)`
- [x] 1.2 Implement `GET /products/brands` endpoint in `backend/src/routes/product.routes.ts` returning distinct active brands
- [x] 1.3 Upgrade `GET /products` in `backend/src/routes/product.routes.ts` to support server-side `page`, `limit`, `search`, `brand`, `sortBy`, `sortOrder`, and `all` parameter, returning `{ items, pagination }`

## 2. Frontend Services & Types

- [x] 2.1 Update `frontend/src/types/index.ts` with `ProductQueryParams` and `ProductSortBy` definitions
- [x] 2.2 Update `frontend/src/services/catalog.service.ts` to support `getProducts(params)` and `getBrands()` with `normalizePaginatedResponse`
- [x] 2.3 Verify `useProductStore` in `frontend/src/stores/product.store.ts` handles combobox queries seamlessly without breaking existing consumers

## 3. Frontend Catalog View Implementation

- [x] 3.1 Refactor `frontend/src/views/products/ProductListView.vue` state to support server-side pagination (`page`, `limit`, `total`, `totalPages`) with `AppPagination`
- [x] 3.2 Add single-select Brand filter dropdown and wire dynamic brand fetching from `GET /products/brands`
- [x] 3.3 Add "Sort By" quick dropdown selector for sale price, purchase price, name, and reference
- [x] 3.4 Add interactive table column headers with directional sorting indicators (`▲▼`) that update sorting state and trigger server refetches
- [x] 3.5 Implement 300ms search input debouncing and request sequence tracking to discard stale network responses
- [x] 3.6 Implement auto-refetch on window focus (`window.onfocus` / `visibilitychange`) and post-mutation refresh on product create/edit/pricing save

## 4. Verification & Testing

- [x] 4.1 Verify sorting by sale price (lowest to highest, highest to lowest), purchase price, and product name (A-Z, Z-A)
- [x] 4.2 Verify brand filtering with pagination counts and reset behaviors
- [x] 4.3 Verify search debouncing, stale response cancellation, and page size transitions
- [x] 4.4 Verify product creation and price update modal workflows refresh the active catalog view smoothly
