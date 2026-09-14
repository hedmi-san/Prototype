## ADDED Requirements

### Requirement: Period-Filtered Expense Retrieval
The system SHALL support querying expenses bounded by date ranges (`startDate` and `endDate`) via `GET /api/expenses`.

#### Scenario: Querying expenses with date range
- **WHEN** a client requests `GET /api/expenses` with `startDate=2026-09-01` and `endDate=2026-09-30`
- **THEN** the system returns only expenses where `expense_date` falls between `2026-09-01` and `2026-09-30` inclusive

### Requirement: Server-Side Pagination and Aggregated Summary
The system SHALL support paginating expense records and returning pagination metadata alongside total expense amounts for the filtered result set.

#### Scenario: Requesting a page of expenses
- **WHEN** a client requests `GET /api/expenses` with `page=1` and `limit=25`
- **THEN** the system returns at most 25 items for the requested page, along with pagination metadata (`page`, `limit`, `total`, `totalPages`) and the total expense amount (`summary.totalAmount`) across all records matching the query filters

#### Scenario: Backward-compatible fallback retrieval
- **WHEN** a client requests `GET /api/expenses` without pagination parameters
- **THEN** the system still provides structured response items and summary information without breaking callers

### Requirement: Server-Side Expense Filtering and Search
The system SHALL support filtering expenses by warehouse, category, and textual keyword on the server side.

#### Scenario: Filtering by category and search keyword
- **WHEN** a client requests `GET /api/expenses` with `category=ELECTRICITY` and `search=Sonelgaz`
- **THEN** the system returns only electricity expenses matching the keyword "Sonelgaz" in description, warehouse name, or creator name

### Requirement: Frontend Period Navigator Integration
The Expense view SHALL embed the reusable `AppPeriodNavigator` component allowing users to switch between standard date granularities (Day, Week, Month, Quarter, Year, Custom).

#### Scenario: Changing period range in UI
- **WHEN** the user selects a new period or adjusts date bounds in `AppPeriodNavigator`
- **THEN** the view resets pagination to page 1 and fetches the expenses for the selected date range

### Requirement: Frontend Pagination Control and Debounced Search
The Expense view SHALL embed the `AppPagination` component for page navigation and debounce user search input to optimize server requests.

#### Scenario: Changing page number
- **WHEN** the user navigates to another page in `AppPagination`
- **THEN** the view fetches the specified page of expenses with the current filters and page limit

#### Scenario: Typing into search box
- **WHEN** the user inputs text into the search input
- **THEN** the view debounces the input by 300ms before dispatching the query with page reset to 1
