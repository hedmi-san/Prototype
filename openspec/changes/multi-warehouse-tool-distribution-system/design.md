## Context

The business is a national tool brand distributor in Algeria operating multiple regional warehouses. The system provides a centralized platform for multi-warehouse inventory control, point-of-distribution sales, inter-warehouse transfers, local HR and salaries, operating expenses, financial reporting, and audit traceability.

Primary stakeholders:
- **Admin**: Executive oversight, global dashboard, multi-warehouse comparison, audit logs, system configuration.
- **Manager**: Operational control over an assigned warehouse, inventory adjustments, transfer requests/approvals, HR/salaries, expenses.
- **Super Manager**: Manager capabilities with cross-warehouse read-only inventory visibility.
- **Accountant**: Sales creation/editing, invoice printing, stock adjustments, purchase and sale price management for their warehouse.

## Goals / Non-Goals

**Goals:**
- Guarantee inventory consistency across concurrent transactions with zero possibility of negative stock.
- Enforce strict server-side authorization and multi-tenant warehouse data isolation.
- Support complete sales lifecycle including live stock validation, unit price snapshotting, delta-based quantity edits, and non-destructive cancellation.
- Support multi-step transfer workflow with partial approvals, stock reservations, and destination reception confirmation.
- Provide real-time reporting for stock valuation (at current purchase prices), sales, expenses, and net profit.
- Record comprehensive audit logs for all critical business state changes.
- Implement an ultra-clean, high-density monochromatic design system (deep charcoal `#171717`, light gray `#f3f3f3`, pure white `#ffffff`) with skeleton loading and fluid typography.

**Non-Goals:**
- External ERP/Accounting integrations or third-party payment gateways for MVP.
- Complex multi-currency handling (single currency: Algerian Dinar, DZD).
- Supplier purchase order lifecycle (goods receipt handled via `INITIAL_STOCK` movements).
- In-transit logistics tracking or multi-company SaaS tenancy in the initial phase.

## Decisions

### 1. Technology Stack Selection
- **Backend**: Spring Boot 3 (Java 21), Spring Data JPA / Hibernate, Spring Security, Flyway.
  - *Rationale*: Spring Boot provides robust transactional management (`@Transactional`), mature security filters for JWT, declarative validation, and production-grade monitoring via Actuator.
  - *Alternative Considered*: Node.js/Express. Rejected due to manual transaction management complexity for multi-step inventory workflows.
- **Frontend**: Vue 3 + TypeScript (Composition API, `<script setup>`), Vite, Pinia, Vue Router, Vanilla CSS / CSS Variables.
  - *Rationale*: Lightweight, performant, strong TypeScript ergonomics, clear reactive state management for complex forms (sale items, transfer grids).
- **Database**: PostgreSQL 16.
  - *Rationale*: ACID compliance, robust row-level locking (`SELECT FOR UPDATE`), expressive check constraints (`CHECK (physical_quantity >= 0)`), and JSONB support for audit log payloads.

### 2. Concurrency & Inventory Invariant Architecture
- **Stock State Representation**:
  ```sql
  CREATE TABLE stock (
      id BIGSERIAL PRIMARY KEY,
      warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
      product_id BIGINT NOT NULL REFERENCES products(id),
      physical_quantity INT NOT NULL DEFAULT 0,
      reserved_quantity INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_warehouse_product UNIQUE (warehouse_id, product_id),
      CONSTRAINT chk_physical_positive CHECK (physical_quantity >= 0),
      CONSTRAINT chk_reserved_positive CHECK (reserved_quantity >= 0),
      CONSTRAINT chk_available_positive CHECK (physical_quantity >= reserved_quantity)
  );
  ```
- **Pessimistic Row-Level Locking (`SELECT FOR UPDATE`)**:
  - *Rationale*: Stock is a heavily contested, finite resource. When processing a sale, edit, transfer approval, or adjustment, the repository executes `SELECT * FROM stock WHERE warehouse_id = :wId AND product_id = :pId FOR UPDATE`. This guarantees serialized mutations without optimistic retry storm overhead.
  - *Alternative Considered*: Optimistic locking via `@Version`. Rejected because high concurrency on fast-moving tool SKUs would generate excessive retry exceptions and degrade user experience.

### 3. Transfer Lifecycle & Stock Reservation
- **Lifecycle States**: `REQUESTED` $\rightarrow$ `APPROVED` $\rightarrow$ `CONFIRMED` (terminal), with branching to `DECLINED` or `CANCELLED`.
- **Reservation Mechanics**:
  - On approval of $Q$ units: Source warehouse `reserved_quantity` is incremented by $Q$. `physical_quantity` remains untouched.
  - Available stock ($Physical - Reserved$) prevents sales from consuming reserved stock.
  - On confirmation: Source warehouse `physical_quantity` and `reserved_quantity` both decrement by $Q$ (`TRANSFER_OUT`), destination warehouse `physical_quantity` increments by $Q$ (`TRANSFER_IN`).
  - On cancellation/decline: Source warehouse `reserved_quantity` decrements by $Q$, releasing units back to available stock.
  - *Cancellation Boundary*: Destination warehouse can cancel anytime prior to confirmation.

### 4. Sale Reconciliation & Voiding
- **Unit Price Snapshot**: `sale_items.unit_price` stores the price active at the time of sale. Future catalog price edits do not alter historical invoice records.
- **Delta Reconciliation on Edit**:
  - $\Delta = Q_{new} - Q_{old}$
  - If $\Delta > 0$: Validate $Available \ge \Delta$, lock row, deduct $\Delta$ from `physical_quantity`.
  - If $\Delta < 0$: Increment `physical_quantity` by $|\Delta|$.
- **Sale Cancellation / Voiding**:
  - Sale status is set to `CANCELLED`.
  - Compensating `ADJUSTMENT` / `SALE_REVERSAL` movements restore `physical_quantity`.
  - Invoices are never hard-deleted; audit history and numbering sequences remain intact.

### 5. Pricing Permissions & Stock Valuation
- **Permissions**: Both Managers and Accountants have read and write access to `purchase_price` and `sale_price` in the product catalog.
- **Valuation Formula**:
  $$\text{Inventory Value} = \sum (\text{physical\_quantity} \times \text{current product purchase\_price})$$

### 6. Frontend Monochromatic Design System

```css
:root {
  /* Colors */
  --color-primary: #171717;
  --color-bg: #ffffff;
  --color-surface: #f3f3f3;
  --color-surface-blur: rgba(243, 243, 243, 0.85);
  --color-text-primary: rgba(23, 23, 23, 0.95);
  --color-text-secondary: rgba(124, 124, 124, 0.60);
  --color-text-tertiary: rgba(199, 199, 199, 0.30);
  --color-border: #ededed;
  
  /* System Alerts */
  --color-success: #278f5e;
  --color-success-bg: #e4f5e9;
  --color-danger: #cc2929;
  --color-danger-bg: #fff7f7;
  --color-warning: #ab6e05;
  --color-warning-bg: #fffcef;
  --color-info: #0070cc;
  --color-info-bg: #f7fbfd;

  /* Typography */
  --font-sans: 'InterVariable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
  
  /* Layout & Metrics */
  --spacing-base: 8px;
  --container-max-width: 1440px;
  --padding-grid: 10px 8px;
  --padding-card: 20px;

  /* Border Radii */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Elevation Shadows */
  --shadow-sm: 0px 1px 2px rgba(0, 0, 0, 0.1);
  --shadow-md: 0px 0px 1px rgba(0,0,0,0.12), 0px 0.5px 2px rgba(0,0,0,0.15), 0px 2px 3px rgba(0,0,0,0.16);
  --shadow-lg: 0px 0px 1px rgba(0,0,0,0.35), 0px 6px 8px -4px rgba(0,0,0,0.1);
  --shadow-xl: 0px 0px 1px rgba(0,0,0,0.19), 0px 1px 2px rgba(0,0,0,0.07), 0px 6px 15px -5px rgba(0,0,0,0.11);
}
```

- **Typography Scale**:
  - Headlines: `clamp(32px, 6vw, 56px)`, weight 600, tracking `-0.03em`, line-height `1.1`
  - Subheadings: `20px`, weight 500, tracking `-0.01em`
  - Body: `14px` - `16px`, weight 400, line-height `1.6`, max-width `70ch`
  - Labels/Tags: `12px` - `13px`, weight 500, uppercase, tracking `0.05em`
  - Monospace Data: `12px` for SKUs, invoice numbers, timestamps, and audit codes
- **Skeleton Screens**: All data tables, dashboard widgets, and metric cards implement pulse skeleton loading placeholders (`background: linear-gradient(...)`) to ensure zero layout shift during asynchronous data fetches.
- **Accessibility & Micro-interactions**: Visible outline focus rings (`:focus-visible`), transform-only hover/active transitions (`transform: translateY(-1px)`), and ARIA compliant roles.

## Risks / Trade-offs

- **[Risk] Database Row Contention during high-volume sales bursts** $\rightarrow$ *Mitigation*: Keep Spring transactions short and minimal; perform validation and DTO transformations outside the transaction block before acquiring row locks.
- **[Risk] Long-running unconfirmed transfers locking source stock indefinitely** $\rightarrow$ *Mitigation*: Provide explicit status dashboards and allow Managers/Admins to cancel stale transfer requests to release reservations.
- **[Risk] Client-side ID tampering across warehouses (IDOR)** $\rightarrow$ *Mitigation*: Enforce warehouse ownership checks in Spring Security service layer using authenticated JWT claims; reject requests where user warehouse does not match target entity warehouse.

## Migration Plan

1. Create PostgreSQL database and configure connection parameters.
2. Apply Flyway migrations sequentially (`V1` through `V10`).
3. Seed default roles (`ADMIN`, `MANAGER`, `SUPER_MANAGER`, `ACCOUNTANT`) and default admin user account.
4. Deploy Spring Boot backend service inside Docker container.
5. Build and serve Vue 3 frontend assets via Nginx reverse proxy.
6. Verify health endpoint `/actuator/health` and run integration test suite.
