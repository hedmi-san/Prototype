## Context

The current dashboard displays sales, stock valuation, net profit, and recent transactions strictly for the current day and current month. Business operators, warehouse managers, and accountants cannot analyze yesterday's performance, weekly dynamics, previous month closures, or year-over-year trends without manually filtering the separate financial reports page.

## Goals / Non-Goals

**Goals:**
- Provide an intuitive Period Selector on the main Dashboard with quick presets: *Aujourd'hui* (Today), *Hier* (Yesterday), *7 Derniers Jours* (Last 7 Days), *30 Derniers Jours* (Last 30 Days), *Ce Mois-ci* (This Month), *Mois Précédent* (Last Month), *Année en cours* (This Year), *Année Précédente* (Last Year), and *Personnalisée* (Custom Date Range).
- Calculate and display period-over-period comparison deltas (percentage increase/decrease and absolute delta) for selected metrics (e.g. Sales, Orders, Average Basket).
- Provide a responsive **Sales Trend & Breakdown** widget summarizing revenue by sub-period (daily for short ranges, monthly for annual ranges).
- Extend backend `/reports/dashboard` to accept optional `startDate`, `endDate`, and `preset` query parameters and return both current period and prior equivalent period comparative data.
- Enrich development database seed data with realistic multi-period transactions to ensure immediate testability.

**Non-Goals:**
- Rebuilding the separate full-page Profit & Loss financial statement (that remains in `/reports/financial`).
- Introducing external charting libraries (chart visuals will be built using lightweight, high-performance SVG/CSS bar sparklines and comparative tables within our Vanilla CSS design system).

## Decisions

1. **Date Range Boundaries & Predefined Presets**:
   - The frontend will allow selecting predefined presets which automatically compute `startDate` and `endDate` in `YYYY-MM-DD` format (or send the named preset to the backend).
   - *Rationale*: Presets provide instant 1-click insights for standard business cycles without forcing users to pick calendar dates manually every time.

2. **Period-over-Period Delta Calculation**:
   - The backend compares the selected window $[T_{start}, T_{end}]$ with the immediately preceding equal duration window $[T_{start} - \Delta, T_{start}]$ (or previous month/year equivalent).
   - Formula: $\text{Delta \%} = \frac{\text{Current} - \text{Previous}}{\text{Previous}} \times 100$.
   - *Rationale*: Enables managers to immediately see whether sales volume is accelerating or declining.

3. **Sparkline & Evolution Breakdown**:
   - The dashboard metrics response will return a `salesTrend: { date: string, label: string, totalAmount: number, ordersCount: number }[]` array.
   - The frontend will render this with styled trend bars and summary stats (Panier moyen / Average Order Value, Total Chiffre d'Affaires).

## Risks / Trade-offs

- **[Risk]** Slow SQL queries if calculating large date ranges across multiple warehouses.
  - → *Mitigation*: SQLite query uses indexed `created_at` and `warehouse_id` on the `sales` table, and date grouping uses SQLite's native `strftime` and `date()` functions.
- **[Risk]** Division by zero in percentage delta calculations when prior period sales were 0.
  - → *Mitigation*: Gracefully return `null` / `+100%` when previous sales are 0.
