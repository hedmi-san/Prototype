## ADDED Requirements

### Requirement: Reusable Pagination Control Component
The system SHALL provide a reusable UI pagination component (`AppPagination.vue`) in the common design system that encapsulates page state, page size selector (e.g. 25, 50, 100), total record counter, previous/next buttons, and direct page buttons with disabled states for boundary limits.

#### Scenario: Pagination component state change
- **WHEN** a user clicks page 3 or selects a different page size (e.g. 50 items/page)
- **THEN** the pagination component SHALL emit `update:page` or `update:limit` events with the new parameters and recalculate total pages

#### Scenario: Boundary protection on first and last pages
- **WHEN** the current page is 1
- **THEN** the "Previous" stepper button SHALL be disabled, and when current page equals totalPages, the "Next" stepper button SHALL be disabled
