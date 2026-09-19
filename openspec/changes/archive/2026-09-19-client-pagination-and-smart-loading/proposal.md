## Why

As the business scales towards 6,000+ registered commercial clients and years of sales history, the current architecture faces critical bottlenecks:
1. **Memory Exhaustion & Ledger Freezes**: The financial statement (`/api/clients/:id/statement`), invoices, and payments endpoints fetch 100% of historical transactions into Node.js memory without pagination. For the default walk-in counter account (`Client Passager / Comptoir`), which aggregates every unregistered counter sale, transactions accumulate to hundreds of thousands or millions of rows. Opening this profile currently triggers severe V8 heap memory pressure (OOM), massive JSON payloads, and browser tab crashes.
2. **Directory & Search Inefficiencies**: The client directory recalculates full-table aggregate KPIs on every page flip and search keystroke, and relies on `ILIKE '%term%'` full-table scans.
3. **Dropdown Capping & Invalidation Risks**: The frontend client store caps cached clients at 500 items, causing client lookups in sales forms to miss up to 5,500 clients.

This change introduces deterministic date-range scoping, period pagination, server-side trigram typeahead, and hybrid Passager handling to guarantee sub-second performance at scale.

## What Changes

- **Date-Range First Statement Scoping**: Default statement view to **Current Month** for regular clients and **Today** for the Passager client, with indexed calculation of prior carried-forward opening balance.
- **Statement & History Pagination**: Paginate statement ledger rows, invoices, and payments within the scoped date range with dynamic running balance calculation per page.
- **Passager UX Hybrid Architecture**: Maintain the audit ledger for the Passager client scoped to today with an informational banner, and provide a direct shortcut to the Sales Journal pre-filtered on Passager for cross-cutting audits.
- **PostgreSQL Composite & Trigram Indexing**: Add composite indexes on `(client_id, transaction_date)` and `(client_id, warehouse_id, transaction_date)` for instant carried-forward balance sums, plus a `pg_trgm` GIN index on `clients(name, code, phone)` for sub-15ms fuzzy search.
- **Server-Side Typeahead Combobox with Pinned Passager**: Redesign `AppClientCombobox` to use debounced remote search against the trigram index, with `Client Passager` statically pinned at the top for instant 0-keystroke selection.
- **Decoupled Client Directory KPIs & URL State**: Separate heavy KPI aggregation from paginated client list requests and synchronize table pagination and search state with browser URL query parameters.

## Capabilities

### New Capabilities
<!-- No brand new standalone capabilities required; changes build directly on existing client and ledger domains. -->

### Modified Capabilities
- `client-financial-ledger`: Introduce date-range first default scoping, period-based pagination, dynamic page running balance calculation, composite query indexing, and daily-scoped hybrid ledger handling for the default walk-in client.
- `client-management`: Introduce scalable server-side trigram typeahead search with pinned default walk-in selection, decoupled KPI loading from list queries, and URL-synchronized directory pagination capable of handling 6,000+ accounts.

## Impact

- **Backend APIs**:
  - `GET /api/clients/:id/statement`: Add `page`, `limit` pagination parameters, enforce date range defaulting (current month for named clients, today for passager), and return paginated transactions with period opening and closing balances.
  - `GET /api/clients/:id/invoices`: Add `page`, `limit`, `startDate`, and `endDate` query parameters with pagination metadata.
  - `GET /api/clients/:id/payments`: Add `page`, `limit`, `startDate`, and `endDate` query parameters with pagination metadata.
  - `GET /api/clients`: Add `skipKpis` parameter to skip redundant full-table aggregation during page flips.
- **Database**:
  - Add PostgreSQL extension `pg_trgm`.
  - Add composite index on `client_transactions(client_id, transaction_date)`.
  - Add composite index on `client_transactions(client_id, warehouse_id, transaction_date)`.
  - Add GIN trigram index on `clients` across `name`, `code`, and `phone`.
- **Frontend Views & Components**:
  - `ClientProfileView.vue`: Date-range first initialization (month vs. today), ledger pagination controls, Passager advisory banner and sales journal redirect link.
  - `ClientsListView.vue`: Decoupled KPI loading, URL query parameter synchronization (`?page=X&search=Y&balanceFilter=Z`).
  - `AppClientCombobox.vue`: Pure server-side debounced typeahead, pinned Passager option at position 0, standalone model resolution.
