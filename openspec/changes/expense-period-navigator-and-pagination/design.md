## Context

Currently, the Expense Management interface (`ExpenseListView.vue`) queries all operational expense records via `GET /api/expenses` with only warehouse scoping. As the dataset expands over time, retrieving all historical records creates unnecessary backend load, excessive network payload sizes, and sluggish client performance. Furthermore, users cannot isolate specific business periods (e.g. current month, last quarter, fiscal year) without scrolling through everything or relying on client-side text filtering.

Other core modules in the application (such as Sales, Transfers, Salaries, Stock Movements, and Financial Reports) already leverage standard shared components:
- `AppPeriodNavigator`: Granular date range navigation (Day, Week, Month, Quarter, Year, Custom).
- `AppPagination`: Configurable page sizes and pagination controls.
- Server-side parameterization: SQL-level date range filtering, search terms, category filters, and aggregated summary calculations.

This design aligns Expense Management with these established system patterns.

## Goals / Non-Goals

**Goals:**
- Add server-side query filtering to `GET /api/expenses`: `startDate`, `endDate`, `category`, `search`, `page`, and `limit`.
- Provide total count and aggregate summary amount (`summary.totalAmount`) for the filtered subset in the backend response.
- Update `admin-reports.service.ts` to support paginated expense querying while remaining backward-compatible.
- Integrate `AppPeriodNavigator` into `ExpenseListView.vue`, defaulting to the current month.
- Integrate `AppPagination` into `ExpenseListView.vue` with page size switching and responsive page links.
- Implement debounced server-side search (300ms) and reactive filter updates.
- Display the aggregate total expense amount calculated across the entire period filter, rather than only the current visible page.

**Non-Goals:**
- Modifying the database schema for the `expenses` table (existing columns `id`, `warehouse_id`, `category`, `amount`, `description`, `expense_date`, `created_at` are sufficient).
- Changing expense creation, update, or deletion business logic, permissions, or audit logging.

## Decisions

### 1. API Contract & Response Shape
We will adopt the unified pagination pattern used across the backend (matching `salary.routes.ts` and `sale.routes.ts`):
```json
{
  "success": true,
  "data": {
    "items": [ /* Expense objects */ ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 42,
      "totalPages": 2
    },
    "summary": {
      "totalAmount": 185400.00
    }
  }
}
```
*Rationale*: Returning `summary.totalAmount` from the count/aggregation query allows the UI to display the exact total expenditure for the selected period and warehouse without requiring the client to fetch all rows across all pages.
*Alternative considered*: Fetching all records for the period and paginating in client memory. *Rejected* because high-volume warehouses would still experience high latency and payload sizes.

### 2. Dual-Query Server Implementation (Count + Slice)
In `backend/src/routes/expense.routes.ts`:
- Build a single `baseFromWhere` string with dynamic parameter placeholders for `warehouse_id`, date range (`expense_date::date >= $start::date AND expense_date::date <= $end::date`), `category`, and `search` (`description ILIKE $q OR w.name ILIKE $q`).
- Execute a summary query:
  `SELECT COUNT(*) as count, COALESCE(SUM(e.amount), 0) as total_amount ${baseFromWhere}`
- Execute the paginated row query:
  `SELECT e.id, ... ${baseFromWhere} ORDER BY e.expense_date DESC, e.id DESC LIMIT $limit OFFSET $offset`
*Rationale*: Standard PostgreSQL pattern; fast execution on indexed date and foreign keys.

### 3. Frontend Period Navigator and Smart Loading
- In `ExpenseListView.vue`:
  - Place `<AppPeriodNavigator initial-granularity="month" @change="onPeriodChange" />` at the top of the view.
  - Store `activeRange` (`startDate`, `endDate`).
  - When the period changes, reset `page` to 1 and reload.
  - When search input changes, debounce by 300ms, reset `page` to 1, and reload.
  - When category changes, reset `page` to 1 and reload.
  - When warehouse changes in `authStore.activeWarehouseId`, reset `page` to 1 and reload.
  - When page or limit changes via `AppPagination`, fetch the new page.
  - Replace the client-filtered `totalExpensesAmount` with the server-returned `summary.totalAmount`.

## Risks / Trade-offs

- **[Risk] Existing callers of `GET /api/expenses` expecting a raw array** → *Mitigation*: The frontend service `expenseService.getExpenses` will check if `response.data.data` is an object with an `items` array or a direct array, seamlessly normalizing both shapes.
- **[Risk] Rapid typing causing multiple in-flight requests** → *Mitigation*: 300ms debounce timer cancels previous pending calls, and in-flight request tracking prevents stale race conditions.
- **[Risk] Filter reset desynchronization** → *Mitigation*: Reset `page.value = 1` systematically on any filter change (period, search, category, warehouse).
