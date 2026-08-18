## 1. Setup & Localization Infrastructure

- [x] 1.1 Update `index.html` lang attribute to `fr` and update application title to French
- [x] 1.2 Create or update `src/utils/formatters.ts` with French locale number, date, and currency formatters using `Intl`
- [x] 1.3 Create centralized French domain enum mappers for user roles, order statuses, transfer states, payment methods, and expense categories
- [x] 1.4 Update route titles and navigation metadata in `src/router/index.ts` to French

## 2. Layouts, Authentication & Navigation

- [x] 2.1 Translate `AuthLayout.vue` and `LoginView.vue` (labels, placeholders, buttons, error messages)
- [x] 2.2 Translate `DashboardLayout.vue` (sidebar navigation, warehouse switcher, user profile pill, logout)
- [x] 2.3 Localize common UI components (`AppModal`, `AppTable`, `AppPagination`, `AppConfirmDialog`, `AppEmptyState`)

## 3. Inventory & Product Management

- [x] 3.1 Translate Products views and modals (product catalog, categories, SKU, price inputs, unit measures)
- [x] 3.2 Translate Inventory views (stock levels, low stock alerts, stock adjustments, batch/serial tracking)

## 4. Sales & Transfer Management

- [x] 4.1 Translate Sales / POS views (order creation, cart items, payment methods, invoice summaries, status badges)
- [x] 4.2 Translate Transfers views (inter-warehouse transfer requests, dispatch/receipt flows, approval dialogs)

## 5. Expenses, Salaries & Employees

- [x] 5.1 Translate Expenses views (expense recording, category selectors, receipt upload labels, approval statuses)
- [x] 5.2 Translate Salaries / Payroll views (payroll periods, base salary, deductions, bonuses, payslip generation)
- [x] 5.3 Translate Employees views (employee list, role assignments, warehouse allocation, onboarding modals)

## 6. Dashboard, Reports & Admin Settings

- [x] 6.1 Translate Dashboard view (KPI summaries, revenue charts, stock alerts, quick actions)
- [x] 6.2 Translate Reports & Audit Logs views (analytics filters, export buttons, audit history)
- [x] 6.3 Translate Admin & Settings views (user management, warehouse configuration, role permissions)

## 7. Verification & Quality Assurance

- [x] 7.1 Verify error messages and notification toasts in Pinia stores and API services
- [x] 7.2 Run frontend build test (`npm run build` or `vue-tsc && vite build`) to ensure 0 compile/type errors
- [x] 7.3 Visual audit across responsive layouts (desktop & mobile) to prevent text overflow or broken containers
