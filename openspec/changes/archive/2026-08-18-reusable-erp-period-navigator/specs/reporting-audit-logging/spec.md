## MODIFIED Requirements

### Requirement: Role-Based Dashboard Metrics
The system SHALL provide customized dashboards displaying operational KPIs for Admins across all warehouses, and for Managers and Accountants filtered to their assigned warehouse, synchronized with the reusable ERP period navigator component.

#### Scenario: Dashboard refreshes on period change
- **WHEN** the user shifts the period navigator to a new date range (e.g. "T2 2025")
- **THEN** the dashboard SHALL automatically fetch and display sales, expenses, net profits, and performance comparisons computed for that exact time boundary
