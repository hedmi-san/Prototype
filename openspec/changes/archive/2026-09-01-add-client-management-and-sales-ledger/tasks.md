## 1. Database Schema & Migration

- [x] 1.1 Update `backend/src/db/schema.ts` to create `clients`, `client_transactions`, `client_payments`, and `payment_allocations` tables, and alter `sales` table with `client_id`, `payment_status`, and `paid_amount`.
- [x] 1.2 Update `backend/src/db/seed.ts` to ensure default `CLT-COMPTOIR` ("Client Passager / Comptoir") is pre-seeded along with realistic demo clients and financial transactions.

## 2. Backend Client, Ledger & Sales API

- [x] 2.1 Create `backend/src/routes/client.routes.ts` supporting client listing, creation, updating, search, KPI metrics, and Statement of Account ledger queries with warehouse and date range filters.
- [x] 2.2 Implement Statement of Account (Extrait de Compte) PDF generator endpoint in `backend/src/routes/client.routes.ts`.
- [x] 2.3 Create `backend/src/routes/client-payment.routes.ts` supporting payment (versement) creation with row-level locking, immutable running balance snapshot, and hybrid invoice allocation.
- [x] 2.4 Update `backend/src/routes/sale.routes.ts` to assign `client_id`, record downpayments (acomptes), write ledger invoice debits within DB transactions, and handle sale cancellation ledger reversals.
- [x] 2.5 Register `/api/clients` and `/api/client-payments` routes in `backend/src/server.ts`.

## 3. Frontend Client Management & Ledger UI

- [x] 3.1 Add TypeScript interfaces for Client, ClientTransaction, ClientPayment, and PaymentAllocation in `frontend/src/types`.
- [x] 3.2 Implement API services in `frontend/src/services/client.service.ts` and state management in `frontend/src/stores/client.store.ts`.
- [x] 3.3 Build Clients Directory View (`frontend/src/views/clients/ClientsListView.vue`) with search, debtor filtering, KPI summary cards, and New Client modal.
- [x] 3.4 Build Client Profile View (`frontend/src/views/clients/ClientProfileView.vue`) featuring balance stats, Statement of Account ledger tab with date/warehouse filters, Invoices tab, and Payments tab.
- [x] 3.5 Build New Payment (Versement) modal component with hybrid invoice selection and bulk allocation support.
- [x] 3.6 Register Client routes in `frontend/src/router/index.ts` and add navigation menu items in layout.

## 4. Frontend Sales & POS Integration

- [x] 4.1 Update `CreateSaleView.vue` with searchable Client Combobox, live balance indicator, and payment conditions (Comptant, À Crédit, Versement partiel).
- [x] 4.2 Update `SalesListView.vue` with `payment_status` badges (`Payée`, `Partielle`, `Non payée`), payment status filters, and Client column.

## 5. Verification & Testing

- [x] 5.1 Run TypeScript type check on frontend (`vue-tsc --noEmit`) and backend (`tsc --noEmit`).
- [x] 5.2 Validate end-to-end user workflows: creating client, selling on credit, recording versement, verifying Statement of Account (Extrait de Compte) running balance.
