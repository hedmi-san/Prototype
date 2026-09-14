## 1. Backend Route Enhancement

- [x] 1.1 Update `GET /api/expenses` parameter extraction in `backend/src/routes/expense.routes.ts` to support `startDate`, `endDate`, `category`, `search`, `page`, and `limit`
- [x] 1.2 Implement dynamic SQL conditions, count and total sum aggregation query, and paginated row retrieval query
- [x] 1.3 Return structured payload with `items`, `pagination`, and `summary` while maintaining warehouse scope security

## 2. Frontend Service & Types Layer

- [x] 2.1 Define `ExpenseQueryParams` and `PaginatedExpenses` interfaces in `frontend/src/services/admin-reports.service.ts`
- [x] 2.2 Update `expenseService.getExpenses` to accept query parameters and normalize paginated and fallback response structures

## 3. Frontend View Enhancement

- [x] 3.1 Embed `AppPeriodNavigator` with `initial-granularity="month"` in `frontend/src/views/expenses/ExpenseListView.vue` and implement `onPeriodChange`
- [x] 3.2 Add pagination state (`page`, `limit`, `total`, `totalPages`) and embed the `AppPagination` component
- [x] 3.3 Connect server-driven smart data fetching with 300ms debounced search, category filter, and warehouse selector reactivity
- [x] 3.4 Bind the total expenses amount badge to `summary.totalAmount` and ensure create/edit/delete actions trigger refreshed queries

## 4. Verification & Validation

- [x] 4.1 Validate backend build and test endpoint responses with date ranges and pagination parameters
- [x] 4.2 Validate frontend compilation and verify UI period navigation, page switching, and filter responsiveness
