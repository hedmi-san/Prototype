## Context

The Multi-Warehouse Tool Distribution System manages multi-depot stock, transfers, employees, expenses, and sales. Until now, sales records captured only transient customer names and assumed immediate checkout. This design introduces an enterprise-grade client management subsystem and a double-column immutable financial ledger to track sales on credit, customer debts (soldes), downpayments (acomptes), and payment receipts (versements).

## Goals / Non-Goals

**Goals:**
- Implement an immutable double-column financial ledger (`client_transactions`) tracking separate `debit`, `credit`, and snapshot `running_balance`.
- Support client master data with contact details, fiscal identifiers (NIF/RC/NIS/ART), and automatic seeding of a default "Client Passager / Comptoir".
- Enable sales payment status tracking (`PAID`, `PARTIALLY_PAID`, `UNPAID`) with immediate downpayment handling at POS checkout.
- Support hybrid payment allocation: bulk versements that reduce global debt and specific invoice allocations via `payment_allocations`.
- Deliver a dedicated Client Profile view featuring financial summaries, an interactive and printable Statement of Account (Extrait de Compte) with PDF generation, and invoice/payment histories.
- Ensure multi-warehouse scoping by capturing `warehouse_id` on all transactions and payments.

**Non-Goals:**
- Automated credit limit blocking or automated debt collection messaging (ruled out during exploration).
- Direct mutation of historical ledger rows (strictly forbidden by architectural rules).

## Decisions

### 1. Two-Column Ledger (`debit` and `credit`) over Signed Amounts
- **Rationale**: Storing non-negative `debit` and `credit` columns conforms to standard accounting practices and simplifies generation of Statement of Account (Extrait de Compte) reports.
- **Alternatives Considered**: A single signed numeric amount. Rejected because it complicates debit/credit reporting and fails standard audit expectations.

### 2. Snapshot `running_balance` with Row-Level Locking
- **Rationale**: Every ledger entry captures a snapshot of `running_balance` (`previous_running_balance + debit - credit`). Database writes are wrapped in transactions that execute `SELECT current_balance FROM clients WHERE id = $1 FOR UPDATE` to serialize concurrent ledger writes for the same client and eliminate balance drift.
- **Alternatives Considered**: Dynamic `SUM(debit) - SUM(credit)` calculation on every read. Rejected due to poor performance as transaction history grows.

### 3. Hybrid Payment Allocation Model
- **Rationale**: Businesses in the distribution sector frequently receive lump-sum cheques or cash deposits covering multiple deliveries, alongside occasional invoice-specific payments. Using `payment_allocations` links payments to specific invoices while permitting unallocated remainder amounts to stay as account credits.
- **Alternatives Considered**: Strict invoice-only payments (too rigid for real-world bulk payments) vs. account-only rolling balances (loses track of individual invoice payment statuses).

### 4. Automatic Seed of Default "Client Passager / Comptoir"
- **Rationale**: Casual counter buyers who pay cash should not require creating individual client accounts, yet sales records should remain structurally consistent. The system seeds `CLT-COMPTOIR` with `is_default = TRUE`.

## Schema Design

```sql
-- 1. Clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Client Transactions (The Immutable Ledger)
CREATE TABLE IF NOT EXISTS client_transactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  type VARCHAR(50) NOT NULL, -- 'INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'ADJUSTMENT', 'OPENING_BALANCE'
  reference_type VARCHAR(50), -- 'SALES_INVOICE', 'CLIENT_PAYMENT', 'RETURN', 'ADJUSTMENT'
  reference_id INTEGER,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0.0 CHECK(debit >= 0),
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0.0 CHECK(credit >= 0),
  running_balance NUMERIC(14, 2) NOT NULL,
  description TEXT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Client Payments (Payment receipts & method details)
CREATE TABLE IF NOT EXISTS client_payments (
  id SERIAL PRIMARY KEY,
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK(amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH', -- 'CASH', 'CHECK', 'BANK_TRANSFER', 'CARD'
  reference_number VARCHAR(100),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  transaction_id INTEGER NOT NULL REFERENCES client_transactions(id) ON DELETE RESTRICT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Payment Allocations (Hybrid invoice matching)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES client_payments(id) ON DELETE CASCADE,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(14, 2) NOT NULL CHECK(allocated_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Sales table modifications
ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.0;
```

## Risks / Trade-offs

- **[Risk] Concurrent ledger writes for the same client causing out-of-order `running_balance`** → *Mitigation*: Enforce `SELECT current_balance FROM clients WHERE id = $1 FOR UPDATE` inside `runTransaction` before calculating new running balance and inserting into `client_transactions`.
- **[Risk] Sale cancellations leaving orphaned debts or double credits** → *Mitigation*: Sale cancellation inserts a compensating `CREDIT_NOTE` transaction on the ledger, decrements client debt, and sets `sales.payment_status = 'CANCELLED'`.
- **[Risk] Performance on Statement of Account over large date ranges** → *Mitigation*: Index `(client_id, transaction_date)`, `(client_id, warehouse_id)`, and `(reference_type, reference_id)`.
