## Context

Users require full timestamp visibility (`hour:minute:second`) on sales records and invoices. In the current setup, `formatDateTime` omits seconds, and `<input type="datetime-local">` controls lack the `step="1"` attribute needed to capture seconds. Additionally, backend date normalization should guarantee that all persisted timestamps match the standard SQLite `YYYY-MM-DD HH:mm:ss` structure.

## Goals / Non-Goals

**Goals:**
- Update `formatDateTime` in `frontend/src/utils/formatters.ts` to render `DD/MM/YYYY HH:mm:ss` with seconds.
- Update `CreateSaleView.vue` and `SalesListView.vue` to initialize and display datetime inputs with seconds precision (`step="1"` and `YYYY-MM-DDTHH:mm:ss`).
- Implement robust date-time normalization in `backend/src/routes/sale.routes.ts` so all date strings are stored in `YYYY-MM-DD HH:mm:ss` format.

**Non-Goals:**
- Changing database column types (SQLite stores TEXT timestamps natively).

## Decisions

### 1. Formatter Seconds Support
- **Choice**: In `formatDateTime(dateInput: string | Date | null | undefined, includeSeconds: boolean = true)`, include `second: '2-digit'` by default.
- **Rationale**: Ensures every table row, receipt preview, and detail view immediately presents the exact transaction second without needing ad-hoc formatting across individual components.

### 2. Vue Input Controls (`step="1"`)
- **Choice**: Add `step="1"` attribute to all `type="datetime-local"` elements in `CreateSaleView.vue` and `SalesListView.vue`. Initialize `saleDate` ref with `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`.
- **Rationale**: HTML5 standard `<input type="datetime-local" step="1">` enables second-level selection in native browser pickers.

### 3. Backend Timestamp Normalization
- **Choice**: Implement `normalizeSaleDate(input?: string): string | null` in `sale.routes.ts`:
  - If input contains `T`, replace with space.
  - If input matches `YYYY-MM-DD HH:mm`, append `:00`.
  - Slice to 19 characters (`YYYY-MM-DD HH:mm:ss`).
- **Rationale**: Prevents truncated minutes-only strings when clients submit without seconds, ensuring consistent SQLite timestamp sorting and queries.

## Risks / Trade-offs

- **[Risk] Existing records formatted without seconds**:
  → *Mitigation*: Existing records stored as `YYYY-MM-DD HH:mm:ss` or `datetime('now')` already have seconds in SQLite; `formatDateTime` will parse and display them cleanly.
