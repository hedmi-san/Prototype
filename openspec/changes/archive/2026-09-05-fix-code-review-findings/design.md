## Context

A cross-file code review identified three high-impact code smells across backend routes and frontend views:
1. Unhandled async exceptions in Express routes where `await query(...)` operations were either completely uncontained (as in `POST /api/transfers/:id/decline`) or placed outside the subsequent transaction `try/catch` block (as in `POST /api/sales/:id/cancel`, `POST /api/sales`, `PUT /api/sales/:id`, `POST /api/transfers`, `POST /api/transfers/bulk-relocation`, etc.).
2. Synchronous bcrypt calls (`genSaltSync` and `hashSync`) in `user.routes.ts` that block the single Node.js event loop thread during user creation and password changes.
3. Use of array index `:key="idx"` in dynamic form lines (`CreateSaleView.vue`, `SalesListView.vue`, `TransferListView.vue`), causing DOM element reuse glitches and component state desync when intermediate lines are deleted.

## Goals / Non-Goals

**Goals:**
- Eliminate unhandled promise rejections by enclosing all asynchronous operations in Express handlers within top-level `try/catch` blocks.
- Ensure all CPU-bound password hashing in `user.routes.ts` uses non-blocking asynchronous promises (`await bcrypt.genSalt()` and `await bcrypt.hash()`).
- Ensure dynamic form lines in Vue use deterministic, stable client-side IDs (`_uid`) for `:key` bindings.

**Non-Goals:**
- Complete rewrite of routes into domain services or repositories (the architecture remains direct SQL querying per existing repository convention).
- Changing public API request/response contracts or database schemas.

## Decisions

### Decision 1: Top-Level Try/Catch Enclosure
- **Approach**: Move the opening `try {` block to immediately follow route parameter extraction in `transfer.routes.ts` and `sale.routes.ts`.
- **Alternatives Considered**:
  - Relying on Express 5 async error handling or an `express-async-errors` wrapper: While viable, explicit `try/catch` matches the existing established patterns across the rest of the codebase (e.g. `warehouse.routes.ts`, `expense.routes.ts`, `client-payment.routes.ts`) and provides granular 404/403/400 validation error mappings.

### Decision 2: Asynchronous Bcrypt Integration
- **Approach**: Replace `bcrypt.genSaltSync(10)` and `bcrypt.hashSync(password, salt)` with `await bcrypt.genSalt(10)` and `await bcrypt.hash(password, salt)` in `backend/src/routes/user.routes.ts`.
- **Rationale**: Keeps password hashing off the event loop thread, aligning with `await bcrypt.compare()` already used in `backend/src/routes/auth.routes.ts`.

### Decision 3: Stable Client-Side Identifiers (`_uid`) for Dynamic Form Rows
- **Approach**: Attach an immutable `_uid` string to each form row object upon creation:
  ```typescript
  let uidCounter = 0;
  function createLineItem(initial = {}) {
    return {
      _uid: `item_${++uidCounter}_${Date.now()}`,
      productId: 0,
      quantity: 1,
      unitPrice: 0,
      ...initial,
    };
  }
  ```
  In views, bind `:key="item._uid"` instead of `:key="idx"`.
- **Rationale**: When rows are removed or filtered, Vue's virtual DOM reconciliation cleanly discards the deleted DOM node rather than shifting state across neighboring rows.

## Risks / Trade-offs

- **[Risk] Existing items loaded from API during edit lack `_uid`** → **Mitigation**: When initializing `editForm.items` from an existing sale or transfer, populate `_uid: `existing_${item.id || ++uidCounter}`.
- **[Risk] Nested try/catch confusion** → **Mitigation**: Keep inner `validateWarehouseScope` in separate try/catch if custom 403 mapping is desired, while outer try/catch guarantees standard 500 error propagation for any unhandled DB error.
