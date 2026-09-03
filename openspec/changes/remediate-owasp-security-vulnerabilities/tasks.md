## 1. Dependencies and Infrastructure Hardening

- [x] 1.1 Install `helmet`, `express-rate-limit`, and relevant type definitions in `backend/package.json`
- [x] 1.2 Configure `helmet` security headers and proxy trust in `backend/src/server.ts`
- [x] 1.3 Replace permissive CORS (`origin: true`) with strict origin allowlist validation in `backend/src/server.ts`
- [x] 1.4 Sanitize unhandled 500 error responses in `backend/src/server.ts` to prevent internal info leakage

## 2. Authentication and Secret Hardening

- [x] 2.1 Remove hardcoded fallback JWT secret and add startup validation assertion in `backend/src/middleware/auth.ts` and `backend/src/server.ts`
- [x] 2.2 Implement IP rate limiting on `/api/auth/login` and `/auth/login`
- [x] 2.3 Convert `bcrypt.compareSync` to asynchronous `await bcrypt.compare` in `backend/src/routes/auth.routes.ts`

## 3. Warehouse Scoping & Access Control Helper

- [x] 3.1 Implement `enforceWarehouseScope` helper in `backend/src/middleware/auth.ts` to validate and resolve warehouse scope for list queries
- [x] 3.2 Update list routes in `salary.routes.ts`, `expense.routes.ts`, and `employee.routes.ts` to use warehouse scoping helper
- [x] 3.3 Update list routes in `client-payment.routes.ts`, `sale.routes.ts`, `audit.routes.ts`, and `inventory.routes.ts` (`/movements`) to use warehouse scoping helper

## 4. Single-Entity IDOR & Role Authorization Remediation

- [x] 4.1 Enforce `validateWarehouseScope` on single-sale lookup (`GET /sales/:id`) and sale update (`PUT /sales/:id`) in `backend/src/routes/sale.routes.ts`
- [x] 4.2 Enforce role permissions (`ADMIN`, `SUPER_MANAGER`, `MANAGER`) and warehouse scope on `POST /sales/:id/cancel` in `backend/src/routes/sale.routes.ts`
- [x] 4.3 Enforce role permissions and warehouse scope on `POST /client-payments` and `GET /client-payments/:id` in `backend/src/routes/client-payment.routes.ts`
- [x] 4.4 Enforce warehouse scope on `GET /employees/:id/sales` and restrict `GET /employees/:id/salaries` to authorized roles in `backend/src/routes/employee.routes.ts`

## 5. CSV Injection Mitigation & Verification

- [x] 5.1 Implement formula prefix neutralization in `backend/src/common/csv.ts`
- [x] 5.2 Build backend TypeScript code (`npm run build`) to verify compilation
- [x] 5.3 Validate API responses, role checks, and tenant isolation against unauthorized access
