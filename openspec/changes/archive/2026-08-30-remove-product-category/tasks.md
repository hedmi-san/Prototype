## 1. Database & Seed Updates

- [x] 1.1 Update `backend/src/db/schema.ts` to remove `category` from `products` table creation and add `ALTER TABLE products DROP COLUMN IF EXISTS category;`
- [x] 1.2 Update `backend/src/db/seed.ts` to remove `category` from product seed records

## 2. Backend Types & Routes

- [x] 2.1 Remove `category` from `Product` and `ProductCatalogReport` interfaces in `backend/src/types/index.ts`
- [x] 2.2 Update `backend/src/routes/product.routes.ts` to remove category query parameters, search clauses, inserts, updates, response mappings, and CSV export columns
- [x] 2.3 Update `backend/src/routes/inventory.routes.ts` to remove `p.category` from SQL query and CSV export headers
- [x] 2.4 Update `backend/src/routes/report.routes.ts` to remove `p.category` from `/catalog` report endpoint

## 3. Frontend Types & Components

- [x] 3.1 Remove `category` from `Product` and `ProductCatalogReport` interfaces in `frontend/src/types/index.ts`
- [x] 3.2 Update `frontend/src/services/catalog.service.ts` to remove category parameters from `exportProductsCsv` and query methods
- [x] 3.3 Update `frontend/src/components/common/AppProductCombobox.vue` to remove category matching logic from search filters

## 4. Verification & Validation

- [x] 4.1 Build and typecheck backend with `npm run build` in `backend`
- [x] 4.2 Build and typecheck frontend with `npm run build` in `frontend`
- [x] 4.3 Verify that financial expense categories (`ExpenseCategory`) remain untouched and operational
