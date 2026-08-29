## Why

In wholesale and multi-warehouse tool distribution, products are frequently packed, shipped, and counted in bulk cartons or boxes (colisage) in addition to individual units. Currently, the product catalog only tracks individual units without carton sizing (`box_size`), preventing warehouse staff and dispatchers from knowing how many complete cartons exist in inventory or need to be prepared and loaded for a customer invoice. Introducing a box size attribute enables automated calculation of carton counts in the stock inventory and displays the total number of cartons on printed sales invoices for rapid warehouse dispatch.

## What Changes

- Add a `box_size` (Colisage / Pièces par Carton) attribute to the `products` table (integer $\ge 0$, defaulting to `0` for unboxed/single items).
- Update product creation and edition workflows in `ProductListView.vue` to allow entering and editing the box size.
- Display packaging info (`Colisage : X pcs/ctn` or `—`) in the product catalog table and include it in CSV exports.
- Calculate and display the number of full cartons in the inventory stock view (`StockView.vue` and inventory API/CSV exports) using strict floor division ($\lfloor \text{quantité} / \text{colisage} \rfloor$ when $\text{colisage} > 0$).
- Calculate and display the total number of full cartons (`Nombre de Cartons`) in the sales invoice summary footer (`InvoiceDocument.vue`) to facilitate order verification and warehouse loading.

## Capabilities

### New Capabilities
- `product-box-size`: Covers the definition of box size (`box_size`) in the product catalog, carton count calculation in inventory stock views, and total carton aggregation on sales invoices.

### Modified Capabilities
<!-- None: No existing specs modified -->

## Impact

- **Database**: `products` table schema receives `box_size INTEGER NOT NULL DEFAULT 0`.
- **Backend APIs**:
  - `backend/src/routes/product.routes.ts`: Handles `boxSize` in GET, POST, PUT, and CSV export.
  - `backend/src/routes/inventory.routes.ts`: Returns `productBoxSize` and carton calculations in stock queries and CSV exports.
  - `backend/src/routes/sale.routes.ts`: Includes `productBoxSize` on sale line items.
- **Frontend**:
  - `frontend/src/types/index.ts`: Extends `Product`, `Stock`, and `SaleItem` with `boxSize` / `productBoxSize`.
  - `frontend/src/views/products/ProductListView.vue`: Adds form field and table display for Colisage.
  - `frontend/src/views/inventory/StockView.vue`: Displays carton count in stock table.
  - `frontend/src/components/sales/InvoiceDocument.vue`: Computes and displays `Nombre de Cartons` in footer summary.
