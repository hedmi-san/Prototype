## ADDED Requirements

### Requirement: Historical Sales Range Filtering and Aggregation
The system SHALL support querying and aggregating completed sales transactions across configurable start and end dates with warehouse scoping.

#### Scenario: Query sales within custom date boundaries
- **WHEN** an authenticated user requests sales records with `startDate="2026-07-01"` and `endDate="2026-07-31"`
- **THEN** the system SHALL return all completed sales whose `created_at` timestamp falls within the inclusive date boundary, respecting the user's warehouse authorization scope
