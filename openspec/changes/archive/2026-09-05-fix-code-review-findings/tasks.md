## 1. Backend Route Error Boundary Protection

- [x] 1.1 Wrap `POST /:id/decline` handler in `backend/src/routes/transfer.routes.ts` with top-level `try / catch` error handling.
- [x] 1.2 Move preliminary `await query(...)` lookup operations inside top-level `try / catch` blocks in `backend/src/routes/transfer.routes.ts` for `POST /`, `POST /bulk-relocation`, `POST /:id/approve`, `POST /:id/confirm`, and `POST /:id/cancel`.
- [x] 1.3 Move preliminary `await query(...)` lookup operations inside top-level `try / catch` blocks in `backend/src/routes/sale.routes.ts` for `POST /`, `PUT /:id`, and `POST /:id/cancel`.

## 2. Asynchronous Password Hashing in User Routes

- [x] 2.1 Replace synchronous `bcrypt.genSaltSync` and `bcrypt.hashSync` with `await bcrypt.genSalt(10)` and `await bcrypt.hash(password, salt)` in `POST /api/users` in `backend/src/routes/user.routes.ts`.
- [x] 2.2 Replace synchronous `bcrypt.genSaltSync` and `bcrypt.hashSync` with `await bcrypt.genSalt(10)` and `await bcrypt.hash(password.trim(), salt)` in `PUT /api/users/:id` in `backend/src/routes/user.routes.ts`.

## 3. Frontend Dynamic Form Stable Keys

- [x] 3.1 Assign stable `_uid` identifiers to line items in `frontend/src/views/sales/CreateSaleView.vue` and bind `:key="item._uid"`.
- [x] 3.2 Assign stable `_uid` identifiers to line items in `frontend/src/views/sales/SalesListView.vue` edit modal and bind `:key="item._uid"`.
- [x] 3.3 Assign stable `_uid` identifiers to items in `frontend/src/views/transfers/TransferListView.vue` create form and bind `:key="item._uid"`.

## 4. Verification and Build Integrity

- [x] 4.1 Run backend TypeScript compilation to confirm zero type or syntax errors.
- [x] 4.2 Run frontend build to verify Vue template compilation and type checking.
