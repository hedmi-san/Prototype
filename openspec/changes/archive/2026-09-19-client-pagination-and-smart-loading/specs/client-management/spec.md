## ADDED Requirements

### Requirement: Scalable Directory Pagination and Decoupled Summary Metrics
The system SHALL provide paginated browsing for commercial client accounts capable of scaling beyond 6,000 clients without executing redundant full-table KPI aggregations on pagination transitions.

#### Scenario: Navigating pages without recalculating KPIs
- **WHEN** a user navigates between pages (e.g. page 1 to page 2) or changes page size in the client directory
- **THEN** the system fetches only the paginated slice of client records with current filters and skips re-aggregating company-wide financial KPIs (`skipKpis=true`)

#### Scenario: URL state synchronization for client directory
- **WHEN** a user updates the search term, balance filter, or page number in the client directory
- **THEN** the system synchronizes these parameters into the browser URL query string and restores them on page reload or back-navigation

### Requirement: Server-Side Typeahead Search with Pinned Default Walk-in Customer
The system SHALL provide high-performance server-side typeahead searching across commercial clients and permanently pin the default walk-in customer at the top of client selectors.

#### Scenario: Sub-15ms fuzzy search via trigram indexing
- **WHEN** a user types 2 or more characters into a client search combobox
- **THEN** the system debounces the input by 200ms and executes a server-side search matching against client name, code, or phone number powered by PostgreSQL trigram indexing

#### Scenario: Persistent pinning of default walk-in client
- **WHEN** the client selection dropdown is opened or searched
- **THEN** the default walk-in client (`Client Passager / Comptoir`) is permanently displayed as the pinned first option (index 0) with a quick-select visual indicator

#### Scenario: Automatic client hydration by identifier
- **WHEN** a form or combobox initializes with an existing `clientId` that is not present in the current paginated search window
- **THEN** the system fetches the specific client by ID to resolve and display the client's code and name without requiring full directory preloading
