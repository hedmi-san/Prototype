## 1. Backend Period Filtering & Comparison APIs

- [x] 1.1 Extend `/reports/dashboard` endpoint in `backend/src/routes/report.routes.ts` to support `startDate`, `endDate`, and `preset` query parameters
- [x] 1.2 Implement period-over-period comparison calculation (sales, orders, and % delta vs preceding equivalent time window)
- [x] 1.3 Implement time series breakdown aggregation (`salesTrend`) grouped by day or month based on the active range
- [x] 1.4 Enrich demo seed dataset in `backend/src/db/seed.ts` with multi-period sales transactions across yesterday, last month, and the prior year

## 2. Frontend Services & Type Definitions

- [x] 2.1 Update `frontend/src/types/index.ts` with `PeriodPreset`, `PeriodComparison`, and `SalesTrendItem` definitions
- [x] 2.2 Update `reportService.getDashboardMetrics` in `frontend/src/services/admin-reports.service.ts` to pass period parameters

## 3. Frontend Dashboard UI & Period Controls

- [x] 3.1 Add interactive Period Selector toolbar in `DashboardView.vue` with preset buttons and custom date pickers
- [x] 3.2 Add period-over-period delta badges (+X% / -X%) on Dashboard KPI cards
- [x] 3.3 Add **Sales Evolution & Breakdown** widget displaying trend bar indicators, transaction counts, and average basket (*Panier moyen*)
- [x] 3.4 Polish UI styling and responsive layouts for desktop and mobile screens

## 4. Verification & Testing

- [x] 4.1 Run backend TypeScript build (`npm run build` in `backend/`)
- [x] 4.2 Run frontend production build (`npm run build` in `frontend/`)
- [x] 4.3 Verify dashboard queries respond correctly for all period presets
