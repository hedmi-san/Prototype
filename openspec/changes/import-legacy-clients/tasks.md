## 1. Database Schema & Migration

- [x] 1.1 Add `num_fiscal VARCHAR(100)` column to `clients` in `backend/src/db/schema.ts`
- [x] 1.2 Expand `clients.phone` column from `VARCHAR(50)` to `VARCHAR(150)` in `backend/src/db/schema.ts`
- [x] 1.3 Add index on `clients.num_fiscal` for fast search and lookup
- [x] 1.4 Update TypeScript interfaces in `backend/src/routes/client.routes.ts` and `frontend/src/types/index.ts` to include `numFiscal`

## 2. Normalization & Matching Engine

- [x] 2.1 Create `backend/src/services/client-import.service.ts` with string and legal form normalization
- [x] 2.2 Implement phone number token extraction and tax identifier sanitization (preserving leading zeros)
- [x] 2.3 Implement composite address formatter (appending `Wilaya` to `Adresse`) and activity formatter (`Type cli.` + `ACTIVITEE`)
- [x] 2.4 Implement the tiered matching engine with Disjoint-Set Union (DSU) clustering (Tier 1 auto-merges, Tier 2 review conflicts, Tier 3 standalone records)
- [x] 2.5 Implement field conflict detection for differing names/addresses across auto-merged records

## 3. Backend Import API

- [x] 3.1 Implement `POST /api/clients/import/analyze` to parse and cluster multi-warehouse payloads without writing to database
- [x] 3.2 Implement `POST /api/clients/import/commit` wrapped in an atomic PostgreSQL transaction
- [x] 3.3 Implement canonical client code generation (`CLT-XXXX`) and master record insertion
- [x] 3.4 Implement per-warehouse `OPENING_BALANCE` insertions in `client_transactions` for every depot where a client has a balance

## 4. Frontend Multi-Warehouse Import Wizard

- [x] 4.1 Create `frontend/src/services/clientImport.service.ts` connecting to analysis and commit endpoints
- [x] 4.2 Create `frontend/src/components/clients/ClientImportModal.vue` with multi-file dropzone and depot selector
- [x] 4.3 Build Pre-Import Analysis Dashboard displaying summary KPIs (total records, auto-merges, conflicts, standalone accounts, net balance)
- [x] 4.4 Build interactive Tier 2 Review Queue with side-by-side comparison cards and merge/separate toggles
- [x] 4.5 Add "Importer (Multi-Dépôt)" button to `frontend/src/views/clients/ClientsListView.vue`

## 5. Verification & Ledger Audit

- [x] 5.1 Execute end-to-end import test with `TEST ABDOU.xlsx` and `TEST_WAREHOUSE_2.xlsx`
- [x] 5.2 Verify that legacy `Code Cli.` is completely omitted and unique `CLT-XXXX` codes are generated
- [x] 5.3 Verify that balances sum accurately and match ledger entries in `client_transactions`
- [x] 5.4 Verify that statement of account for each warehouse matches its legacy export
