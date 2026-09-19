## Context

In the Multi-Warehouse Distribution system, clients engage in commercial transactions across multiple warehouses over several years. Unregistered walk-in retail purchases are attributed to a default account (`Client Passager / Comptoir`, `is_default = true`).

Currently:
1. `GET /api/clients/:id/statement` executes `SELECT * FROM client_transactions WHERE client_id = $1` without pagination, loading all historical transactions into Node.js heap memory, computing cumulative running balances in a JavaScript loop, and serializing the entire payload. For the Passager client with hundreds of thousands to millions of rows, this triggers Node.js out-of-memory (OOM) crashes and browser freezes.
2. Similar unpaginated queries exist for `GET /api/clients/:id/invoices` and `GET /api/clients/:id/payments`.
3. Client directory listing (`GET /api/clients`) performs full-table aggregate queries for KPIs on every page navigation and search keystroke.
4. Client search in forms is either capped at 500 records in `client.store.ts` or relies on `ILIKE '%term%'` full-table scans.

## Goals / Non-Goals

**Goals:**
- **Deterministic Memory Bound**: Ensure no client profile or statement query ever pulls unbounded datasets into memory, regardless of account age or transaction volume (scaling to 1M+ rows).
- **Accurate Filtered Running Balances**: Dynamically calculate starting and page running balances that remain mathematically accurate when scoped by date range and warehouse filters.
- **Passager Daily Scoping**: Tailor the Passager profile to a daily cadence (`today`) with an informational banner and direct audit redirection to the Sales Journal.
- **Sub-15ms Search at Scale**: Power client lookups across 6,000+ commercial clients using PostgreSQL trigram indexing and debounced remote typeahead.
- **Instant Default Client Selection**: Statically pin the Passager client at the top of client selectors with zero keystrokes required.
- **Decoupled Directory KPIs**: Avoid re-aggregating full-table summary metrics during pagination transitions.

**Non-Goals:**
- Client-side IndexedDB caching of client directories (avoiding cache invalidation edge cases at POS).
- Changing the underlying double-column accounting model (`client_transactions` table structure remains intact).
- Deprecating or eliminating the `Client Passager` account.

## Decisions

### Decision 1: Date-Range First with Dynamic Running Balance Projection
- **Rationale**: Relying on stored `running_balance` values breaks under warehouse filters or date-slice browsing. Conversely, streaming all historical transactions causes memory exhaustion. 
- **Mechanism**:
  1. Default date filters:
     - Regular clients: First day of current month (`YYYY-MM-01 00:00:00`) to current time.
     - Passager client: Beginning of today (`YYYY-MM-DD 00:00:00`) to end of today.
  2. Prior Opening Balance Calculation:
     ```sql
     SELECT COALESCE(SUM(debit) - SUM(credit), 0) AS prior_balance
     FROM client_transactions
     WHERE client_id = $1 AND transaction_date < $startDate
     [AND warehouse_id = $warehouseId];
     ```
  3. Period Page Fetch:
     ```sql
     SELECT t.*, w.name as warehouse_name, w.code as warehouse_code, u.full_name as created_by_name
     FROM client_transactions t
     JOIN warehouses w ON t.warehouse_id = w.id
     JOIN users u ON t.created_by = u.id
     WHERE t.client_id = $1 AND t.transaction_date >= $startDate AND t.transaction_date <= $endDate
     [AND t.warehouse_id = $warehouseId]
     ORDER BY t.transaction_date ASC, t.id ASC
     LIMIT $limit OFFSET $offset;
     ```
  4. Running Balance Projection:
     The server calculates the page offset balance:
     `pageStartingBalance = prior_balance + SUM(debit - credit for period records before the current offset)`
     and maps each row's running balance in sequence.
- **Alternatives Considered**:
  - *All-Time Paginated using stored running balance*: Rejected because stored balances represent global client state and become inaccurate under warehouse filtering.
  - *Virtual scrolling without date limits*: Rejected because backend would still need to calculate or stream millions of rows.

### Decision 2: Hybrid Passager Profile Architecture
- **Rationale**: Passager accounts aggregate cash walk-in transactions where `debit == credit` (balance = 0). While an audit trail is legally and operationally necessary, reading a multi-year ledger for walk-ins is an anti-pattern.
- **Implementation**:
  - Keep the full ledger view, but initialize with `startDate = today` and `endDate = today`.
  - Display a prominent alert banner explaining that Passager aggregates high-volume counter sales.
  - Provide a 1-click shortcut button: *"Ouvrir le Journal des Ventes (Filtre Passager)"* routing to `/sales` with cashier and till filters.

### Decision 3: Database Indexing for High-Volume Queries
- **Composite Indexes**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_client_transactions_client_date 
    ON client_transactions(client_id, transaction_date);

  CREATE INDEX IF NOT EXISTS idx_client_transactions_client_wh_date 
    ON client_transactions(client_id, warehouse_id, transaction_date);
  ```
- **PostgreSQL Trigram Search**:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  CREATE INDEX IF NOT EXISTS idx_clients_trgm_search 
    ON clients USING gin (
      (name || ' ' || code || ' ' || COALESCE(phone, '')) gin_trgm_ops
    );
  ```
  This guarantees sub-15ms fuzzy search for `ILIKE '%term%'` patterns across 6,000+ clients.

### Decision 4: Server-Side Typeahead Combobox with Pinned Passager
- **Implementation**:
  - Remove the client-side store cap of 500.
  - Debounce search queries by 200ms before sending `GET /api/clients?search=<query>&limit=15&activeOnly=true`.
  - Statically pin `Client Passager` at position 0 in the dropdown menu with a distinct badge.
  - On component mount with an initial `modelValue`, if the client is not in the local search buffer, fetch that single client via `GET /api/clients/:id` to hydrate the display.

### Decision 5: Decouple Directory KPIs and Synchronize URL State
- In `GET /api/clients`, accept `skipKpis=true`.
- In `ClientsListView.vue`:
  - Request KPIs once on view mount or when toggling balance category filters (`all`, `debtors`, `advance`, `settled`).
  - Pass `skipKpis=true` on pure page transitions (page 1 -> page 2) or page size changes.
  - Bind `page`, `search`, and `balanceFilter` to Vue Router query parameters (`?page=2&search=...`).

## Risks / Trade-offs

- **[Risk] Deep pagination on wide date ranges (e.g. user selects a 3-year date range for Passager)**:
  - *Mitigation*: Limit the maximum date range for the Passager client to 31 days. For named clients, default to 30 days while enforcing a maximum per-page limit of 100 rows.
- **[Risk] Summing prior transactions for opening balance on massive accounts**:
  - *Mitigation*: The composite index `(client_id, transaction_date)` allows PostgreSQL to perform an index-only scan on debit and credit columns, completing within milliseconds even over hundreds of thousands of historical records.
- **[Risk] Availability of `pg_trgm` extension**:
  - *Mitigation*: Enable `CREATE EXTENSION IF NOT EXISTS pg_trgm` in migration/schema setup. If unprivileged, fallback to prefix matching B-Tree `(code, name)`.
