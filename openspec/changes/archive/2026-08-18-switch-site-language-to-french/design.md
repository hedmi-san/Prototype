## Context

The Multi-Warehouse Tool Distribution Management System frontend (Vue 3 + TypeScript + Vite + Pinia) currently uses English for all text, headings, status indicators, form labels, and table views. To adapt the product for French-speaking operations, all user-facing interfaces, alerts, validations, and domain enum badges must be localized to French.

## Goals / Non-Goals

**Goals:**
- Translate 100% of frontend user interfaces into natural, business-accurate French (Français).
- Localize all layouts (AuthLayout, DashboardLayout), navigation menus, views (Inventory, Products, Sales, Transfers, Salaries, Expenses, Employees, Reports, Admin), and common components.
- Establish centralized utility mappers for domain enum values (roles, transaction types, transfer statuses, order states, payment methods).
- Implement French locale-aware formatting for currency, numerical values, and timestamps using standard `Intl` browser APIs.
- Adapt layout metrics and CSS where needed to ensure longer French strings do not cause overflow or visual clipping.

**Non-Goals:**
- Multi-language runtime toggle (e.g., dynamic switcher between EN/FR/ES). The application is switching its primary language to French.
- Backend API schema changes (database column names, JSON API keys, and backend enum values remain in standard English/code format).
- Backend audit log internal strings (internal server log messages remain in standard technical format, while UI audit log displays are translated).

## Decisions

### Decision 1: Structured Localization & Formatter Architecture
- **Decision**: Centralize common translations, status labels, role mappings, and formatting helpers in `src/utils/formatters.ts` and `src/locales/` while updating Vue templates directly with semantic French copy.
- **Rationale**: Keeps the codebase lightweight and highly performant without introducing unnecessary bundle overhead or indirection for single-language deployments, while ensuring reusable domain mappings (status badges, roles, units, payment types) remain consistent.
- **Alternatives Considered**:
  - Full `vue-i18n` runtime abstraction: Adds unnecessary boilerplate and overhead if multi-tenant multi-language dynamic switching is not required.
  - Ad-hoc scattered translations in each component: Leads to inconsistent terminology across different screens.

### Decision 2: Backend Enum Translation Mapping
- **Decision**: Keep backend REST payload enums intact (`PENDING`, `COMPLETED`, `REJECTED`, `ADMIN`, `CASH`, `TRANSFER`) and provide type-safe translation helper functions in the frontend (e.g., `formatStatus(status)`, `formatRole(role)`, `formatPaymentMethod(method)`).
- **Rationale**: Prevents backend migration risks and preserves database integrity while guaranteeing French presentation in badges, filters, and tables.

### Decision 3: Standardized French Formatting Utilities
- **Decision**: Use `Intl.NumberFormat('fr-FR')` and `Intl.DateTimeFormat('fr-FR')` for all currency amounts (FCFA / €), decimal numbers, and timestamps.
- **Rationale**: Native browser API provides zero-dependency, high-performance locale compliance with correct French spacing and comma separators.

## Risks / Trade-offs

- **[Risk] Longer French text expanding beyond container bounds** → *Mitigation*: Audit sidebar links, action buttons, and table headers; apply flex wrapping, minimum widths, or truncation with tooltip attributes where necessary.
- **[Risk] Inconsistent domain terms across modules** → *Mitigation*: Create a unified terminology dictionary for warehouse concepts (e.g., "Entrepôt", "Stock disponible", "Bon de transfert", "Point de vente", "Fiche de paie").
- **[Risk] Untranslated dynamic error messages from backend** → *Mitigation*: Wrap API error handlers in the frontend to map common error codes (401, 403, 404, 500, validation errors) to user-friendly French alerts.
