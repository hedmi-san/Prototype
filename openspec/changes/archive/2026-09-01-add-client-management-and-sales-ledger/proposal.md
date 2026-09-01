## Why

The current sales subsystem records transactions with simple free-text customer fields and assumes immediate completed sales without tracking debts, credit terms, downpayments, or payments over time. To support commercial tool distribution, the business requires a robust, accountant-grade client management system with an immutable double-column financial ledger, hybrid payment allocations against invoices, and comprehensive client profile tracking across all warehouses.

## What Changes

- **Clients Directory & Master Data**: Introduces a dedicated `clients` registry supporting company details, contact info, opening balances, cached balances, and a default "Client Passager / Comptoir" for casual walk-ins.
- **Immutable Double-Column Client Ledger**: Implements `client_transactions` storing separate `debit` (+what client owes) and `credit` (-what client pays or is refunded) columns, immutable running balance snapshots, and strict audit trails without direct manual balance overwrites.
- **Sales Payment Status & Client Linkage**: Extends `sales` with `client_id`, `payment_status` (`PAID`, `PARTIALLY_PAID`, `UNPAID`), and `paid_amount`, enabling both immediate cash checkout, sales on credit, and downpayments (acomptes).
- **Client Payments & Hybrid Invoice Allocation**: Implements `client_payments` and `payment_allocations` allowing bulk or partial payments (versements) to be allocated across one or more sales invoices or held as unallocated account credits.
- **Client Profile & Statement of Account (Extrait de Compte)**: Adds a full-featured client profile view featuring summary KPIs (total purchases, total paid, debt), searchable ledger history with date range and warehouse filters, invoice history, payment receipts, and PDF statement export.
- **Multi-Warehouse Financial Scoping**: Embeds `warehouse_id` on all ledger entries and payments to allow filtering statements by individual depot as well as viewing global company-wide debt.

## Capabilities

### New Capabilities
- `client-management`: Core client registry, master data management, search, default walk-in customer support, and cached balance synchronization.
- `client-financial-ledger`: Double-column immutable ledger (`client_transactions`), snapshot running balances, balance adjustments, and printable Statement of Account (Extrait de Compte) with PDF generation.
- `sales-payment-tracking`: Sales payment statuses (`PAID`, `PARTIALLY_PAID`, `UNPAID`), downpayment processing at checkout, payment receipts (`client_payments`), and hybrid invoice allocations (`payment_allocations`).

### Modified Capabilities
<!-- No requirement changes to existing specs -->

## Impact

- **Database**: Adds `clients`, `client_transactions`, `client_payments`, and `payment_allocations` tables; alters `sales` table to add `client_id`, `payment_status`, and `paid_amount` with associated indexes.
- **Backend API**: Adds `/api/clients` and `/api/client-payments` route modules; updates `/api/sales` routes to handle client assignment, downpayments, and payment status updates within DB transactions.
- **Frontend UI**: Adds new Clients navigation, Client List (`/clients`), Client Profile & Statement of Account (`/clients/:id`), Payment/Versement modal, and updates Sales POS / Creation view and Sales List table with payment status indicators.
