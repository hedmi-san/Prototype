## Context

The system tracks stock per product and warehouse across multiple locations. Currently, `GET /inventory/stock` returns the full unpaginated stock dataset and `StockView.vue` performs all search filtering in-memory in the browser. When the product catalog exceeds 1,000 items and multiple warehouses, this creates high network payloads and lacks quick operational filtering for critical inventory states like low stock and out-of-stock items.

## Goals / Non-Goals

**Goals:**
- Provide server-side pagination with standard page sizes (25, 50, 100) and instant navigation.
- Implement server-side status filtering (`all`, `normal`, `low`, `out`) and server-side search across references, designations, brands, and warehouse names.
- Deliver real-time status KPI counters (`total`, `normal`, `lowStock`, `outOfStock`) in a single aggregated backend query.
- Eliminate eager loading of the entire 1,000+ product catalog on stock view mount.
- Add database indexes to ensure query times remain under 15ms during concurrent transactions.
- Preserve backward compatibility for any existing stock service callers.

**Non-Goals:**
- Changing database schema columns or foreign key constraints.
- Modifying stock mutation workflows (sales, transfers, adjustments retain existing transactional isolation).

## Decisions

### 1. Unified Paginated API Response with Live Status Counters
- **Decision**: Update `GET /inventory/stock` to return `{ items, pagination, counts }` where `counts` contains `{ total, normal, low, out }`.
- **Rationale**: Computing the status counts in the same request using PostgreSQL's `COUNT(*) FILTER (...)` allows the UI to display live badge counters on filter tabs without executing 4 distinct HTTP requests or unpaginated scans.
- **Alternatives Considered**: 
  - *Separate `/inventory/stock/counts` endpoint*: Adds extra HTTP round-trips and potential cache synchronization issues.
  - *Client-side counting*: Requires loading the entire database table into browser memory, defeating the purpose of pagination.

### 2. Multi-Term Server-Side Search & Parameterized Query Builder
- **Decision**: Construct dynamic SQL where-clauses using parameterized queries (`$1`, `$2`, ...) supporting multi-column searching on `products.name`, `products.reference`, `products.brand`, and `warehouses.name`.
- **Rationale**: Guarantees fast search without SQL injection risks while handling case-insensitive substrings with `ILIKE`.

### 3. Smart Loading & Decoupled Product Store in StockView
- **Decision**: Remove `productStore.fetchProducts()` from `StockView.vue`'s `onMounted` lifecycle hook. Defer product catalog loading until the user explicitly opens the *Réception de Stock* modal.
- **Rationale**: Prevents downloading 1,000+ full product models for users who are merely auditing, searching, or reviewing stock levels.

### 4. Database Indexing & Concurrency Safety
- **Decision**: Add composite/lookup indexes on `stock(product_id)` and `products(name, reference, brand)` in `backend/src/db/schema.ts`.
- **Rationale**: Speeds up the primary `JOIN` between `stock` and `products` tables and accelerates text filtering while ensuring write operations (`SELECT ... FOR UPDATE`) remain fine-grained to specific rows without table lock escalation.

## Risks / Trade-offs

- **[Risk] Existing consumers expecting raw array from `/inventory/stock`** → **Mitigation**: Update `operations.service.ts` to normalize responses, supporting both paginated `{ items, pagination, counts }` payloads and legacy arrays.
- **[Risk] Search performance on very large text columns** → **Mitigation**: Add B-Tree indexes on `products(reference)` and composite search indexes, utilizing indexed columns in the WHERE filter.
- **[Risk] Filter state loss on page change** → **Mitigation**: Centralize search and status filter state in `StockView.vue` so changing pages retains active status and search query.
