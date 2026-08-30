## Why

The `category` attribute on the `products` table is obsolete, unused in real operations, and introduces unnecessary maintenance overhead across the product schemas, API routes, queries, filters, and export handlers. Removing it completely streamlines product entity management.

## What Changes

- **BREAKING**: Remove the `category` column from the `products` PostgreSQL database table and schema definitions.
- **BREAKING**: Remove `category` from Product types and interfaces on both backend (`backend/src/types/index.ts`) and frontend (`frontend/src/types/index.ts`).
- Remove `category` handling, query parameters, search clauses, insertion, update, and response mapping from product routes (`backend/src/routes/product.routes.ts`).
- Remove `p.category` column selection and CSV export mapping from inventory routes (`backend/src/routes/inventory.routes.ts`) and reports routes (`backend/src/routes/report.routes.ts`).
- Clean up seed data (`backend/src/db/seed.ts`) and database migration/schema updates to ensure database consistency.
- Remove `category` from frontend catalog service query parameters and export routines (`frontend/src/services/catalog.service.ts`), and from product search tokens in `AppProductCombobox.vue`.
- Ensure financial/accounting expense categories (`ExpenseCategory`, `expenses.category`) remain completely intact and unaffected.

## Capabilities

### New Capabilities
- `product-catalog-cleanup`: Defines the streamlined product data model without category attributes, including product creation, updates, querying, search tokenization, and CSV exports.

### Modified Capabilities
<!-- None -->

## Impact

- **Database**: `products` table schema altered to drop `category` column; seed data cleaned up.
- **Backend API**: `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`, `GET /api/products/export/csv`, `GET /api/inventory/export/csv`, and `GET /api/reports/catalog` no longer accept or return a product `category` field.
- **Frontend**: `Product` type definition, `AppProductCombobox` search tokenizer, and `catalog.service.ts` updated to remove all product category references.
- **Financial/Expense Modules**: Unaffected.
