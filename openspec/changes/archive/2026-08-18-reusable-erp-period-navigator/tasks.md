## 1. Date Calculation Engine

- [x] 1.1 Create `src/utils/periodNavigator.ts` with pure date math functions for calculating period boundaries (day, week, month, quarter, year) and prior comparison periods
- [x] 1.2 Implement stepping functions (`stepBackward`, `stepForward`) and future guard check (`canStepForward`)
- [x] 1.3 Implement French formatting labels for all granularities (e.g. "18 Août 2026", "Semaine du 10 au 16 Mars 2025", "Mars 2025", "T2 2025", "Année 2025")

## 2. Reusable UI Component

- [x] 2.1 Build `AppPeriodNavigator.vue` component with segmented granularity tabs, steppers, and reactive period state
- [x] 2.2 Build the interactive Quick Jump Popover (year selector, month grid, quarter buttons) with outside-click dismissal
- [x] 2.3 Add "Revenir à aujourd'hui" quick reset action and disabled forward stepper styling for future periods
- [x] 2.4 Add responsive mobile layout adapting segmented tabs and popover smoothly

## 3. Views Integration

- [x] 3.1 Replace the old flat pills in `DashboardView.vue` with `<AppPeriodNavigator>`
- [x] 3.2 Connect `DashboardView.vue` metrics fetching to `AppPeriodNavigator` emitted date boundaries
- [x] 3.3 Ensure Financial and Sales reports views are compatible with the new period navigator state

## 4. Verification & Testing

- [x] 4.1 Run unit checks on edge cases (leap years, quarter year crossing, week month crossing)
- [x] 4.2 Run frontend production build (`npm run build` in `frontend/`) to ensure 0 compile/type errors
- [x] 4.3 Verify stepper navigation (◀ / ▶), jump popover, and reset button in the browser
