## Context

A security assessment against the OWASP Top 10 (2021) revealed vulnerabilities in the multi-warehouse distribution management system:
1. List queries check `if (warehouseId) { ... } else if (req.user?.role === 'MANAGER')` which allows any manager or accountant to supply an arbitrary warehouse ID and bypass scoping.
2. Single-record endpoints (`/sales/:id`, `/client-payments/:id`, `/employees/:id/sales`, `/employees/:id/salaries`) and mutation endpoints (`PUT /sales/:id`, `POST /sales/:id/cancel`) lack warehouse ownership checks or role restrictions.
3. JWT secret has a hardcoded static fallback string.
4. CORS reflects any origin with credentials enabled.
5. CSV export does not sanitize formula injection prefixes.
6. Server error handlers expose raw database error messages, and the login endpoint lacks rate limiting while executing synchronous bcrypt operations.

## Goals / Non-Goals

**Goals:**
- Enforce deterministic warehouse scoping and role access across all backend routes.
- Prevent privilege escalation and cross-warehouse data exfiltration (BOLA/IDOR).
- Harden application networking with strict CORS and security headers (`helmet`).
- Neutralize CSV formula injection vulnerabilities.
- Protect `/api/auth/login` from brute-force and DoS via rate limiting and async password verification.
- Prevent server runtime secret misconfiguration via fail-fast boot checks.

**Non-Goals:**
- Redesigning database schema or role tables (roles remain `ADMIN`, `SUPER_MANAGER`, `MANAGER`, `ACCOUNTANT`).
- Changing frontend UI components (the API contracts remain backward-compatible for legitimate requests).

## Decisions

### Decision 1: Canonical Warehouse Scope Helper & Scoping Pattern
- **Choice**: Enhance `validateWarehouseScope` and implement a helper `enforceWarehouseScope(req: AuthRequest, requestedWarehouseId?: number): number | undefined` in `backend/src/middleware/auth.ts`.
- **Behavior**:
  - `ADMIN` or global `SUPER_MANAGER`: Returns `requestedWarehouseId` (or `undefined` to query all warehouses).
  - Scoped `MANAGER` or `ACCOUNTANT`: If `requestedWarehouseId` is provided and does not match `req.user.warehouseId`, throws a `403 Forbidden` error. If omitted, returns `req.user.warehouseId`.
  - For single entity lookups by ID (e.g. `GET /sales/:id`, `PUT /sales/:id`), immediately call `validateWarehouseScope(req.user, entity.warehouse_id)`.
- **Alternative Considered**: Database Row-Level Security (RLS). While powerful, RLS requires session variable management per connection in connection pools and would require extensive database schema migrations. A centralized application guard is robust, testable, and immediately applicable.

### Decision 2: CORS Origin Allowlist
- **Choice**: Configure `cors` with an array of allowed origins populated from `process.env.CORS_ALLOWED_ORIGINS` (defaulting to `http://localhost:5173,http://localhost:3000`).
- **Alternative Considered**: Static single origin string. Multiple environments (local Vite, Docker, staging) require comma-separated origin flexibility.

### Decision 3: Fail-Fast Secret Boot Assertion
- **Choice**: During startup in `server.ts` and `auth.ts`, assert that `JWT_SECRET` is present and does not equal any known insecure prototype placeholder. Terminate with `process.exit(1)` if validation fails.
- **Alternative Considered**: Generating a random ephemeral secret if missing. Rejected because server restarts would invalidate all active client sessions and tokens across workers.

### Decision 4: Rate Limiting & Async Password Verification
- **Choice**: Introduce `express-rate-limit` specifically on `/api/auth/login` configured for 10 attempts per 15-minute window per IP. Replace `bcrypt.compareSync` with `await bcrypt.compare`.
- **Alternative Considered**: Custom Redis-backed sliding window. For the current single-instance prototype/deployment, memory-based `express-rate-limit` adds minimal overhead with zero external infrastructure dependencies.

### Decision 5: CSV Formula Neutralization
- **Choice**: In `formatCsvValue` (`backend/src/common/csv.ts`), detect if a string starts with `=,+,-,@,\t,\r` and prepend a single quote `'` before standard RFC 4180 escaping.
- **Alternative Considered**: Stripping formula characters. Rejected because legitimate product references or notes might start with `-` or `+`, so prefixing with `'` safely preserves the visual text in Excel without code execution.

### Decision 6: HTTP Security Headers via Helmet
- **Choice**: Register `helmet()` in `server.ts` with standard protections (nosniff, frameguard, etc.).

## Risks / Trade-offs

- **[Risk]** Existing legitimate API consumers passing `?warehouseId=` might receive 403 if passing mismatched values.
  → **Mitigation**: Ensure frontend state always passes the user's assigned warehouse ID or omits it when appropriate.
- **[Risk]** Missing `JWT_SECRET` in local dev environments could halt boot.
  → **Mitigation**: Ensure `.env.example` and default `.env` files contain explicit valid development secrets with clear instructions.
- **[Risk]** Rate limiting behind reverse proxies could block shared IPs.
  → **Mitigation**: Configure `app.set('trust proxy', 1)` so `express-rate-limit` evaluates the true client IP from `X-Forwarded-For`.
