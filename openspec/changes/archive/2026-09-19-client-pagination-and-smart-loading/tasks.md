## 1. Database Schema & Indexing

- [x] 1.1 Add composite indexes on `client_transactions` (`(client_id, transaction_date)` and `(client_id, warehouse_id, transaction_date)`) in `backend/src/db/schema.ts`
- [x] 1.2 Enable `pg_trgm` extension and create GIN trigram index on `clients` (`name`, `code`, `phone`) in `backend/src/db/schema.ts`

## 2. Backend Statement & History Pagination API

- [x] 2.1 Update `GET /api/clients/:id/statement` in `backend/src/routes/client.routes.ts` to default date ranges (current month for named clients, today for `is_default`), accept `page` and `limit`, compute indexed prior opening balance, and project running balances dynamically per page
- [x] 2.2 Add pagination (`page`, `limit`) and date filtering (`startDate`, `endDate`) to `GET /api/clients/:id/invoices` in `backend/src/routes/client.routes.ts`
- [x] 2.3 Add pagination (`page`, `limit`) and date filtering (`startDate`, `endDate`) to `GET /api/clients/:id/payments` in `backend/src/routes/client.routes.ts`
- [x] 2.4 Support `skipKpis=true` query parameter on `GET /api/clients` in `backend/src/routes/client.routes.ts` to skip redundant full-table aggregation during page flips

## 3. Frontend Client Statement & Passager Hybrid UX

- [x] 3.1 Update `frontend/src/services/client.service.ts` and `frontend/src/types/index.ts` to reflect paginated statement, invoices, and payments response contracts
- [x] 3.2 Update `ClientProfileView.vue` to initialize date range filters (current month for regular clients, today for `is_default`), and add table pagination controls to the Statement tab
- [x] 3.3 Add pagination and date filter synchronization to Invoices and Payments tabs in `ClientProfileView.vue`
- [x] 3.4 Add Passager contextual advisory banner and direct shortcut button navigating to the Sales Journal pre-filtered on Passager in `ClientProfileView.vue`

## 4. Scalable Directory & Combobox Typeahead

- [x] 4.1 Update `ClientsListView.vue` to decouple KPI loading (fetching KPIs on mount and balance filter toggle) and pass `skipKpis=true` on pagination, with URL query parameter synchronization
- [x] 4.2 Update `AppClientCombobox.vue` to use 200ms debounced server-side typeahead, permanently pin `Client Passager` at position 0, and hydrate single client metadata by ID when given an initial `modelValue`

## 5. Verification & Testing

- [x] 5.1 Verify Statement prior opening balance calculation, period pagination, and running balances under both global and warehouse-specific filters
- [x] 5.2 Verify Passager profile load performance with default daily scope and sales journal redirect link
- [x] 5.3 Verify combobox search responsiveness, zero-keystroke selection of pinned Passager, and directory URL bookmarking
