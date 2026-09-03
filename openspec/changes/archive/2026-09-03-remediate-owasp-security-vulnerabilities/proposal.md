## Why

A security audit identified multiple OWASP Top 10 vulnerabilities across the backend API, including broken object-level authorization (BOLA) that allows cross-warehouse data exposure, hardcoded JWT fallback keys, permissive CORS origin reflection, unescaped formula characters in CSV exports, lack of HTTP security headers, and missing brute-force protection. Resolving these vulnerabilities is urgent to ensure tenant isolation, data confidentiality, and system resilience in multi-warehouse operations.

## What Changes

- **Warehouse Tenant Isolation & BOLA Remediation**: Enforce strict warehouse scoping across all list endpoints (`/salaries`, `/client-payments`, `/expenses`, `/employees`, `/sales`, `/audit-logs`, `/inventory/movements`) and single-entity endpoints (`GET /sales/:id`, `PUT /sales/:id`, `POST /sales/:id/cancel`, `GET /client-payments/:id`, `GET /employees/:id/sales`, `GET /employees/:id/salaries`). Prevent users from bypassing scoping via arbitrary `?warehouseId=` query parameters.
- **Role-Based Access Control (RBAC)**: Enforce role restrictions on sensitive endpoints that previously lacked them, including `POST /sales/:id/cancel` (restricted to `ADMIN`, `SUPER_MANAGER`, `MANAGER`), `POST /client-payments` (restricted to authorized roles), and `GET /employees/:id/salaries` (restricted to `ADMIN`, `SUPER_MANAGER`, `MANAGER`, `ACCOUNTANT`).
- **Cryptographic & Secret Hardening**: Remove hardcoded JWT fallback keys from source code and require explicit, validated environment configurations on startup. Ensure secure TLS verification configuration for database connections.
- **CORS & Network Boundary Protection**: Replace permissive reflected origins (`origin: true`) with an explicit whitelist of allowed origins matching the frontend domain.
- **HTTP Defense-in-Depth**: Integrate `helmet` to set secure HTTP headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`).
- **CSV Formula Injection Mitigation**: Prepend leading formula operator characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with an apostrophe in CSV exports to neutralize spreadsheet formula execution.
- **Authentication Resilience & DoS Prevention**: Add IP-based rate limiting to `/api/auth/login` and migrate password verification from blocking `bcrypt.compareSync` to asynchronous `bcrypt.compare`.
- **Information Leakage Prevention**: Sanitize 500 error responses to hide internal database schema details and stack traces from API consumers in non-development environments.

## Capabilities

### New Capabilities
- `api-security-hardening`: Covers authentication guards, role-based access enforcement, multi-warehouse tenant scoping across all route handlers, strict CORS policies, security headers, login rate limiting, sanitized error handling, and CSV formula injection neutralization.

### Modified Capabilities
*(None. Existing business requirements for sales, ledger, inventory, and exports remain intact; security constraints and authorization boundaries are layered on top.)*

## Impact

- **Backend Route Handlers**: Updates in `backend/src/routes/*.ts` to add role checks and consistent warehouse scoping via `validateWarehouseScope`.
- **Middleware & Security**: Updates in `backend/src/middleware/auth.ts`, `backend/src/server.ts`, `backend/src/common/csv.ts`, and `backend/src/common/response.ts`.
- **Dependencies**: Adding `helmet` and `express-rate-limit` (plus TypeScript type definitions) to `backend/package.json`.
- **APIs**: Unauthenticated or unauthorized requests previously accepted will now properly return `401 Unauthorized` or `403 Forbidden`.
- **Environment**: Stricter requirement on `JWT_SECRET` and `CORS_ALLOWED_ORIGINS` in `.env`.
