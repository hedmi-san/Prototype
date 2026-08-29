## 1. Database & Schema

- [x] 1.1 Add `box_size INTEGER NOT NULL DEFAULT 0` column to `products` table in `backend/src/db/schema.ts` and ensure startup migration executes safely
- [x] 1.2 Update sample seed data in `backend/src/db/seed.ts` with representative `box_size` values (e.g. 16, 24, 0)

## 2. Backend APIs & Endpoints

- [x] 2.1 Update `backend/src/routes/product.routes.ts` to support `boxSize` across GET `/api/products`, GET `/:id`, POST `/`, PUT `/:id`, and CSV export
- [x] 2.2 Update `backend/src/routes/inventory.routes.ts` to select `p.box_size as product_box_size` and export `Colisage` / `Nombre de Cartons` in stock CSV
- [x] 2.3 Update `backend/src/routes/sale.routes.ts` to include `product_box_size` in sale item queries

## 3. Frontend Types & Product Management

- [x] 3.1 Update TypeScript interfaces in `frontend/src/types/index.ts` (`Product`, `Stock`, `SaleItem`) with `boxSize` and `productBoxSize`
- [x] 3.2 Add `Colisage (Pièces par Carton)` input field to the create/edit product modal in `frontend/src/views/products/ProductListView.vue`
- [x] 3.3 Display colisage subtext / badge under product designation in `frontend/src/views/products/ProductListView.vue`

## 4. Inventory Stock View & Invoice Document

- [x] 4.1 Update `frontend/src/views/inventory/StockView.vue` to display complete cartons count ($\lfloor \text{quantity} / \text{box\_size} \rfloor$) for products with `boxSize > 0`
- [x] 4.2 Update `frontend/src/components/sales/InvoiceDocument.vue` to compute total complete cartons across all sale items and render `Nombre de Cartons` in the footer summary

## 5. Verification & Quality Checks

- [x] 5.1 Test creating and updating products with `boxSize = 0` and `boxSize > 0` in product catalog
- [x] 5.2 Validate stock inventory carton counts with exact multiples and remainder units
- [x] 5.3 Validate invoice document `Nombre de Cartons` summary with partial and full box sales
