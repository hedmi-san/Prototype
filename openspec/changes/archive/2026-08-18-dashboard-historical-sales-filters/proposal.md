## Why

The current dashboard only calculates static metrics for the current calendar day and current month, preventing managers and accountants from analyzing past performance, comparing periods (e.g. yesterday vs today, this month vs last month, or current year vs previous year), or viewing historical sales trends easily. Adding dynamic period presets and custom date range filters enables immediate operational visibility and trend comparison across warehouses.

## What Changes

- Add a versatile **Date Range / Period Selector** to the Dashboard with one-click presets (*Aujourd'hui*, *Hier*, *7 Derniers Jours*, *30 Derniers Jours*, *Ce Mois-ci*, *Mois Précédent*, *Année en cours*, *Année Précédente*, *Période Personnalisée*).
- Support historical comparison indicators on KPI cards displaying percentage deltas against the preceding equivalent time period (+X% / -X%).
- Add an interactive **Sales Evolution & Historical Breakdown** chart/table widget to the dashboard showing sales volume and transaction count trends over the selected period.
- Extend backend `/reports/dashboard` and `/reports/sales` API endpoints to support flexible `startDate`, `endDate`, and `preset` query parameters with comparison calculations.
- Enrich database seed data with realistic multi-period historical sales across yesterday, last month, and the prior year to provide immediate testable analytics.

## Capabilities

### Modified Capabilities
- `reporting-audit-logging`: Extend dashboard metrics calculation to support arbitrary date ranges, predefined historical period presets, and period-over-period delta comparisons.
- `sales-management`: Add backend historical aggregation helpers and filtered sales summary retrieval by custom date boundaries.

## Impact

- **Backend**: Update [report.routes.ts](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/backend/src/routes/report.routes.ts) and [seed.ts](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/backend/src/db/seed.ts) for period filtering and historical seed data.
- **Frontend**: Update [DashboardView.vue](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/views/dashboard/DashboardView.vue), [admin-reports.service.ts](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/services/admin-reports.service.ts), and [types/index.ts](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/types/index.ts) to introduce period filter controls, comparison badges, and historical trend views.
- **Database**: No schema migration required (SQLite `sales` table already has `created_at` timestamp).
