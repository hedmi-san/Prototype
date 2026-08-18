## Why

The current flat pill list on the Dashboard mixes distinct time granularities (day, week, month, year) into a non-extensible row, making it cumbersome to navigate back/forward in time (e.g. going back 3 months to March 2025) or select specific business quarters without adding endless buttons. Professional ERPs (Odoo, QuickBooks, Xero) use a structured, 2-part period navigation paradigm. We need a standardized, reusable component (`AppPeriodNavigator.vue`) with dedicated date-math utilities that can be used across the Dashboard and all reporting/audit views.

## What Changes

- **Replace Flat Pill List with ERP-style Period Navigator**:
  - **Granularity Selector**: Segmented control with 5 distinct time scales: `Jour`, `Semaine`, `Mois`, `Trimestre`, `Année`.
  - **Stepper & Navigation Controls**: Left/Right stepper buttons (◀ / ▶) to shift exactly one period unit backward or forward relative to the active granularity.
  - **Clickable Central Period Label & Quick Jump Popover**: Clicking the label (e.g. *"Mars 2025"*, *"T2 2025"*, *"Semaine du 10 au 16 mars 2025"*) opens a lightweight contextual popover allowing 1-click jumps to any specific Month, Quarter, or Year without raw text typing.
  - **"Période Courante" / "Aujourd'hui" Quick Reset**: Instant 1-click button to reset back to the current date/period.
  - **Future Navigation Guard**: The next (▶) button is automatically disabled when the next period falls entirely in the future (beyond the current date).
- **Componentized & Reusable**:
  - Implemented as a reusable `AppPeriodNavigator.vue` component with `v-model` emitting normalized period state `{ startDate, endDate, granularity, label, priorStartDate, priorEndDate, priorPeriodLabel }`.
  - Pure date calculation library `src/utils/periodNavigator.ts` handling all calendar edge cases (quarter transitions across year boundaries, week calculations crossing month/year lines, leap years, variable month lengths).
- **Dashboard & Reports Integration**:
  - Integrate `AppPeriodNavigator.vue` into the Dashboard, Financial Reports, and Sales Reports.

## Capabilities

### New Capabilities
- `period-navigation-system`: Reusable ERP-grade period navigation state machine and UI component supporting multi-scale time navigation (day/week/month/quarter/year), steppers, quick-jump popovers, and calendar edge cases.

### Modified Capabilities
- `reporting-audit-logging`: Update Dashboard and reporting views to use `AppPeriodNavigator` with dynamic period boundaries and comparison metadata.

## Impact

- **Frontend Component**: [AppPeriodNavigator.vue](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/components/common/AppPeriodNavigator.vue).
- **Date Math Helper**: [periodNavigator.ts](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/utils/periodNavigator.ts).
- **Views**: [DashboardView.vue](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/views/dashboard/DashboardView.vue), [FinancialReportsView.vue](file:///c:/Users/LAPTOP%20SPIRIT/Documents/Learning/Antigravity/Prototype/frontend/src/views/reports/FinancialReportsView.vue).
- **Backend API**: Compatible with the existing `/reports/dashboard?startDate=...&endDate=...` parameters.
