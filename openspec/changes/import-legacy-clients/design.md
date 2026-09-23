## Context

The distributor platform operates a centralized multi-warehouse system with global client accounts and warehouse-specific stock and ledger tracking. Legacy client data is stored across separate legacy databases and exported as one XLSX file per warehouse (e.g. `TEST ABDOU.xlsx`). Because the legacy system used an independent auto-incremented `Code Cli.` in each depot, the same real-world customer appears in multiple warehouse exports with different codes and distinct balances.

## Goals / Non-Goals

**Goals:**
- Provide a multi-file client import wizard in the Vue frontend capable of ingesting multiple warehouse exports simultaneously.
- Consolidate duplicate clients using a tiered matching algorithm:
  - **Tier 1 (Auto-Merge)**: Non-empty RC/Article match with name consistency, or normalized name + phone match. Balances are summed across warehouses.
  - **Tier 2 (Review Queue)**: Ambiguous signals (divergent names on identical tax ID, conflicting phones on identical names, or homonyms with missing contact info) are presented in a side-by-side interactive UI for human decision.
  - **Tier 3 (Standalone)**: Unique records are imported as new clients.
- Add `num_fiscal VARCHAR(100)` to the `clients` table and expand `phone` to `VARCHAR(150)`.
- Record warehouse-specific `OPENING_BALANCE` entries in `client_transactions` to preserve sub-ledger accountability per depot.
- Append `Wilaya` to `Adresse` and merge `Type cli.` and `ACTIVITEE` into `activite`.

**Non-Goals:**
- Storing legacy `Code Cli.` values: `Code Cli.` is dropped entirely; new sequential `CLT-XXXX` codes are generated.
- Historical invoice import: only opening balances are carried forward.
- Modifying stock or product catalogs during client import.

## Decisions

### 1. Completely omit legacy `Code Cli.`
- **Choice**: Discard the legacy `Code Cli.` column entirely during ingestion and generate canonical `CLT-XXXX` platform identifiers via Postgres sequences.
- **Rationale**: Since `Code Cli.` was a local auto-increment, warehouse A and warehouse B assigned the same number (e.g. `000154`) to completely unrelated customers. Storing it as a primary or secondary reference would cause collisions and customer confusion.

### 2. Two-phase Ingestion Architecture: `/analyze` and `/commit`
- **Choice**: Split the backend import API into two distinct endpoints:
  - `POST /api/clients/import/analyze`: Ingests parsed warehouse records, performs entity resolution, and returns clustered groups (Tier 1, Tier 2 conflicts, Tier 3) along with financial metrics without modifying the database.
  - `POST /api/clients/import/commit`: Receives confirmed clusters and operator decisions for Tier 2 items, executing atomic insertion in a single database transaction.
- **Rationale**: This gives the operator full visibility and veto power before any database state is altered.

### 3. Disjoint-Set Union (DSU) for Transitive Cross-Warehouse Clustering
- **Choice**: Model matching records as a graph and use Disjoint-Set Union (Union-Find) to resolve multi-depot clusters (e.g., if Record A from Depot 1 merges with Record B from Depot 2, and Record B merges with Record C from Depot 3, they coalesce into a single unified client).
- **Rationale**: Prevents duplicate partial merges and guarantees that all warehouse balances for an entity converge into a single customer profile.

### 4. Dual Balance Ledger Accounting
- **Choice**: Set `clients.opening_balance` and `clients.current_balance` to the grand total sum across all source depots, while creating individual `client_transactions` rows tagged with each specific `warehouse_id` for each non-zero depot balance.
- **Rationale**: Company-wide accounts show the true unified debt/credit, while each depot manager can pull an account statement filtered by their warehouse that matches their legacy export down to the centime.

### 5. String Normalization Pipeline
- **Names**: Unicode NFD accent stripping, uppercase conversion, punctuation removal, and legal-entity token removal (`SARL`, `EURL`, `SNC`, `SPA`, `STE`, `ETS`, `GROUPE`).
- **Phones**: Extraction of continuous 9-10 digit Algerian mobile/landline numbers (`0[2-9]\d{7,8}`) for matching tokens, while retaining the full raw descriptive string in `clients.phone`.
- **Tax Numbers**: Strip non-alphanumeric punctuation (`.`, `-`, `/`, spaces) while strictly retaining leading zeros as strings (e.g., Article `06230120401`).

## Risks / Trade-offs

- **[Risk] Homonym Over-Merging**: Two different clients with generic names (e.g. "BENALI MOHAMED") lacking phone and tax numbers could be merged accidentally.
  - **Mitigation**: Name-only matches without corroborating phone or tax numbers are strictly classified into **Tier 2 (Review Queue)**, requiring explicit operator approval.
- **[Risk] Divergent Names on Recycled Tax Numbers**: A business may have changed hands or a clerk made a typo in the Article number.
  - **Mitigation**: If RC or Article matches but name similarity is below 0.50, the match is routed to Tier 2 rather than auto-merged.
- **[Risk] Mid-Import Database Failure**: Network interruption or constraint violation during a 2,000-record batch could leave half the clients imported.
  - **Mitigation**: The `/commit` operation is wrapped in a single PostgreSQL transaction (`BEGIN ... COMMIT`) with automatic rollback on error.
