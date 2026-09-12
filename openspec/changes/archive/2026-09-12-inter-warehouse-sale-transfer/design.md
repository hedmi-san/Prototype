## Context

In our multi-warehouse distribution prototype, sales are currently assumed to be fulfilled entirely from a single warehouse where both the cashier and physical stock reside. When a client requests items exceeding local stock, the system rejects the sale. In reality, distributor clients often visit a primary branch (Warehouse A) and either pick up the balance of stock at a nearby branch (Warehouse B) or pay upfront at Warehouse A and present a pickup voucher at Warehouse B.

This document details the architectural design for supporting cross-warehouse sales fulfillment, granular stock reservations, dual-track revenue and payment accounting, and inter-branch settlement reconciliation.

## Goals / Non-Goals

**Goals:**
- Enable sales with split fulfillment across local and one or more remote warehouses in a single checkout workflow.
- Allow flexible payment collection: prepaid at origin, collected on pickup at destination, or debited to client credit account.
- Prevent destination overselling via atomic row-locked stock reservations (`stock_reservations`) with TTL expiration.
- Provide dual-tracking reporting (Revenue by Origin vs Revenue by Fulfillment) and an automated inter-warehouse treasury clearing ledger (`inter_warehouse_settlements`).
- Provide printable Bon de Retrait (Pickup Slips) with unequivocal payment status indicators.

**Non-Goals:**
- Implementing physical inter-warehouse delivery trucks or shipment tracking (this is for customer pickup or internal dispatch).
- Complex multi-currency clearing (all settlements operate in the standard currency DZD).
- Real-time WebSocket push notifications for v1 (in-app polling badges and dashboard widgets are used).

## Decisions

### Decision 1: Dedicated `sale_fulfillment_lines` as Child Records of `sales`
- **Choice**: Decompose the parent sale into one or more fulfillment lines (`sale_fulfillment_lines`).
- **Rationale**: A sale may have multiple line items, some fulfilled locally and others distributed across Warehouse B and Warehouse C. Tracking fulfillment status, payment location, and pickup vouchers at the line level provides clean granularity without polluting the parent invoice record.
- **Alternatives Considered**: Creating multiple independent `sales` records was rejected because it fragments client invoicing, complicates total payment calculation, and confuses client account ledgers.

### Decision 2: Individual `stock_reservations` Table with Derivation & Row-Locking
- **Choice**: Maintain discrete reservation records (`stock_reservations`) linked to fulfillment lines, and keep `stock.reserved_quantity` synchronized atomically inside transactions using `SELECT FOR UPDATE`.
- **Rationale**: An un-audited counter on `stock` cannot explain why stock is reserved, when it expires, or which customer it belongs to. Dedicated records enable TTL expirations, cancellation audits, and easy verification.
- **Alternatives Considered**: Mutating physical stock immediately on transfer was rejected because if the client fails to pick up the items, physical stock would be artificially distorted and requires complex stock reversals.

### Decision 3: Dual-Tracking Accounting & Inter-Warehouse Settlement Ledger
- **Choice**: Every fulfillment line records:
  - `origin_warehouse_id`: selling branch
  - `fulfillment_warehouse_id`: dispensing branch
  - `payment_warehouse_id`: cash collecting branch
  When `payment_warehouse_id != fulfillment_warehouse_id`, an inter-branch balance is tracked in `inter_warehouse_settlements`.
- **Rationale**: Completely avoids disputes between branch managers regarding cash register discrepancies and stock loss.
- **Alternatives Considered**: Forcing payment to only occur at the fulfilling warehouse was rejected because clients frequently demand to pay in full at the counter where they placed the order.

### Decision 4: Reservation Expiration via Hybrid Passive-Sweep and Active Cron
- **Choice**: Default 120-hour TTL. A database helper sweeps and expires overdue active reservations whenever stock or pending pickups are queried, complemented by a periodic background cleanup task.

### Decision 5: Line-Level Immutability and State-Branched Deletion/Editing
- **Choice**: 
  - Prohibit hard deletion on any sale with inter-warehouse fulfillment lines.
  - Deletion branches strictly by line state (Full cancellation if all lines pending, Partial cancellation with parent `PARTIALLY_CANCELLED` if some lines fulfilled, Return/Refund flow if all fulfilled).
  - Fulfilled lines are permanently immutable; any quantity additions must be created as new fulfillment lines.
  - Edits to pending lines operate as an atomic cancel-and-recreate (release old reservation, lock stock, create new reservation).
  - Reassigning destination warehouses atomically migrates the reservation between warehouses using row locks (`SELECT FOR UPDATE`).
- **Rationale**: An inter-warehouse sale coordinates stock and money across multiple autonomous branches. Deleting rows or silently mutating completed lines destroys the audit trail, causes inventory discrepancies, and breaks inter-branch cash reconciliation.
- **Alternatives Considered**: Cascading hard deletes or in-place line quantity mutations were rejected because physical stock already dispensed at another warehouse cannot be undone by deleting a database row.

## Data Model & Schema Changes

```sql
-- 1. Alter sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS origin_warehouse_id INTEGER REFERENCES warehouses(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS has_inter_warehouse_fulfillment BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create sale_fulfillment_lines table
CREATE TABLE IF NOT EXISTS sale_fulfillment_lines (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  origin_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  fulfillment_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  payment_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  fulfillment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_PICKUP', -- 'FULFILLED', 'PENDING_PICKUP', 'CANCELLED', 'EXPIRED'
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID', -- 'PAID', 'COLLECT_ON_PICKUP'
  pickup_voucher_code VARCHAR(50) NOT NULL UNIQUE,
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create stock_reservations table
CREATE TABLE IF NOT EXISTS stock_reservations (
  id SERIAL PRIMARY KEY,
  fulfillment_line_id INTEGER NOT NULL REFERENCES sale_fulfillment_lines(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reserved_quantity INTEGER NOT NULL CHECK(reserved_quantity > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED'
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create inter_warehouse_settlements table
CREATE TABLE IF NOT EXISTS inter_warehouse_settlements (
  id SERIAL PRIMARY KEY,
  settlement_number VARCHAR(50) NOT NULL UNIQUE,
  debtor_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  creditor_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  amount NUMERIC(14, 2) NOT NULL CHECK(amount > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SETTLED'
  settlement_date TIMESTAMPTZ,
  settled_by_user_id INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Deletion and Editing Lifecycle

### 1. Deletion Lifecycle
Hard deletes (`DELETE FROM sales`) are strictly disallowed for any sale containing inter-warehouse fulfillment lines. Instead, deletion requests branch based on fulfillment line states:

```
                                  [Delete/Cancel Request]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             Are any lines fulfilled?                     Are ALL lines fulfilled?
                       │                                           │
         ┌─────────────┴─────────────┐                             ▼
         ▼                           ▼                 [Routing to Return Flow]
   [NO: All Pending]       [YES: Mixed State]         Not a cancellation; must use
         │                           │                existing stock return/refund.
         ▼                           ▼
[Full Cancellation]         [Partial Cancellation]
• Release all reservations  • Cancel ONLY pending lines
• Void/refund payments      • Release pending reservations
• Set lines CANCELLED       • Keep fulfilled lines permanent
• Set sale CANCELLED        • Set sale PARTIALLY_CANCELLED
                            • Adjust parent totals & ledger
```

### 2. Editing Lifecycle
Editing behavior branches based on what is being modified and the current fulfillment state:

1. **Editing Quantity / Products before fulfillment:**
   - Handled as an atomic **cancel-and-recreate** within a single database transaction.
   - Releases the old reservation(s) (`reserved_quantity` decremented), re-validates stock using `SELECT FOR UPDATE`, establishes new reservation(s), and regenerates the pickup voucher.
2. **Editing Quantity / Products after a line is fulfilled:**
   - Fulfilled lines are **immutable**; they cannot be shrunk or silently increased.
   - Any quantity increase creates an independent **new fulfillment line** with its own reservation and pickup slip.
3. **Editing Payment Mode / Location on Pending Line:**
   - If no cash has moved yet (`COLLECT_ON_PICKUP`), reassigning `payment_warehouse_id` is a safe metadata update.
   - If payment was already collected at Origin (`PAID`), changing to `COLLECT_ON_PICKUP` requires an explicit refund or client account credit entry, never a silent field update.
4. **Reassigning Destination Warehouse on Pending Line:**
   - Atomically releases the reservation at Warehouse B (`stock.reserved_quantity -= qty`).
   - Acquires a row lock at Warehouse C (`SELECT FOR UPDATE`), verifies stock availability, and reserves quantity at Warehouse C (`stock.reserved_quantity += qty`).
   - Updates `fulfillment_warehouse_id` on the fulfillment line and issues an updated pickup slip.

## API Specifications

1. `POST /api/sales`:
   - Accepts optional `fulfillmentAllocations`: array of `{ productId, originWarehouseId, fulfillmentWarehouseId, paymentWarehouseId, quantity, paymentStatus, ttlHours }`.
   - Executes atomic transaction: validates local and remote stock with `SELECT FOR UPDATE`, creates `sales` and `sale_items`, creates `sale_fulfillment_lines`, updates `stock.reserved_quantity` and inserts `stock_reservations` for remote lines.
2. `GET /api/sales/fulfillment-lines/pending`:
   - Lists pending pickup lines for the user's warehouse (`fulfillment_warehouse_id = warehouseId` and `fulfillment_status = 'PENDING_PICKUP'`).
   - Includes badge count endpoint for navigation & dashboard.
3. `POST /api/sales/fulfillment-lines/:id/fulfill`:
   - Fulfills the line: verifies stock, decrements `stock.physical_quantity`, decrements `stock.reserved_quantity`, marks reservation as `FULFILLED`, logs stock movement, and if `payment_status = 'COLLECT_ON_PICKUP'`, logs payment into destination cash register and updates parent sale `paid_amount`.
4. `POST /api/sales/fulfillment-lines/:id/cancel`:
   - Cancels a single pending fulfillment line and releases its stock reservation.
5. `PUT /api/sales/fulfillment-lines/:id`:
   - Updates pending line: supports quantity change, warehouse reassignment (with atomic release and reserve), or payment mode change.
6. `POST /api/sales/:id/cancel`:
   - Rejects hard delete. Evaluates child lines: executes full cancellation if all lines are pending, or partial cancellation (setting sale status to `PARTIALLY_CANCELLED`) if some lines are already fulfilled.
7. `GET /api/transfers/settlements/balances`:
   - Computes net balances between all warehouse pairs where payment location differs from fulfillment location.
8. `POST /api/transfers/settlements/clear`:
   - Records cash/bank clearing between branches.

## Risks / Trade-offs

- **[Risk] Customer forgets to pick up order before TTL expires**:
  - *Mitigation*: Reservations auto-expire after TTL (default 120h), restoring inventory for other buyers. If customer paid upfront at Origin, their payment remains recorded on their client account or can be refunded/extended via a single click.
- **[Risk] Multiple cashiers competing for low stock across warehouses during edit/reassign**:
  - *Mitigation*: PostgreSQL row-level locks (`SELECT FOR UPDATE`) on the destination stock row guarantee strictly serialized atomic reservation checks during both creation and edits.
- **[Risk] Fraud, double pickup, or ghost cancellations**:
  - *Mitigation*: Once a line is `FULFILLED`, it is immutable. Hard deletion is blocked at the database and API layer. Every pickup slip has a unique voucher code (`VOUCH-XXXXX`).
