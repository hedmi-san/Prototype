# ui-design-system Specification

## Purpose
TBD - created by archiving change multi-warehouse-tool-distribution-system. Update Purpose after archive.
## Requirements
### Requirement: Monochromatic Color Token Palette
The application UI SHALL use a consistent monochromatic design token palette with deep charcoal primary (#171717), pure white background (#ffffff), light gray surface (#f3f3f3 with backdrop blur support), high-contrast text hierarchies, hairline borders (#ededed), and semantic alert colors.

#### Scenario: Verify monochromatic color styling
- **WHEN** any page or component is rendered
- **THEN** primary interactive elements and active CTAs SHALL use `#171717`, card backgrounds SHALL use `#ffffff`, control/surface backgrounds SHALL use `#f3f3f3`, borders SHALL use 1px hairline `#ededed`, and text SHALL follow the defined opacity scale (95% primary `#171717`, 60% secondary `#7c7c7c`, 30% tertiary `#c7c7c7`)

#### Scenario: Display semantic alert states
- **WHEN** the system displays a status badge, banner, or alert notification
- **THEN** it SHALL use semantic alert pairs: Success (`#278f5e` on `#e4f5e9`), Danger (`#cc2929` on `#fff7f7`), Warning (`#ab6e05` on `#fffcef`), or Info (`#0070cc` on `#f7fbfd`)

### Requirement: Typography Scale and Variable Font Stack
The UI SHALL use the InterVariable typography stack with defined responsive fluid scales for headlines, subheadings, body text, uppercase labels, and monospace data representation.

#### Scenario: Fluid headline scaling
- **WHEN** a top-level page heading is displayed across viewports
- **THEN** it SHALL fluidly scale according to `clamp(32px, 6vw, 56px)` with font-weight 600, tracking -0.03em, and line-height 1.1

#### Scenario: Monospace formatting for tabular and audit data
- **WHEN** invoice numbers, stock SKU references, transaction hashes, or timestamps are rendered
- **THEN** the system SHALL render them in a monospace font stack (SFMono-Regular, Menlo, Monaco) at 12px

### Requirement: Layout Metrics, Border Radii, and Layered Shadows
The UI SHALL adhere to an 8px base spacing grid, a maximum container width of 1440px, enterprise-density grid padding (10px 8px), structured border-radius steps (8px, 10px, 12px, 16px), and multi-layered elevation shadows.

#### Scenario: Apply consistent card and modal geometry
- **WHEN** cards, modals, or form inputs are rendered
- **THEN** form inputs SHALL have 8px border-radius, cards SHALL have 10px border-radius with 20px internal padding, and modals SHALL have 12px border-radius with layered elevation shadow

### Requirement: Skeleton Loading and Refined Micro-Interactions
The UI SHALL implement pulse skeleton screens for asynchronous loading states instead of generic centered spinner wheels, and provide transform-only micro-interactions with visible keyboard focus indicators.

#### Scenario: Asynchronous data loading with skeleton screen
- **WHEN** a view or table is awaiting backend API data
- **THEN** the system SHALL display shaped monochromatic skeleton placeholders with a subtle shimmer effect matching the dimensions of the loading content

#### Scenario: Accessible keyboard navigation and focus rings
- **WHEN** a user navigates interactive elements using the keyboard
- **THEN** every interactive element SHALL exhibit a visible focus ring using `#171717` without layout shift

### Requirement: Reusable Pagination Control Component
The system SHALL provide a reusable UI pagination component (`AppPagination.vue`) in the common design system that encapsulates page state, page size selector (e.g. 25, 50, 100), total record counter, previous/next buttons, and direct page buttons with disabled states for boundary limits.

#### Scenario: Pagination component state change
- **WHEN** a user clicks page 3 or selects a different page size (e.g. 50 items/page)
- **THEN** the pagination component SHALL emit `update:page` or `update:limit` events with the new parameters and recalculate total pages

#### Scenario: Boundary protection on first and last pages
- **WHEN** the current page is 1
- **THEN** the "Previous" stepper button SHALL be disabled, and when current page equals totalPages, the "Next" stepper button SHALL be disabled

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

### Requirement: Dual-Mode Print Isolation Architecture
The UI design system SHALL support dual-mode print isolation that dynamically differentiates between modal-isolated document printing (e.g. A4 invoice vouchers) and direct page-level report printing (e.g. stock valuation, financial statements).

#### Scenario: Print from teleported document modal
- **WHEN** a print action is triggered while a modal backdrop is active in the DOM (`body:has(.modal-backdrop)`)
- **THEN** the system SHALL hide the main application container (`#app`) and render only the teleported modal document sheet

#### Scenario: Print from direct application view
- **WHEN** a print action is triggered from a direct view without an active modal backdrop
- **THEN** the system SHALL keep the main application container (`#app`) visible, hide UI chrome (`.top-header`, `.sidebar`, `.header-actions`, `.read-only-banner`, and interactive buttons), and stretch `.main-content` to 100% width with visible overflow

