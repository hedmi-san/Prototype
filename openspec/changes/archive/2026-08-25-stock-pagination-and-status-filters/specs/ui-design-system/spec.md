## ADDED Requirements

### Requirement: Interactive Stock Status Filter Tabs with Live Counters
The UI SHALL provide interactive status filter tabs (pill selectors) in the stock management view displaying real-time item counts for `Tous les articles`, `En stock`, `Stock faible`, and `En rupture`, enabling instant one-click filtering.

#### Scenario: Switch stock status filter tab
- **WHEN** a user clicks the "Stock faible" tab
- **THEN** the view SHALL update the active tab state, reset the pagination to page 1, and fetch the filtered low-stock records from the server

#### Scenario: Display live aggregate counters on status pills
- **WHEN** stock data is loaded or refreshed
- **THEN** each status tab badge SHALL display the formatted total count corresponding to that inventory state (e.g. "Tous (1 248)", "En stock (1 180)", "Stock faible (51)", "En rupture (17)")

### Requirement: Paginated Stock Management View Integration
The stock inventory view (`StockView.vue`) SHALL integrate `AppPagination` to manage paginated browsing, limit selection (25, 50, 100), and debounced search input, removing blocking eager catalog fetches on view mount.

#### Scenario: Navigate stock pages
- **WHEN** a user changes page or adjusts the page size in `StockView.vue`
- **THEN** the component SHALL request the corresponding slice from `inventoryService.getStock` and render the table without full-page reloads
