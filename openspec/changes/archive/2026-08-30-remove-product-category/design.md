## Context

The product catalog model currently includes a `category` column in the PostgreSQL database (`products.category VARCHAR(100) DEFAULT 'Tools'`) and is exposed through backend entity types, API query parameters, SQL insertion/update scripts, reports/inventory CSV exports, and frontend TypeScript interfaces.
The user requirement states that `category` is completely unnecessary for products and must be removed entirely across the full stack.

At the same time, the system features an independent expense tracking module with `ExpenseCategory` (`expenses.category`), which categorizes financial expenses (such as `ELECTRICITY`, `WATER`, `RENT`, `FUEL`, `MAINTENANCE`, `OTHER`). This module must remain completely untouched.

## Goals / Non-Goals

**Goals:**
- Drop `category` from the `products` table in database schema and seed data.
- Add an idempotent database migration statement (`ALTER TABLE products DROP COLUMN IF EXISTS category;`) in `schema.ts`.
- Clean up all backend routes (`product.routes.ts`, `inventory.routes.ts`, `report.routes.ts`) to eliminate `category` parameters, clauses, selects, and CSV columns.
- Clean up backend and frontend TypeScript interfaces (`Product`, `ProductCatalogReport`, etc.).
- Update frontend search combobox (`AppProductCombobox.vue`) and catalog services to remove product category logic.

**Non-Goals:**
- Modify or remove financial expense categories (`ExpenseCategory`, `expenses.category`, `expensesByCategory` in `expense.routes.ts`, `report.routes.ts`, `ExpenseListView.vue`, `FinancialReportsView.vue`).

## Decisions

### Decision 1: Idempotent Schema Migration
- **Choice**: Execute `ALTER TABLE products DROP COLUMN IF EXISTS category;` in `backend/src/db/schema.ts` when initialized, and update the base `CREATE TABLE IF NOT EXISTS products` statement to omit the column.
- **Rationale**: Ensures both fresh database initialization and existing developer/production databases seamlessly remove the column without errors.
- **Alternative considered**: Separate migration tool or manual SQL execution. Schema bootstrap is currently handled in `schema.ts`.

### Decision 2: Search Query Clause Optimization
- **Choice**: Simplify SQL where clause from `(reference ILIKE $1 OR name ILIKE $2 OR brand ILIKE $3 OR category ILIKE $4)` to `(reference ILIKE $1 OR name ILIKE $2 OR brand ILIKE $3)` in `product.routes.ts`.
- **Rationale**: Keeps search fast and strictly aligned with existing fields without dead column references.

### Decision 3: CSV Export Alignment
- **Choice**: Remove "Catégorie" from both product catalog CSV export and inventory stock CSV export.
- **Rationale**: Prevents empty/broken columns and ensures exported spreadsheets represent current data structures accurately.

## Risks / Trade-offs

- **[Risk] Existing database data loss for product categories**:
  - *Mitigation*: The user explicitly requested complete removal because the field is not needed. The column contains default dummy values (`Tools`, etc.) that are unused in business workflows.
- **[Risk] Confusing product category with expense category**:
  - *Mitigation*: Strictly isolate edits to product-related files and avoid touching `expense.routes.ts`, `ExpenseCategory`, and financial expense reports.

## Migration Plan

1. Update `backend/src/db/schema.ts` with `ALTER TABLE products DROP COLUMN IF EXISTS category;` and update `CREATE TABLE products`.
2. Update `backend/src/db/seed.ts` product INSERT statements.
3. Update `backend/src/types/index.ts` and `frontend/src/types/index.ts`.
4. Update `backend/src/routes/product.routes.ts`, `inventory.routes.ts`, and `report.routes.ts`.
5. Update `frontend/src/services/catalog.service.ts` and `frontend/src/components/common/AppProductCombobox.vue`.
