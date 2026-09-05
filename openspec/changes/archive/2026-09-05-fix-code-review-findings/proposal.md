## Why

During a comprehensive cross-file code review, several critical reliability and reactivity issues were discovered:
1. Missing `try/catch` wrappers and initial async queries executed outside error handling blocks in `transfer.routes.ts` and `sale.routes.ts`, creating unhandled promise rejections that can hang client requests or crash Express handlers.
2. Synchronous CPU-bound `bcrypt.genSaltSync(10)` and `bcrypt.hashSync(...)` invocations within async route handlers in `user.routes.ts`, blocking Node's single-threaded event loop for ~70–100ms per call and stalling concurrent user requests.
3. Use of array index `:key="idx"` in dynamic Vue form lists (`CreateSaleView.vue`, `SalesListView.vue`, `TransferListView.vue`), causing DOM reuse bugs and state desynchronization when line items are added or removed.

Remediating these issues is essential for system stability, high-concurrency performance, and reliable frontend state synchronization.

## What Changes

- **Backend Error Boundaries**: Wrap all route handler logic in `transfer.routes.ts` (`POST /:id/decline`, `POST /:id/approve`, `POST /:id/confirm`, `POST /:id/cancel`, `POST /`, `POST /bulk-relocation`) and `sale.routes.ts` (`POST /`, `PUT /:id`, `POST /:id/cancel`) inside comprehensive `try/catch` blocks from the very top of each handler so every database lookup and audit write is safely trapped.
- **Asynchronous Password Hashing**: Convert synchronous `bcrypt.genSaltSync` and `bcrypt.hashSync` in `user.routes.ts` (`POST /` and `PUT /:id`) to non-blocking asynchronous `await bcrypt.genSalt(10)` and `await bcrypt.hash(...)`.
- **Unique Stable Keys in Vue Dynamic Forms**: Introduce stable client-generated UIDs (`_uid`) for form line items in `CreateSaleView.vue`, `SalesListView.vue`, and `TransferListView.vue`, binding `:key="item._uid"` instead of `:key="idx"`.

## Capabilities

### New Capabilities
- `code-review-remediation`: Establishes requirements for backend async route error containment, non-blocking asynchronous password hashing, and deterministic stable DOM keys in dynamic Vue form collections.

### Modified Capabilities
<!-- None: existing capability requirements remain intact while implementation correctness and reliability are hardened. -->

## Impact

- **Backend Routes**: `backend/src/routes/transfer.routes.ts`, `backend/src/routes/sale.routes.ts`, `backend/src/routes/user.routes.ts`.
- **Frontend Views**: `frontend/src/views/sales/CreateSaleView.vue`, `frontend/src/views/sales/SalesListView.vue`, `frontend/src/views/transfers/TransferListView.vue`.
- **Dependencies & APIs**: No new dependencies or breaking API payload contract changes. All changes improve resilience, non-blocking concurrency, and UI consistency.
