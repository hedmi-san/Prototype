## Context

The product catalog view (`ProductListView.vue`) currently loads all products into client memory via `GET /products` and filters them client-side. As the inventory expands beyond 1,000 products with multiple users concurrently reading and writing catalog information (creating sales, modifying prices, receiving stock), client-side bulk querying incurs unnecessary network load, memory pressure, and out-of-sync UI states.

## Goals / Non-Goals

**Goals:**
- Implement server-side pagination (`page`, `limit`), dynamic sorting (`sortBy`, `sortOrder`), and brand filtering on `GET /products`.
- Provide a dedicated, lightweight `GET /products/brands` endpoint for the brand selection dropdown.
- Add PostgreSQL B-Tree indexes for `sale_price`, `purchase_price`, `name`, and `brand` to ensure sub-millisecond execution.
- Build a responsive dual sorting UI in `ProductListView.vue`: clickable table headers with directional indicators (`▲▼`) AND a "Sort By" quick dropdown.
- Add a 300ms search debounce, stale response sequence cancellation, immediate post-mutation refresh, and window focus auto-refetching.
- Preserve backward-compatible full-list retrieval for lightweight sales/POS comboboxes (`AppProductCombobox.vue` / `useProductStore`).

**Non-Goals:**
- Replacing Postgres with Elasticsearch or full-text search engine (PostgreSQL indexing and `LIMIT`/`OFFSET` are optimal for 1,000–50,000 products).
- Multi-select brand checkboxes (single-select dropdown meets current operational requirements).
- Keyset / Cursor-based pagination (page-numbered offset pagination is appropriate and seamlessly integrates with `AppPagination.vue`).

## Decisions

1. **PostgreSQL Server-Side Sorting & Filtering over Client-Side Computation**:
   - *Rationale*: Eliminates transferring megabytes of JSON and rendering 1,000+ DOM nodes in the browser. Postgres handles filtered queries and sorting in < 5ms with indexes.
   - *Alternatives considered*: Client-side virtual scrolling (rejected due to excessive network payloads on mobile/slow connections and inability to sort unretrieved dataset).

2. **Dual Sorting UX (Header Clicking + Quick Sort Dropdown)**:
   - *Rationale*: Provides power users with instant table column sort toggling while offering mobile / tablet users an accessible dropdown selector.

3. **Distinct Brand Endpoint (`GET /products/brands`)**:
   - *Rationale*: Separate query `SELECT DISTINCT brand ...` ensures the brand dropdown populates instantly without downloading product rows.

4. **Stale Request Cancellation Pattern**:
   - *Rationale*: Network requests for rapid search inputs or quick pagination clicks can resolve out of order. An incremental `requestId` ensures older responses are safely discarded.

5. **Window Focus Refetch & Post-Mutation Invalidation**:
   - *Rationale*: Concurrent edits from other users or within modal dialogs are reflected without requiring manual page reloads.

## Risks / Trade-offs

- **[Risk]** Legacy components expecting `Product[]` array directly from `GET /products`.
  - *Mitigation*: The endpoint checks query parameters; if `all=true` or unpaginated is requested, it returns the standard array or `normalizePaginatedResponse` handles both shapes gracefully in `catalog.service.ts`.
- **[Risk]** Database index overhead on writes.
  - *Mitigation*: The `products` table has high read-to-write ratios. 4 targeted B-tree indexes add negligible overhead on product inserts/updates while drastically speeding up sort queries.
