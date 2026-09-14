## Why

The Expense Management module currently fetches the entire list of operational expenses into the client at once without server-side pagination, date period boundaries, or server-side filtering. As expense records grow, loading all records causes performance degradation and high memory usage, and users cannot easily navigate and analyze expenses by date ranges (day, week, month, quarter, year, custom) consistent with other modules (such as Sales, Transfers, Salaries, and Inventory Movements).

## What Changes

- **Backend Expense Query Optimization & Pagination**: Add server-side pagination (`page`, `limit`), period date filtering (`startDate`, `endDate`), category filtering (`category`), and text search (`search`) to the `GET /api/expenses` endpoint.
- **Backend Summary Aggregation**: Return total expense amount summary and pagination metadata alongside paginated item records in `GET /api/expenses`, while maintaining backward compatibility.
- **Frontend Period Navigator Integration**: Integrate the standard `AppPeriodNavigator` (granularity options: day, week, month, quarter, year, custom range) into `ExpenseListView.vue`.
- **Frontend Server-Side Pagination**: Integrate `AppPagination` component with configurable page sizes (e.g. 10, 25, 50, 100) and synchronized page state.
- **Smart Data Loading & Debouncing**: Replace client-side array filtering in `ExpenseListView.vue` with server-side smart data fetching, including debounced search input, instant refresh on period/category/warehouse changes, and loading indicators.

## Capabilities

### New Capabilities
- `expense-management`: End-to-end period-filtered, paginated, and smart querying capabilities for operational expenses in backend services and the frontend management view.

### Modified Capabilities
<!-- None: No existing specs defined in openspec/specs/ are modified. -->

## Impact

- **Backend**: `backend/src/routes/expense.routes.ts` (enhanced `GET /` query handler with SQL filtering, pagination, and total amount aggregation).
- **Frontend Service**: `frontend/src/services/admin-reports.service.ts` (updated `expenseService.getExpenses` and TypeScript interfaces to support `ExpenseQueryParams` and `PaginatedExpenses`).
- **Frontend Views**: `frontend/src/views/expenses/ExpenseListView.vue` (integrated `AppPeriodNavigator`, `AppPagination`, debounced search, server-driven reactive state).
- **API Response Structure**: Enhanced `GET /api/expenses` payload returning `{ items, pagination, summary }` while maintaining graceful fallback handling.
