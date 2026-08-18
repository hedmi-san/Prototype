## MODIFIED Requirements

### Requirement: Role-Based Dashboard Metrics
The system SHALL provide customized dashboards displaying real-time and historical operational KPIs for Admins across all warehouses, and for Managers and Accountants filtered to their assigned warehouse, supporting user-selected period filters and date ranges.

#### Scenario: Admin views global dashboard with period filter
- **WHEN** an Admin accesses the dashboard and selects a period filter (e.g. *Hier*, *Ce Mois-ci*, *Mois Précédent*, *Année en cours*, or Custom Range)
- **THEN** the system SHALL display consolidated KPIs filtered to that period, including period sales, period orders, estimated net profit, comparative percentage deltas against the preceding equivalent period, total stock value, and multi-warehouse breakdown

#### Scenario: Manager views warehouse dashboard with historical period
- **WHEN** a Manager or Accountant accesses the dashboard and selects a historical period (e.g. *Mois Précédent* or *Année Précédente*)
- **THEN** the system SHALL display KPIs scoped exclusively to their assigned warehouse for that exact time window along with historical comparison badges and trend breakdowns

## ADDED Requirements

### Requirement: Period-over-Period Performance Comparison
The system SHALL calculate comparative performance deltas between the selected time window and the immediately preceding equivalent period.

#### Scenario: Calculate positive sales growth
- **WHEN** the user selects *Ce Mois-ci* with 500,000 DZD in sales compared to 400,000 DZD during *Mois Précédent*
- **THEN** the system SHALL calculate a growth delta of +25.0% and display a positive growth indicator

#### Scenario: Handle zero prior sales baseline
- **WHEN** the previous period had 0 DZD in sales and the current period has 150,000 DZD
- **THEN** the system SHALL indicate a baseline growth without throwing division-by-zero errors

### Requirement: Sales Evolution Trend Breakdown
The system SHALL aggregate historical sales into a chronological time series breakdown according to the active period filter.

#### Scenario: Daily breakdown for monthly range
- **WHEN** a 30-day or monthly period is selected
- **THEN** the system SHALL return daily aggregated sales data points with date, revenue, and order counts
