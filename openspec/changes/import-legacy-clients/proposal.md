## Why

The platform needs to import historical client accounts exported from the legacy software across multiple warehouse depots. Because each warehouse operated on independent legacy databases, local client identifiers (`Code Cli.`) were auto-incremented independently, causing the same real-world client to have different codes and separate balances in each warehouse export. 

Directly importing these files without entity resolution would generate thousands of duplicate accounts, fragment historical client balances, and corrupt multi-depot accounting. This change provides a multi-file ingestion pipeline that reconciles client identities using a tiered matching strategy (tax identifiers, normalized names, and phone numbers), sums historical balances across warehouses, flags ambiguities for human review in an interactive wizard, and preserves warehouse-level opening balances in the financial ledger.

## What Changes

- **Database Schema**:
  - Add `num_fiscal VARCHAR(100)` to the `clients` table.
  - Expand `clients.phone` to `VARCHAR(150)` to accommodate multiple contact numbers and descriptive annotations without truncation.
  - Add database indexing on `num_fiscal` for fast retrieval.
- **Backend Matching & Consolidation Engine**:
  - Implement entity normalization for names (legal entity token stripping, accent removal, punctuation normalization), phone numbers (extracting valid Algerian landline/mobile digit sets), and tax numbers (RC, Art, NIF, NIS, Fiscal with leading zeros preserved).
  - Implement Tier 1 auto-merging: exact match on non-empty RC/Article with name consistency, or exact normalized name and phone match. Automatically aggregate balances across source warehouses.
  - Implement Tier 2 review queue: flag partial signals (e.g. conflicting names on same tax ID, conflicting phones on same name, or name match with missing contact info) for human resolution.
  - Field transformation: automatically concatenate `Wilaya` to `Adresse`, and combine `Type cli.` and `ACTIVITEE` into `activite`.
  - Ledger integration: generate individual `OPENING_BALANCE` entries in `client_transactions` tagged by warehouse to ensure per-warehouse statements reconcile with legacy balances.
- **Frontend Interactive Import Wizard**:
  - Create a multi-warehouse client import modal (`ClientImportModal.vue`) supporting concurrent multi-file upload with depot assignment.
  - Provide a preview dashboard with KPIs (scanned records, auto-merges, conflicts, standalone accounts, total balance).
  - Provide an interactive resolution queue for Tier 2 conflicts (merge/separate toggle, field value picker for name/address).
  - Execute chunked batch import with progress bar and ledger balance integrity verification.

## Capabilities

### New Capabilities
- `legacy-client-import`: Multi-warehouse client ingestion, tiered entity matching, manual conflict review queue, balance summation, and warehouse-level opening ledger generation.

### Modified Capabilities
- `client-management`: Update client schema requirements to support `num_fiscal` and expanded phone field for legacy imported accounts.

## Impact

- **Database**: `clients` table schema migration (`num_fiscal`, expanded `phone`).
- **Backend Routes**: New endpoints `/api/clients/import/analyze` and `/api/clients/import/commit`.
- **Frontend Views & Components**: Add "Importer (Multi-Dépôt)" button to `ClientsListView.vue` and new `ClientImportModal.vue`.
- **Dependencies**: Uses existing `xlsx` library in frontend for client-side workbook parsing.
